---
slug: modernization-lint-as-codemod
stage: spec
intent: sdlc/intent/modernization-lint-as-codemod.md
status: approved
gathered: 2026-09-04
---

## Thesis

Four modernization rules behave like a codemod with a ratchet: run the fixer
once, read one diff, and the rule then prevents the old idiom returning.

The evidence moved the claim in one important place. The draft said all four
rules are 100% auto-fixable and that this is why turning them all on at `error`
cannot leave a backlog. Two of the four — `no-instanceof-array` and
`prefer-event-target` — carry no fixer in 3.1.2. The claim was true of the
findings measured, because both of those rules returned zero, and false as a
general statement about the plugin. The thesis survives; the adoption advice
had to be rewritten to say which rules it applies to.

## Ground truth

The historical block is the August measurement as published. It is **not
re-runnable**: it spanned four repos that are not all public, and the codemod
has since been applied to them. It is recorded as a dated observation, and the
article says so in its own text. The 2026-09-04 block is the reproducible one.

| Claim                                                                    | Value                             | Command                                                                                              | Version                        | Verified   |
| ------------------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- |
| rules in the published package                                           | 4                                 | `node -p "Object.keys(require('eslint-plugin-modernization').rules).length"` after installing 3.1.2  | 3.1.2                          | 2026-09-04 |
| `prefer-at` carries a fixer                                              | fixable=code                      | read `rules['prefer-at'].meta.fixable`                                                               | 3.1.2                          | 2026-09-04 |
| `prefer-template-literal` carries a fixer                                | fixable=code                      | read `rules['prefer-template-literal'].meta.fixable`                                                 | 3.1.2                          | 2026-09-04 |
| `no-instanceof-array` carries NO fixer                                   | undefined                         | read `rules['no-instanceof-array'].meta.fixable`                                                     | 3.1.2                          | 2026-09-04 |
| `prefer-event-target` carries NO fixer                                   | undefined                         | read `rules['prefer-event-target'].meta.fixable`                                                     | 3.1.2                          | 2026-09-04 |
| peer range (pipes spelled as `or`, a literal pipe would split this cell) | ^8.40.0 or ^9.0.0 or ^10.0.0      | read `peerDependencies.eslint` from the installed package.json                                       | 3.1.2                          | 2026-09-04 |
| Node floor                                                               | >=18.0.0                          | read `engines.node` from the installed package.json                                                  | 3.1.2                          | 2026-09-04 |
| Oxlint port of this plugin                                               | none                              | no `interlace-modernization` package exists in the monorepo                                          | monorepo at 2833399            | 2026-09-04 |
| `[].at(-1)` matches `e[e.length-1]` on empty                             | both undefined                    | `node -e "const e=[];console.log(Object.is(e.at(-1), e[e.length-1]))"` prints true                   | Node 24.12.0                   | 2026-09-04 |
| RE-RUN files linted, apps/blog/src                                       | 189                               | walk `.ts`/`.tsx` under `apps/blog/src`, excluding `node_modules`, `dist`, `.next`, `build`, `.d.ts` | 3.1.2                          | 2026-09-04 |
| RE-RUN total modernization findings                                      | 8 in 6 files                      | `Linter.verify` per file with the four rules at error, filename passed RELATIVE to the walk root     | 3.1.2                          | 2026-09-04 |
| RE-RUN prefer-at                                                         | 6                                 | same run                                                                                             | 3.1.2                          | 2026-09-04 |
| RE-RUN prefer-template-literal                                           | 2                                 | same run                                                                                             | 3.1.2                          | 2026-09-04 |
| RE-RUN no-instanceof-array and prefer-event-target                       | 0 each                            | same run                                                                                             | 3.1.2                          | 2026-09-04 |
| RE-RUN files matching no config (the vacuity guard)                      | 0                                 | count messages with a null `ruleId` in the same run                                                  | 3.1.2                          | 2026-09-04 |
| harness fires on planted violations                                      | 3 findings                        | run the same config over a file containing `a[a.length-1]`, `"x " + y` and `instanceof Array`        | 3.1.2                          | 2026-09-04 |
| RE-RUN react-no-inline-functions, same tree, same day                    | 110                               | same harness, rule `react-features/react-no-inline-functions` at error                               | react-features 1.7.2           | 2026-09-04 |
| the noisy rule fires on a `.map()` arrow in JSX                          | 1 finding on a one-component file | `Linter.verify` on `xs.map(x => <li key={x}>{x}</li>)`                                               | react-features 1.7.2           | 2026-09-04 |
| HISTORICAL files linted, four repos                                      | 389                               | the same four-rule run, as published                                                                 | 2.x, 2026-08-12                | 2026-08-12 |
| HISTORICAL findings                                                      | 55 in 36 files                    | as published; 11 + 44 = 55, internally consistent                                                    | 2.x, 2026-08-12                | 2026-08-12 |
| HISTORICAL prefer-at                                                     | 11                                | as published                                                                                         | 2.x, 2026-08-12                | 2026-08-12 |
| HISTORICAL prefer-template-literal                                       | 44                                | as published                                                                                         | 2.x, 2026-08-12                | 2026-08-12 |
| HISTORICAL react-no-inline-functions                                     | 476                               | as published                                                                                         | react-features 1.x, 2026-08-12 | 2026-08-12 |

**The vacuity guard is not decoration.** Two earlier attempts at the re-run
returned a confident zero. The first passed a `files: ["**/*"]` glob that
matched nothing; the second passed absolute paths, which the flat-config
matcher would not match either. Both produced one null-`ruleId` message per
file — "no matching configuration" — which a naive counter discards, leaving a
clean, wrong `0`. The row that makes the real number trustworthy is
`unmatched: 0`, and the planted-violation row beside it.

## Known traps pre-empted

- [x] **Export shape** — the config in the article imports the default export
      and passes it as `plugins: { modernization }`, then names rules under
      that key. No `configs` access, so the default-import crash cannot occur.
- [x] **Rule counts** — 4, counted from `Object.keys(...rules)` on the built
      package, not from a directory listing. The local checkout has 2.0.4
      installed, which lacks `prefer-template-literal` entirely; counting from
      it would have produced 3 and a wrong article.
- [x] **Config option names** — no rule options are set; all four take a bare
      severity.
- [x] **Detection logic** — fixability was read from `meta.fixable` per rule
      rather than assumed from the plugin's purpose, which is exactly what the
      draft had done and got wrong.
- [x] **Frozen identifiers** — unpublished. The slug carries no number.

## Outline

1. The innocuous line — no numeric claim.
2. **The two that fired** — the HISTORICAL prefer-at and prefer-template-literal
   rows.
3. **The two that found nothing** — the HISTORICAL zero rows, and the noisy-rule
   rows (476 historical, 110 same-day).
4. **Lint as codemod** — the fixability rows; this is the section the false
   "100% auto-fixable" claim lived in.
5. **The config** — the peer-range, Node-floor and Oxlint rows.
6. The measurement note — every RE-RUN row, plus the two guard rows.

## Framing check

Landscape, and the sharpest example in the article is turned inward: the rule
called out as noise is ours, named, in our own plugin. No neighbour's tool is
criticised. No comparison table, so the self-graded-fixture disclosure does not
apply.
