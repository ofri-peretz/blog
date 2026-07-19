/**
 * /go/ resolver + route tests.
 *
 * Locks the URL-shortener core (plan §L5.5–§L5.7) to 100% branch coverage:
 *   - the pure pipeline (resolver.ts): key classification, default
 *     derivation, active/expired guards, destination precedence, capture
 *     payload, referer parsing, and the PostHog event body;
 *   - the thin route wrapper (route.ts): cached-lookup → resolve → 302 +
 *     noindex, and the fire-and-forget short_link_click send, with Supabase
 *     and PostHog injected/mocked so the whole thing is hermetic.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- a few casts feed
 * deliberately malformed params (undefined key, non-date expiry) to exercise
 * fallback branches that the types otherwise forbid. */
/* eslint-disable conventions/utm-taxonomy --
 * utm_source="devto" is load-bearing, not a free choice: the /go/ handler
 * routes on short_links.platforms[utm_source] and the whole pipeline
 * standardized on 'devto'. The taxonomy's 'dev_to' is the outlier and needs
 * reconciling in UTM_PHILOSOPHY.md, not here (same rationale as the sibling
 * devto-link-transforms.test.ts). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyGuards,
  buildCapture,
  buildClickEventBody,
  classifyKey,
  deriveDefault,
  pickDestination,
  refererToOrigin,
  resolveGoDestination,
  type ShortLinkRow,
} from "../app/go/resolver";

const BLOG = "https://ofriperetz.dev";
const params = (qs = "") => new URLSearchParams(qs);

// ── Step 1: classifyKey ──────────────────────────────────────────────
describe("classifyKey", () => {
  it("empty segments → external (safe home fallback)", () => {
    expect(classifyKey([])).toEqual({ key: "", kind: "external" });
  });

  it("all-blank segments are dropped → external", () => {
    expect(classifyKey([""])).toEqual({ key: "", kind: "external" });
  });

  it("a bare slug → article", () => {
    expect(classifyKey(["my-slug"])).toEqual({
      key: "my-slug",
      kind: "article",
    });
  });

  it("npm/<pkg> → npm; scoped names span segments", () => {
    expect(classifyKey(["npm", "eslint-plugin-jwt"])).toEqual({
      key: "npm/eslint-plugin-jwt",
      kind: "npm",
    });
    expect(classifyKey(["npm", "@interlace", "eslint-devkit"])).toEqual({
      key: "npm/@interlace/eslint-devkit",
      kind: "npm",
    });
  });

  it("bare /go/npm (no package) falls through to article, never crashes", () => {
    expect(classifyKey(["npm"])).toEqual({ key: "npm", kind: "article" });
  });

  it("gh/<owner>/<repo> → gh", () => {
    expect(classifyKey(["gh", "ofri-peretz", "eslint"])).toEqual({
      key: "gh/ofri-peretz/eslint",
      kind: "gh",
    });
  });

  it("bare /go/gh (no repo) falls through to article", () => {
    expect(classifyKey(["gh"])).toEqual({ key: "gh", kind: "article" });
  });

  it("r/<hash> → external (a stored redirect; destination lives in the row)", () => {
    expect(classifyKey(["r", "abc123"])).toEqual({
      key: "r/abc123",
      kind: "external",
    });
  });
});

// ── deriveDefault ────────────────────────────────────────────────────
describe("deriveDefault", () => {
  it("npm → npmjs package page (scoped preserved)", () => {
    expect(deriveDefault("npm", "npm/@interlace/eslint-devkit", params())).toBe(
      "https://www.npmjs.com/package/@interlace/eslint-devkit",
    );
  });

  it("gh → github repo page", () => {
    expect(deriveDefault("gh", "gh/ofri-peretz/eslint", params())).toBe(
      "https://github.com/ofri-peretz/eslint",
    );
  });

  it("article → blog canonical, forwarding only utm_* params", () => {
    expect(
      deriveDefault("article", "my-slug", params("utm_source=devto&ref=x")),
    ).toBe(`${BLOG}/articles/my-slug?utm_source=devto`);
  });

  it("article with no params → clean canonical", () => {
    expect(deriveDefault("article", "my-slug", params())).toBe(
      `${BLOG}/articles/my-slug`,
    );
  });

  it("external / empty key → blog home", () => {
    expect(deriveDefault("external", "", params())).toBe(`${BLOG}/`);
  });

  it("external stored redirect with no row also lands on the blog home", () => {
    // /go/r/<hash> whose row is missing (or guarded out) has no derivable
    // destination — deriveDefault sends it home, never a 404 or an
    // /articles/<hash> path. (The client never passes a URL, so there is
    // nothing else to fall back to.)
    expect(deriveDefault("external", "r/deadbeef", params())).toBe(`${BLOG}/`);
  });
});

// ── Step 3: applyGuards ──────────────────────────────────────────────
describe("applyGuards", () => {
  const now = Date.parse("2026-07-18T00:00:00Z");

  it("null row → null", () => {
    expect(applyGuards(null, now)).toBeNull();
    expect(applyGuards(undefined, now)).toBeNull();
  });

  it("active === false → null (kill switch)", () => {
    expect(applyGuards({ key: "k", active: false }, now)).toBeNull();
  });

  it("active true / undefined (default) → passes", () => {
    expect(applyGuards({ key: "k", active: true }, now)).toEqual({
      key: "k",
      active: true,
    });
    expect(applyGuards({ key: "k" }, now)).toEqual({ key: "k" });
  });

  it("expires_at in the past → null (retired)", () => {
    expect(
      applyGuards({ key: "k", expires_at: "2026-07-17T00:00:00Z" }, now),
    ).toBeNull();
  });

  it("expires_at in the future → passes", () => {
    const row = { key: "k", expires_at: "2026-07-19T00:00:00Z" };
    expect(applyGuards(row, now)).toEqual(row);
  });

  it("unparseable expires_at is ignored (not treated as expired)", () => {
    const row = { key: "k", expires_at: "not-a-date" } as ShortLinkRow;
    expect(applyGuards(row, now)).toEqual(row);
  });

  it("null expires_at → no expiry check", () => {
    const row = { key: "k", expires_at: null };
    expect(applyGuards(row, now)).toEqual(row);
  });
});

// ── Step 4: pickDestination ──────────────────────────────────────────
describe("pickDestination", () => {
  const base = {
    kind: "article" as const,
    key: "my-slug",
    incomingSearchParams: params(),
  };

  it("no row → derived default", () => {
    expect(pickDestination({ ...base, row: null, utmSource: null })).toBe(
      `${BLOG}/articles/my-slug`,
    );
  });

  it("utm_source with a matching platform copy → that copy (native routing)", () => {
    const row: ShortLinkRow = {
      key: "my-slug",
      platforms: { devto: "https://dev.to/unicop/my-slug-abc1" },
    };
    expect(pickDestination({ ...base, row, utmSource: "devto" })).toBe(
      "https://dev.to/unicop/my-slug-abc1",
    );
  });

  it("utm_source with NO matching platform → falls through to default", () => {
    const row: ShortLinkRow = {
      key: "my-slug",
      platforms: { devto: "https://dev.to/x" },
    };
    expect(pickDestination({ ...base, row, utmSource: "medium" })).toBe(
      `${BLOG}/articles/my-slug`,
    );
  });

  it("no utm_source but a repointed destination → the destination", () => {
    const row: ShortLinkRow = { key: "my-slug", destination: `${BLOG}/moved` };
    expect(pickDestination({ ...base, row, utmSource: null })).toBe(
      `${BLOG}/moved`,
    );
  });

  it("utm_source set but platforms null → destination override still applies", () => {
    const row: ShortLinkRow = {
      key: "my-slug",
      platforms: null,
      destination: `${BLOG}/moved`,
    };
    expect(pickDestination({ ...base, row, utmSource: "devto" })).toBe(
      `${BLOG}/moved`,
    );
  });

  it("row with neither platform match nor destination → derived default", () => {
    const row: ShortLinkRow = { key: "my-slug" };
    expect(pickDestination({ ...base, row, utmSource: "devto" })).toBe(
      `${BLOG}/articles/my-slug`,
    );
  });

  it("crafted utm_source (__proto__/constructor/toString) → own-property only, no inherited leak (CWE-20)", () => {
    const row: ShortLinkRow = {
      key: "my-slug",
      platforms: { devto: "https://dev.to/x" },
    };
    // A prototype key must not read an inherited Object.prototype value and
    // return it as the destination — it has no OWN entry, so fall through.
    for (const evil of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(pickDestination({ ...base, row, utmSource: evil })).toBe(
        `${BLOG}/articles/my-slug`,
      );
    }
  });
});

// ── Step 5: buildCapture ─────────────────────────────────────────────
describe("buildCapture", () => {
  it("projects exactly the five click props", () => {
    expect(
      buildCapture({
        key: "k",
        kind: "article",
        from: "src",
        utm_source: "devto",
        destination: `${BLOG}/articles/k`,
      }),
    ).toEqual({
      key: "k",
      kind: "article",
      from: "src",
      utm_source: "devto",
      destination: `${BLOG}/articles/k`,
    });
  });
});

// ── The pipeline: resolveGoDestination ───────────────────────────────
describe("resolveGoDestination", () => {
  const NOW = Date.parse("2026-07-18T00:00:00Z");

  it("no utm_source → 302 to blog canonical, UTMs forwarded, noindex", () => {
    const res = resolveGoDestination({
      keyParts: ["my-slug"],
      utmSource: null,
      from: "source-article",
      incomingSearchParams: params("utm_campaign=x&extra=y"),
      lookup: () => null,
      now: NOW,
    });
    expect(res.status).toBe(302);
    expect(res.location).toBe(`${BLOG}/articles/my-slug?utm_campaign=x`);
    expect(res.headers["X-Robots-Tag"]).toBe("noindex");
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(res.capture.from).toBe("source-article");
    expect(res.capture.kind).toBe("article");
  });

  it("utm_source=devto WITH a matching row → the dev.to copy", () => {
    const rows: ShortLinkRow[] = [
      { key: "my-slug", platforms: { devto: "https://dev.to/unicop/my-slug" } },
    ];
    const res = resolveGoDestination({
      keyParts: ["my-slug"],
      utmSource: "devto",
      from: null,
      incomingSearchParams: params("utm_source=devto"),
      lookup: (k) => rows.find((r) => r.key === k) ?? null,
      now: NOW,
    });
    expect(res.location).toBe("https://dev.to/unicop/my-slug");
    expect(res.capture.utm_source).toBe("devto");
    expect(res.capture.from).toBeNull();
  });

  it("utm_source=devto with NO matching row → blog canonical fallback", () => {
    const res = resolveGoDestination({
      keyParts: ["my-slug"],
      utmSource: "devto",
      from: null,
      incomingSearchParams: params("utm_source=devto"),
      lookup: () => undefined, // exercises the `?? null` on a lookup miss
      now: NOW,
    });
    expect(res.location).toBe(`${BLOG}/articles/my-slug?utm_source=devto`);
  });

  it("inactive row → guard drops it → derived default (link never breaks)", () => {
    const rows: ShortLinkRow[] = [
      {
        key: "my-slug",
        active: false,
        platforms: { devto: "https://dev.to/x" },
      },
    ];
    const res = resolveGoDestination({
      keyParts: ["my-slug"],
      utmSource: "devto",
      from: null,
      incomingSearchParams: params("utm_source=devto"),
      lookup: (k) => rows.find((r) => r.key === k) ?? null,
      now: NOW,
    });
    expect(res.location).toBe(`${BLOG}/articles/my-slug?utm_source=devto`);
  });

  it("expired row → guard drops it → derived default", () => {
    const rows: ShortLinkRow[] = [
      {
        key: "promo",
        kind: "external",
        destination: "https://example.com/sale",
        expires_at: "2026-01-01T00:00:00Z",
      },
    ];
    const res = resolveGoDestination({
      keyParts: ["promo"],
      utmSource: null,
      from: null,
      incomingSearchParams: params(),
      lookup: (k) => rows.find((r) => r.key === k) ?? null,
      now: NOW,
    });
    // 'promo' is not npm/gh → classified article → /articles/promo default.
    expect(res.location).toBe(`${BLOG}/articles/promo`);
  });

  it("/go/npm/<pkg> → npmjs", () => {
    const res = resolveGoDestination({
      keyParts: ["npm", "eslint-plugin-jwt"],
      utmSource: "devto",
      from: "src",
      incomingSearchParams: params(),
      lookup: () => null,
      now: NOW,
    });
    expect(res.location).toBe(
      "https://www.npmjs.com/package/eslint-plugin-jwt",
    );
    expect(res.capture.kind).toBe("npm");
  });

  it("/go/npm/@scope/<pkg> → npmjs (scoped)", () => {
    const res = resolveGoDestination({
      keyParts: ["npm", "@interlace", "eslint-devkit"],
      utmSource: null,
      from: null,
      incomingSearchParams: params(),
      lookup: () => null,
      now: NOW,
    });
    expect(res.location).toBe(
      "https://www.npmjs.com/package/@interlace/eslint-devkit",
    );
  });

  it("/go/gh/<owner>/<repo> → github", () => {
    const res = resolveGoDestination({
      keyParts: ["gh", "ofri-peretz", "eslint"],
      utmSource: null,
      from: null,
      incomingSearchParams: params(),
      lookup: () => null,
      now: NOW,
    });
    expect(res.location).toBe("https://github.com/ofri-peretz/eslint");
    expect(res.capture.kind).toBe("gh");
  });

  it("empty/malformed key → safe home fallback, not a crash", () => {
    const res = resolveGoDestination({
      keyParts: [],
      utmSource: null,
      from: null,
      incomingSearchParams: params(),
      // no lookup provided → exercises the `lookup ? … : null` else branch
      now: NOW,
    });
    expect(res.status).toBe(302);
    expect(res.location).toBe(`${BLOG}/`);
    expect(res.capture.kind).toBe("external");
  });

  it("defaults `now` to the wall clock when omitted", () => {
    // No `now` passed → exercises the default-parameter branch. A far-future
    // expiry must still pass under the real clock.
    const rows: ShortLinkRow[] = [
      {
        key: "my-slug",
        expires_at: "2999-01-01T00:00:00Z",
        destination: `${BLOG}/x`,
      },
    ];
    const res = resolveGoDestination({
      keyParts: ["my-slug"],
      utmSource: null,
      from: null,
      incomingSearchParams: params(),
      lookup: (k) => rows.find((r) => r.key === k) ?? null,
    });
    expect(res.location).toBe(`${BLOG}/x`);
  });

  it("never emits a /go/ URL as the destination", () => {
    for (const keyParts of [
      ["my-slug"],
      ["npm", "pkg"],
      ["gh", "o", "r"],
      [],
    ]) {
      const res = resolveGoDestination({
        keyParts,
        utmSource: null,
        from: null,
        incomingSearchParams: params(),
        lookup: () => null,
        now: NOW,
      });
      expect(res.status).toBe(302);
      expect(res.location.startsWith(`${BLOG}/go/`)).toBe(false);
    }
  });
});

// ── Click-event helpers ──────────────────────────────────────────────
describe("refererToOrigin", () => {
  it("null → null", () => {
    expect(refererToOrigin(null)).toBeNull();
  });
  it("valid referer → origin only (path stripped)", () => {
    expect(refererToOrigin("https://dev.to/unicop/some-post")).toBe(
      "https://dev.to",
    );
  });
  it("malformed referer → null", () => {
    expect(refererToOrigin("not a url")).toBeNull();
  });
});

describe("buildClickEventBody", () => {
  const props = {
    key: "my-slug",
    kind: "article" as const,
    from: "src",
    utm_source: "devto",
    destination: `${BLOG}/articles/my-slug`,
  };

  it("emits the spectator schema with app + no person profile", () => {
    const body = buildClickEventBody(
      props,
      "https://dev.to",
      "2026-07-18T00:00:00Z",
    );
    expect(body).toEqual({
      event: "short_link_click",
      distinct_id: "server-go",
      timestamp: "2026-07-18T00:00:00Z",
      properties: {
        ...props,
        referer_origin: "https://dev.to",
        app: "blog",
        $process_person_profile: false,
      },
    });
  });

  it("defaults the timestamp when omitted", () => {
    const body = buildClickEventBody(props, null);
    expect(typeof body.timestamp).toBe("string");
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    expect(body.properties.referer_origin).toBeNull();
  });
});

// ── The route wrapper (GET) — Supabase + PostHog mocked ───────────────
const { getCachedShortLinksMock, afterCalls } = vi.hoisted(() => ({
  getCachedShortLinksMock: vi.fn(),
  afterCalls: [] as Array<() => unknown | Promise<unknown>>,
}));

vi.mock("next/server", () => ({
  // Capture the scheduled callback so the test can flush it deterministically.
  after: (cb: () => unknown) => {
    afterCalls.push(cb);
  },
}));

vi.mock("@/lib/supabase-data", () => ({
  getCachedShortLinks: getCachedShortLinksMock,
}));

// Imported after the mocks are declared (vi.mock is hoisted above imports).
import { GET } from "../app/go/[...key]/route";

/** Run any after()-scheduled callbacks and wait for their async work. */
async function flushAfter() {
  const pending = afterCalls.splice(0);
  for (const cb of pending) await cb();
}

