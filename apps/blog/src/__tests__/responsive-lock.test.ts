// Structural rules for responsiveness, run in milliseconds with no browser.
//
// This is the cheap half of the strategy. jsdom has no layout engine, so no
// unit test can prove that a page does not overflow — only a real browser can,
// which is what scripts/layout-audit.mjs does. What CAN be enforced statically
// are the CAUSES, and every rule below is a bug that actually shipped here:
//
//   1. /npm rendered "No package data available" for days because the page was
//      prerendered in CI, where Supabase credentials do not exist.
//   2. Cover tiles cropped 25-28% of every image because their container was
//      h-44 / aspect-video against a 2.38:1 source.
//   3. Header nav links were 20px tall, under the WCAG 2.2 SC 2.5.8 minimum.
//
// A rule here is worth more than a browser assertion when it can name the fix.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");

/** All files under `dir` ending in `ext`. `recursive` does the descent in one
 *  call, so there are no hand-built intermediate paths. */
function walk(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf-8" })
    .filter((f) => f.endsWith(ext))
    .map((f) => path.join(dir, f));
}
const rel = (p: string) => path.relative(SRC, p);

/**
 * The generated design-system tree, a SIBLING of `src/` — which is why every
 * lock in this directory has been blind to it. `walk(SRC, …)` cannot reach
 * `apps/blog/.interlace/`, and three grids in there broke /scorecard and three
 * consecutive production deploys on 2026-09-02.
 *
 * Intent: docs/sdlc/intents/2026-09-02-unguarded-generated-surface.
 */
const INTERLACE = path.resolve(__dirname, "..", "..", ".interlace");

/**
 * Generated files `src/` can actually reach, by following imports.
 *
 * NOT a basename scan. The intent's first draft counted any `.interlace/`
 * filename mentioned anywhere under `src/` and got 61; the import graph gives
 * 17. The failure direction inverted with the method: a basename scan
 * over-counts, this under-counts, because it follows static `from "…"` only.
 * If this set ever looks too small, suspect the walk before the components.
 */
function reachableInterlace(): string[] {
  if (!existsSync(INTERLACE)) return [];
  const specs = new Set<string>();
  for (const f of walk(SRC, ".ts").concat(walk(SRC, ".tsx"))) {
    for (const m of readFileSync(f, "utf-8").matchAll(
      /^\s*(?:import|export)[^\n]*?from\s+"#interlace\/([^"]+)"/gm,
    )) {
      specs.add(m[1]);
    }
  }
  const resolve = (spec: string): string | null => {
    for (const cand of [`${spec}.tsx`, `${spec}.ts`, `${spec}/index.ts`]) {
      const abs = path.join(INTERLACE, cand);
      if (existsSync(abs)) return abs;
    }
    return null;
  };
  const seen = new Set<string>();
  const queue = [...specs];
  while (queue.length) {
    const file = resolve(queue.pop()!);
    if (!file || seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf-8");
    for (const m of text.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)) {
      const abs = path.resolve(path.dirname(file), m[1]);
      if (abs.startsWith(INTERLACE)) queue.push(path.relative(INTERLACE, abs));
    }
    for (const m of text.matchAll(/from\s+"#interlace\/([^"]+)"/g)) {
      queue.push(m[1]);
    }
  }
  return [...seen].filter((f) => f.endsWith(".tsx"));
}

/** Every `.tsx` under the generated tree, reachable or not. */
function allInterlace(): string[] {
  return existsSync(INTERLACE) ? walk(INTERLACE, ".tsx") : [];
}

const relAny = (p: string) =>
  p.startsWith(INTERLACE)
    ? `.interlace/${path.relative(INTERLACE, p)}`
    : path.relative(SRC, p);

