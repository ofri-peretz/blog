/**
 * The stage-4 quality gate, at the door instead of in the log.
 *
 * `sdlc-quality-lock` enforces "no publish without a score", but it decides
 * what is published by reading `devto_id` — a field written back into the repo
 * AFTER dev.to has already accepted the post. It could only ever DETECT a
 * publish, never PREVENT one.
 *
 * That is not hypothetical. On 2026-09-02 an article went live unscored, one
 * day after the chain landed. CI on main stayed green for a day, because main
 * did not yet carry the id. The lock fired only when a PR committed the truth
 * — which is to say the gate was tripped by honesty, not by publishing.
 *
 * This module is the same rule, evaluated before the API call. It is kept in
 * its own file so it can be tested without importing the publish script, which
 * runs `main()` on import.
 */

/**
 * Articles that may not be published: no `quality` block in frontmatter, and
 * not grandfathered in the pre-chain baseline.
 *
 * @param {{slug: string, frontmatter: Record<string, unknown>}[]} articles
 * @param {Iterable<string>} grandfathered slugs from sdlc/baseline/unscored.json
 * @returns {string[]} offending slugs, empty when everything may ship
 */
export function unscoredOffenders(articles, grandfathered) {
  const exempt = new Set(grandfathered);
  return articles
    .filter((a) => !a.frontmatter?.quality && !exempt.has(a.slug))
    .map((a) => a.slug);
}

/** The message the operator sees. Separated so the test can assert it names the fix. */
export function refusalMessage(offenders) {
  return [
    "❌ Refusing to publish — no quality score, and not grandfathered:",
    ...offenders.map((s) => `   • ${s}`),
    "",
    "   Run the stage-4 panel: commit sdlc/spec/<slug>.md, sdlc/review/<slug>.json,",
    "   and the `quality` frontmatter block, all five lenses at 9.5 or above.",
    "   Adding the slug to sdlc/baseline/unscored.json is NOT the fix — that file",
    "   may only ever shrink.",
  ].join("\n");
}