describe("GET /go/[...key] (route wrapper)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    afterCalls.length = 0;
    getCachedShortLinksMock.mockResolvedValue([]);
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    warnSpy.mockRestore();
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
  });

  const call = (
    path: string,
    headers: Record<string, string> = {},
    key?: string[],
  ) =>
    GET(new Request(`${BLOG}${path}`, { headers }), {
      params: Promise.resolve({
        key: (key ??
          path
            .replace(/^\/go\//, "")
            .split("?")[0]
            .split("/")) as string[],
      }),
    });

  it("302s to the canonical with noindex, and fires one short_link_click", async () => {
    const res = await call("/go/my-slug?from=src", {
      referer: "https://dev.to/unicop/x",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`${BLOG}/articles/my-slug`);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    await flushAfter();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, opts] = fetchMock.mock.calls[0];
    expect(endpoint).toBe("https://us.i.posthog.com/i/v0/e/"); // default host branch
    const sent = JSON.parse((opts as RequestInit).body as string);
    expect(sent.api_key).toBe("phc_test");
    expect(sent.event).toBe("short_link_click");
    expect(sent.distinct_id).toBe("server-go");
    expect(sent.properties).toMatchObject({
      key: "my-slug",
      kind: "article",
      from: "src",
      destination: `${BLOG}/articles/my-slug`,
      referer_origin: "https://dev.to",
      app: "blog",
    });
  });

  it("routes a utm_source hit to the platform copy from Supabase", async () => {
    getCachedShortLinksMock.mockResolvedValue([
      { key: "my-slug", platforms: { devto: "https://dev.to/unicop/my-slug" } },
    ]);
    const res = await call("/go/my-slug?utm_source=devto&from=src");
    expect(res.headers.get("Location")).toBe("https://dev.to/unicop/my-slug");
    await flushAfter();
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.properties.destination).toBe("https://dev.to/unicop/my-slug");
  });

  it("honors NEXT_PUBLIC_POSTHOG_HOST when set", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://eu.posthog.example";
    await call("/go/my-slug");
    await flushAfter();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://eu.posthog.example/i/v0/e/",
    );
  });

  it("swallows a failing capture without breaking the redirect", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ingest down"));
    const res = await call("/go/my-slug");
    expect(res.status).toBe(302); // redirect already returned
    await flushAfter();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("skips the capture entirely when no PostHog key is configured", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const res = await call("/go/my-slug");
    expect(res.status).toBe(302);
    await flushAfter();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats missing params.key as an empty key → home fallback", async () => {
    const res = await GET(new Request(`${BLOG}/go/`), {
      params: Promise.resolve({ key: undefined as any }),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`${BLOG}/`);
  });
});