describe("responsive + data-freshness structural rules", () => {
  /**
   * The /npm bug. The production build runs in GitHub Actions via
   * `vercel build`, and SUPABASE_URL / SUPABASE_ANON_KEY are Sensitive-type
   * vars that `vercel pull` cannot read back — so at build time they are
   * simply absent. Any page that reads Supabase and is statically prerendered
   * therefore bakes an EMPTY result, and `revalidate` serves that emptiness
   * for its whole TTL.
   *
   * force-dynamic is not a caching regression: the data fetchers wrap their
   * reads in unstable_cache, so Supabase is still hit at most twice a day.
   */
  it("every Supabase-backed page opts out of static prerendering", () => {
    const offenders: string[] = [];
    for (const file of walk(path.join(SRC, "app"), "page.tsx")) {
      const src = readFileSync(file, "utf-8");
      const readsSupabase =
        /from\s+"@\/lib\/(supabase-data|npm-page-data)"/.test(src);
      if (!readsSupabase) continue;
      const isDynamic =
        /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/.test(src) ||
        /export\s+const\s+revalidate\s*=\s*0\b/.test(src);
      if (!isDynamic) {
        offenders.push(
          `${rel(file)} reads Supabase but is prerendered — add ` +
            `\`export const dynamic = "force-dynamic"\`, or the build (which has ` +
            `no Supabase credentials) will bake an empty page.`,
        );
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  /**
   * The cover-crop bug, twice: once in the /articles grid (h-44) and once on
   * the home page (aspect-video). Covers are rendered at exactly 1000x420 by
   * agents/footprint/publishing/render-cover.sh. Any container that shapes one
   * must use that ratio, or object-cover silently eats the hero word.
   */
  it("cover containers use the cover's own aspect ratio", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC, ".tsx")) {
      const src = readFileSync(file, "utf-8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        if (!/data-slot="[a-z-]*cover[a-z-]*"|article-card-cover/.test(line)) return;
        // The className is on this line or the next few.
        const chunk = lines.slice(i, i + 4).join(" ");
        if (!/className="/.test(chunk)) return;
        const shaped = /aspect-\[|aspect-video|aspect-square|\bh-\d+\b|h-\[/.test(chunk);
        if (!shaped) return;
        if (!/aspect-\[1000\/420\]/.test(chunk)) {
          offenders.push(
            `${rel(file)}:${i + 1} shapes a cover container without ` +
              `aspect-[1000/420]; covers are 1000x420 and object-cover will crop.`,
          );
        }
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  /**
   * WCAG 2.2 SC 2.5.8 (AA) requires a 24x24 CSS px target. A bare `text-sm`
   * link is a 20px-tall box. Standalone nav links must carry an explicit
   * minimum; links inside a sentence are exempt and are not matched here.
   */
  it("standalone nav links declare a minimum target size", () => {
    const offenders: string[] = [];
    for (const file of [
      path.join(SRC, "components", "app-header.tsx"),
      path.join(SRC, "components", "app-footer.tsx"),
    ]) {
      if (!existsSync(file)) continue;
      const src = readFileSync(file, "utf-8");
      // Every <Link> in these two chrome components is a standalone target.
      const classNames = [...src.matchAll(/className="([^"]*)"/g)].map((m) => m[1]);
      for (const cls of classNames) {
        if (!/\btext-sm\b|\btext-muted-foreground\b/.test(cls)) continue;
        if (!/transition-colors/.test(cls)) continue; // link-ish, not a wrapper
        const hasTarget =
          /\bmin-h-\d/.test(cls) || /\bpy-\d/.test(cls) || /\bh-\d/.test(cls);
        if (!hasTarget) {
          offenders.push(
            `${rel(file)}: nav link "${cls.slice(0, 50)}…" has no min-h/py — ` +
              `bare text-sm is a 20px box, under the 24px SC 2.5.8 minimum.`,
          );
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("standalone prose links stay contained — inline-flex kills soft-wrap", () => {
    // Bug 4 (2026-08-26): the SC 2.5.8 fix put standalone-link on
    // inline-flex, which stopped its TEXT from wrapping. A long
    // 📦 npm-install link sized to its full text and scrolled the whole
    // document 43px sideways at 390px — the exact mobile bug class the
    // repo contract warns about. The rule must keep the containment pair
    // alongside the inline-flex that makes it necessary.
    const css = readFileSync(path.join(SRC, "app", "globals.css"), "utf-8");
    const block = css.match(/\.prose a\.standalone-link \{[^}]*\}/)?.[0] ?? "";
    expect(block, "standalone-link rule missing from globals.css").not.toBe("");
    expect(block).toContain("display: inline-flex");
    expect(block).toContain("max-width: 100%");
    expect(block).toContain("overflow-wrap: anywhere");
  });

  /**
   * The other half of the /npm bug. Every fetcher in supabase-data.ts runs
   * inside unstable_cache, and Vercel's Data Cache outlives the deployment —
   * so returning [] / null / 0 on a failure CACHES that failure for the full
   * TTL and across redeploys. A transient blip becomes twelve silent hours.
   *
   * Callers must decide how to degrade, because they degrade for one request.
   */
  it("no Supabase fetcher returns an empty result instead of throwing", () => {
    const file = path.join(SRC, "lib", "supabase-data.ts");
    if (!existsSync(file)) return;
    const offenders: string[] = [];
    readFileSync(file, "utf-8")
      .split("\n")
      .forEach((line, i) => {
        // `if (!client) return []` / `return null` / `return 0` — the shape
        // that silently caches "there is no data".
        if (/if\s*\(!client\)\s*return\b/.test(line)) {
          offenders.push(
            `${rel(file)}:${i + 1} returns empty when the client is missing — ` +
              `use requireClient(), which throws, so the failure is not cached.`,
          );
        }
        // `if (error) { ... return [] }` inside a cached fetcher.
        if (/^\s*console\.error\("\[supabase-data\]/.test(line)) {
          offenders.push(
            `${rel(file)}:${i + 1} logs a query error and continues — throw ` +
              `instead, so unstable_cache does not store the failure.`,
          );
        }
      });
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  /**
   * A grid that declares only RESPONSIVE column counts has no base track, so
   * the single implicit column falls back to `auto` — which is max-content and
   * cannot shrink below its contents. At 320px with text at 200% (WCAG 1.4.4)
   * the article grid sized its track to 502px inside a 256px container and
   * pushed the document 214px sideways.
   *
   * `grid-cols-1` emits repeat(1, minmax(0, 1fr)), which can shrink. This is a
   * cause a static rule CAN name, unlike overflow itself.
   */
  it("every responsive grid declares a base column count", () => {
    const offenders: string[] = [];
    for (const file of [...walk(SRC, ".tsx"), ...reachableInterlace()]) {
      readFileSync(file, "utf-8")
        .split("\n")
        .forEach((line, i) => {
          for (const m of line.matchAll(/className="([^"]*\bgrid\b[^"]*)"/g)) {
            const toks = m[1].split(/\s+/);
            const responsive = toks.some((t) =>
              /^(sm|md|lg|xl|2xl):grid-cols-/.test(t),
            );
            const hasBase = toks.some(
              (t) => t.startsWith("grid-cols-") && !t.includes(":"),
            );
            if (responsive && !hasBase) {
              const generated = file.startsWith(INTERLACE);
              offenders.push(
                `${relAny(file)}:${i + 1} grid has only responsive columns — add ` +
                  `grid-cols-1 so the base track is minmax(0,1fr) and can shrink.` +
                  (generated
                    ? ` THIS FILE IS GENERATED — do not edit it here. Fix it in` +
                      ` the agents repo at apps/interlace-docs-baseline/, then` +
                      ` run \`npm run sync\`.`
                    : ""),
              );
            }
          }
        });
    }
    /*
     * The generated offenders cannot be fixed here — every file in
     * `.interlace/` says "DO NOT EDIT DIRECTLY, local edits will be overwritten
     * on next sync". So they sit in a dated allowlist until the upstream
     * baseline is corrected in the agents repo.
     *
     * The allowlist is a RATCHET, not a mute button: a stale entry — one whose
     * grid has since been fixed — fails this test just as loudly as a new
     * offender. It can only ever shrink. Same contract as
     * `sdlc/baseline/unscored.json`.
     */
    const allowlist: { file: string }[] = JSON.parse(
      readFileSync(
        path.join(__dirname, "fixtures", "interlace-grid-allowlist.json"),
        "utf-8",
      ),
    );
    const allowed = new Set(allowlist.map((e) => e.file));
    const key = (o: string) => o.split(" grid has only")[0];

    const unexpected = offenders.filter((o) => !allowed.has(key(o)));
    expect(unexpected, unexpected.join("\n")).toEqual([]);

    const found = new Set(offenders.map(key));
    const stale = [...allowed].filter((f) => !found.has(f));
    expect(
      stale,
      `these grids are FIXED — delete their entries from ` +
        `fixtures/interlace-grid-allowlist.json:\n${stale.join("\n")}`,
    ).toEqual([]);
  });

  // DELIBERATELY NOT TESTED HERE: horizontal overflow.
  //
  // The obvious static rule — flag `whitespace-nowrap` without an escape hatch
  // — was written, run, and deleted. It fired on ten call sites (tab labels,
  // metric captions, badges) while the browser audit measured ZERO overflow on
  // every route at every viewport. The rule cannot tell a three-character badge
  // from a URL, because whether text overflows depends on the text, the font
  // and the container width — none of which exist without a layout engine.
  //
  // A lint rule that is wrong ten times out of ten gets disabled, and then it
  // protects nothing. Overflow is proven where it can actually be measured:
  // `npm run audit:layout`, which fails CI on a real document that scrolls
  // sideways. Statics catch causes they can name; the browser catches outcomes.
});
