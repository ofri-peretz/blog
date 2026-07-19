// /go/ resolver — a tiny, extensible URL-shortener core (plan §L5.5–§L5.7).
//
// This module is the PURE brain of the redirect layer: given the parsed
// request (key segments, query params, the pre-loaded short-link row) it
// returns a plain `{ status, location, headers, capture }` decision. It
// imports nothing from Next.js, Supabase, or the network, so it is unit-
// testable to 100% without spinning up a server (see __tests__/go-resolver).
//
// ── Shape: an ordered pipeline ───────────────────────────────────────
// `resolveGoDestination` runs a fixed sequence of small, single-purpose
// steps. Each is a named pure function; adding a capability (device
// routing, geo routing, A/B destinations, per-link rate caps, custom
// vanity slugs) is "write one function, splice one line" — the other
// steps never change. The steps, in order:
//
//   1. classifyKey      parse /go path → { key, kind }
//   2. lookup(key)      load the short-link row (injected; null = none)
//   3. applyGuards      drop the row if inactive / expired
//   4. pickDestination  platform-aware (utm_source) → override → default
//   5. buildCapture     assemble the short_link_click payload
//   6. buildRedirect    302 + noindex, destination + capture
//
// The Supabase read and the PostHog send live in the thin route wrapper
// ([...key]/route.ts) — never here — so this stays hermetic.
//
// ── Data model: short_links (a shortener row, not an article mapping) ─
// A row is `key → destination(s)` plus metadata. `/go/<article-slug>`
// with NO row still works (default derives `/articles/<slug>`); a row is
// only needed to OVERRIDE (repoint, per-platform copy, campaign, expiry).

/** The origin of the canonical blog. Destinations never point back at /go/. */
export const BLOG_ORIGIN = "https://ofriperetz.dev";

/** Link taxonomy — also the value carried on the PostHog event. */
export type LinkKind = "article" | "npm" | "gh" | "external";

/**
 * A `short_links` row (see supabase/migrations/*_short_links.sql). Every
 * field except `key` is optional here: rows are sparse (most links are
 * pure defaults), and the metadata columns are seams for future features
 * that the resolver reads defensively.
 */
export interface ShortLinkRow {
  /** The /go path after `/go/`, e.g. "my-slug" or "npm/@scope/pkg". PK. */
  key: string;
  kind?: LinkKind | null;
  /** Default/ repointed destination. Overrides the derived default. */
  destination?: string | null;
  /** Per-platform copies keyed by utm_source, e.g. { devto: "https://…" }. */
  platforms?: Record<string, string> | null;
  /** Metadata seams — present in the schema, mostly unused for now. */
  campaign?: string | null;
  tags?: string[] | null;
  /** Kill switch. Only an explicit `false` disables the override. */
  active?: boolean | null;
  created_at?: string | null;
  /** ISO timestamp; once past, the override is ignored (link goes default). */
  expires_at?: string | null;
  note?: string | null;
}

/** The click event payload the route fires to PostHog (fire-and-forget). */
export interface ShortLinkClickProps {
  key: string;
  kind: LinkKind;
  from: string | null;
  utm_source: string | null;
  destination: string;
}

/** The resolver's decision. `headers` excludes Location (that's `location`). */
export interface GoResolution {
  status: 302;
  location: string;
  headers: Record<string, string>;
  capture: ShortLinkClickProps;
}

export interface ResolveInput {
  /** The catch-all segments from `/go/[...key]` (may be empty). */
  keyParts: string[];
  /** `?utm_source` — routes to a per-platform copy when a row has one. */
  utmSource: string | null;
  /** `?from=<source-slug>` — publisher-injected attribution; never routing. */
  from: string | null;
  /** The full incoming query string (utm_* are forwarded to the article default). */
  incomingSearchParams: URLSearchParams;
  /**
   * Synchronous row lookup, injected by the caller. The route closes this
   * over the cached whole-table fetch; tests pass a fake. Absent ⇒ no rows.
   */
  lookup?: (key: string) => ShortLinkRow | null | undefined;
  /** Injected clock for deterministic expiry tests; defaults to now. */
  now?: number;
}

