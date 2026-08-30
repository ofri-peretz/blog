# Review passes

What the PR review agent looks for in this repository, in severity order.
Consumed by `.github/workflows/claude-code-review.yml`.

A finding is **blocking** if it would ship something false, broken, or
off-brand to a published URL. Everything else is **advisory** — raise it, do
not gate on it.

---

## Pass 1 — Claim integrity `blocking`

Every number, version, rule count, benchmark result and API signature in the
diff must trace to a row in the article's `sdlc/spec/<slug>.md` evidence table.

- A number in the article with no spec row is a **blocking** finding, even if
  it happens to be correct. Correct-by-luck is not a process.
- A number whose spec row has no reproducing command is blocking against the
  _spec_, not the article — flag the spec.
- Check the five known fabrication classes explicitly:
  1. **Export shape** — `import plugin from '...'` then `plugin.configs` is
     `undefined` and crashes. `configs` is a _named_ export.
  2. **Rule counts** — must come from `node -p` on the built dist, not from
     `ls src/rules/` and not from `grep -v index`.
  3. **Config option names** — must match `schema[0].properties` exactly;
     schemas are `additionalProperties: false`, so a wrong key crashes at load.
  4. **Detection logic** — a claim about what a rule flags requires that the
     rule's skip branches were read.
  5. **Frozen identifiers** — see pass 5.

## Pass 2 — Framing `blocking`

Landscape framing, always. The ecosystem has neighbours, not enemies.

- Blocking vocabulary: _beat, win, winner, crush, destroy, kill, moat,
  competitor, threat_. Use coverage scope, specialisation, "best paired with".
- A comparison article must disclose that fixtures span our own design
  surface, and must show at least one case the neighbour handles well.
- No article may rest on a thesis that requires our plugin to be the best
  option where it is not.

## Pass 3 — Compatibility `blocking`

Any installation or configuration snippet must cover the full matrix:

- package managers: npm · yarn · pnpm · bun
- Node: the minimum the plugin's `engines.node` actually declares
- ESLint 8 (eslintrc) · ESLint 9 · ESLint 10 (flat)
- Oxlint, where the rule has a port

A snippet that only shows npm + flat config is a blocking finding.

## Pass 4 — Link health `advisory`

Outbound links, canonical URL, `cover_image`, `social_image`, and every
cross-article link resolve 2xx. Advisory because upstream 404s are not always
ours to fix — but they must be reported, never silently accepted.

## Pass 5 — Identifier freeze `blocking`

For any article that already has a `devto_id`, these fields are immutable:
`slug`, `devto_id`, `devto_url`, `canonical_url`, `cover_image`, `social_image`.

The two image fields are on that list because they are asset filenames whose
stem is the slug. A find-and-replace over prose will happily rewrite them and
404 both covers, and nothing in the build reports it.

dev.to permalinks cannot be renamed. Changing a published slug 404s every
inbound link that ever pointed at it. When retitling, change the frontmatter
`title` and the body — never the identifiers. A stale number inside a slug is
accepted debt, not a bug to fix.

This pass is also enforced deterministically by
`.claude/hooks/freeze-identifiers.mjs`; the review pass exists to catch edits
made outside a Claude session.

---

## Sizing the review

The review agent has a turn budget, and reading a file costs a turn. A
corpus-wide change can exhaust it before the agent posts anything — the first
run of this rubric died at `error_max_turns` on a 102-file PR, having read the
diff and returned nothing.

Two mitigations, both in `claude-code-review.yml`: the budget is set explicitly
(`--max-turns 60`, not the default 20), and the prompt instructs the agent to
triage a large diff — group mechanical or repeated changes, sample a few to
confirm the pattern, and spend the depth on files carrying logic.

If a review fails on turns again, raise the budget or split the PR. Do not
respond by narrowing the rubric: a review that skips pass 1 to fit its budget
is worse than no review, because it reports green.

## Separation of duties

- The agent that wrote the article is not the agent that reviews it.
- **No agent approves a PR in this repository.** Claude reviews, and fixes its
  own findings on the branch. Ofri approves and merges — that is the only
  route to publish.
- The PR thread is the audit record: findings, fixes, and approval all live
  there, and it is the stage-5 artifact of the chain.