// ── Step 1: classify the key ─────────────────────────────────────────
/**
 * Parse the catch-all segments into a normalized key + kind. Empty or
 * all-blank segments classify as `external` (→ safe home fallback). The
 * `npm`/`gh` namespaces require at least one following segment; a bare
 * `/go/npm` falls through to `article` (→ /articles/npm), never a crash.
 */
export function classifyKey(keyParts: string[]): {
  key: string;
  kind: LinkKind;
} {
  const segments = keyParts.filter((s) => s.length > 0);
  if (segments.length === 0) return { key: "", kind: "external" };

  const [ns, ...rest] = segments;
  const key = segments.join("/");
  if (ns === "npm" && rest.length > 0) return { key, kind: "npm" };
  if (ns === "gh" && rest.length > 0) return { key, kind: "gh" };
  // /go/r/<hash> — a STORED redirect: the destination lives in the short_links
  // row, never in the client link (no ?to=). Classified external so a missing
  // row fails safe to the blog home instead of deriving an /articles/ path.
  if (ns === "r") return { key, kind: "external" };
  return { key, kind: "article" };
}

// ── Default destination (used when no row, or a guarded-out row) ──────
/**
 * Derive the zero-config destination for a key. Articles get utm_* params
 * forwarded (attribution continuity); npm/gh map to the public package / repo
 * page. `external` is a /go/r/ STORED redirect with NO derivable target — its
 * destination lives in the short_links row, so with no row it fails safe to the
 * blog home. The client never passes a URL (no ?to=); only a saved slug.
 */
export function deriveDefault(
  kind: LinkKind,
  key: string,
  incomingSearchParams: URLSearchParams,
): string {
  if (kind === "npm") {
    // Strip the "npm/" namespace; the rest (incl. @scope/pkg) is the package.
    return `https://www.npmjs.com/package/${key.slice("npm/".length)}`;
  }
  if (kind === "gh") {
    return `https://github.com/${key.slice("gh/".length)}`;
  }
  if (kind === "article") {
    const dest = new URL(`/articles/${key}`, BLOG_ORIGIN);
    for (const [k, v] of incomingSearchParams) {
      if (k.startsWith("utm_")) dest.searchParams.set(k, v);
    }
    return dest.toString();
  }
  // external / empty key — no derivable target (a stored redirect resolves from
  // its row; a missing row lands here). Land on the blog home.
  return `${BLOG_ORIGIN}/`;
}

// ── Step 3: guards (active? expired?) ────────────────────────────────
/**
 * Return the row only if it may route: an explicit `active === false`
 * disables it, and a past `expires_at` retires it. A failed guard yields
 * `null`, so the pipeline falls back to the derived default — a published
 * /go/ link NEVER breaks, it just reverts to the canonical target.
 *
 * New guards (rate cap, geo allow-list, …) slot in here as extra early
 * returns without touching any other step.
 */
export function applyGuards(
  row: ShortLinkRow | null | undefined,
  now: number,
): ShortLinkRow | null {
  if (!row) return null;
  if (row.active === false) return null;
  if (row.expires_at) {
    const expiresAt = Date.parse(row.expires_at);
    if (!Number.isNaN(expiresAt) && expiresAt <= now) return null;
  }
  return row;
}

// ── Step 4: pick the destination ─────────────────────────────────────
/**
 * Destination precedence, given a guarded row (or null):
 *   1. per-platform copy   row.platforms[utm_source]   (dev.to → dev.to)
 *   2. repointed default   row.destination
 *   3. derived default     deriveDefault(kind, key)
 * A future A/B or device step would wrap this pick; today it's linear.
 */
export function pickDestination(args: {
  kind: LinkKind;
  key: string;
  row: ShortLinkRow | null;
  utmSource: string | null;
  incomingSearchParams: URLSearchParams;
}): string {
  const { kind, key, row, utmSource, incomingSearchParams } = args;
  if (row) {
    if (utmSource && row.platforms) {
      // Own-property only. `utmSource` is raw `?utm_source`, so a crafted
      // `__proto__` / `constructor` / `toString` must not read an inherited
      // Object.prototype value (truthy, non-string → a broken `[object Object]`
      // Location). hasOwn keeps the lookup to real per-platform copies.
      const platformUrl = Object.hasOwn(row.platforms, utmSource)
        ? row.platforms[utmSource]
        : undefined;
      if (platformUrl) return platformUrl;
    }
    if (row.destination) return row.destination;
  }
  return deriveDefault(kind, key, incomingSearchParams);
}

// ── Step 5: capture payload ──────────────────────────────────────────
/** Shape the core click props (route.ts augments with referer/app/etc). */
export function buildCapture(props: ShortLinkClickProps): ShortLinkClickProps {
  return {
    key: props.key,
    kind: props.kind,
    from: props.from,
    utm_source: props.utm_source,
    destination: props.destination,
  };
}

// ── The pipeline ─────────────────────────────────────────────────────
/**
 * Resolve a /go/ request to a redirect decision. Pure and synchronous:
 * all I/O (the row fetch, the click send) is the caller's job. This is
 * the single function the route wrapper calls, and the single function
 * the tests exercise for full branch coverage.
 */
export function resolveGoDestination(input: ResolveInput): GoResolution {
  const {
    keyParts,
    utmSource,
    from,
    incomingSearchParams,
    lookup,
    now = Date.now(),
  } = input;

  // 1. parse key → { key, kind }
  const { key, kind } = classifyKey(keyParts);
  // 2. load link (injected; a shortener would also try a vanity-slug table here)
  const rawRow = lookup ? (lookup(key) ?? null) : null;
  // 3. guards — active? expired?  (add rate-cap / geo checks here later)
  const row = applyGuards(rawRow, now);
  // 4. pick destination — platform-aware → override → default
  const destination = pickDestination({
    kind,
    key,
    row,
    utmSource,
    incomingSearchParams,
  });
  // 5. build the click-capture payload (spectator stream feeds PostHog)
  const capture = buildCapture({
    key,
    kind,
    from,
    utm_source: utmSource,
    destination,
  });
  // 6. return the redirect decision
  return {
    status: 302,
    location: destination,
    headers: {
      // 302 (not 301): repointable, no SEO equity transfer. noindex: a
      // /go/ URL must never be indexed or surfaced as a canonical.
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
    },
    capture,
  };
}

// ── Click-event helpers (pure; the route only does the fetch) ─────────
/**
 * Reduce a Referer header to its origin (scheme+host) — the only piece we
 * keep, and only as an analytics fallback for links pasted outside the
 * pipeline. Returns null for absent/malformed referers.
 */
export function refererToOrigin(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/**
 * Build the PostHog `short_link_click` event body (minus `api_key`, which
 * the route adds from env). Keeping this pure means the spectator event
 * schema is locked by tests: {key, kind, from, utm_source, destination}
 * plus referer_origin and the shared `app` super-property — exactly the
 * fields a per-link click-count / top-referrers view will group by.
 */
export function buildClickEventBody(
  props: ShortLinkClickProps,
  refererOrigin: string | null,
  timestamp: string = new Date().toISOString(),
): {
  event: "short_link_click";
  distinct_id: "server-go";
  properties: Record<string, unknown>;
  timestamp: string;
} {
  return {
    event: "short_link_click",
    // Server-originated: one synthetic id, and no ephemeral person profile.
    distinct_id: "server-go",
    properties: {
      ...props,
      referer_origin: refererOrigin,
      // The client provider registers `app` as a super-property; server
      // events must carry it explicitly (one shared PostHog project).
      app: "blog",
      $process_person_profile: false,
    },
    timestamp,
  };
}
