---
slug: eslint-plugin-maintenance-signals
stage: spec
intent: sdlc/intent/eslint-plugin-maintenance-signals.md
status: approved
gathered: 2026-09-04
---

## Thesis

Days-since-release is free, fast, and a prompt rather than a verdict. Three
follow-up checks — the deprecation flag, supersession, and whether the plugin
still runs on your ESLint — separate finished from abandoned.

**The evidence did not move the table. It moved the instructions.** Every
figure in the article reproduces to within a day. What does not reproduce is
the command the article tells the reader to run: `npm view <plugin>
time.modified` is not the last release date. npm bumps `modified` on any
metadata change, so a deprecation or an ownership transfer refreshes it without
a publish. For four of the six packages in the article's own dead tier, that
field is 1,100–1,550 days newer than the truth, and it errs in the reassuring
direction.

The sharpest case: `eslint-plugin-flowtype` reports `time.modified` of
**2026-01-24**, which reads as a maintained package. Its latest version, 8.0.3,
was published **2021-10-29**. The article's table says 1,748 days and is right;
the article's command says 199 and is wrong. A reader following the
instructions would have contradicted the table and believed the command.

## Ground truth

Days are computed to the article's own measurement date, 2026-08-12, from the
publish time of each package's current `latest` version. The article's figures
are in the claim column so the comparison is legible.

| Claim                                                       | Value                    | Command                                                                 | Version  | Verified   |
| ----------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------- | -------- | ---------- |
| jsx-a11y days since release (article: 655)                  | 654                      | fetch registry, read `time[dist-tags.latest]`, diff to 2026-08-12       | 6.10.2   | 2026-09-04 |
| react days since release (article: 495)                     | 495                      | same                                                                    | 7.37.5   | 2026-09-04 |
| import days since release (article: 417)                    | 417                      | same                                                                    | 2.32.0   | 2026-09-04 |
| scanjs-rules, dead tier (article: 3,296)                    | 3295                     | same                                                                    | 0.2.1    | 2026-09-04 |
| node, dead tier (article: 2,328)                            | 2327                     | same                                                                    | 11.1.0   | 2026-09-04 |
| standard, dead tier (article: 2,088)                        | 2087                     | same                                                                    | 5.0.0    | 2026-09-04 |
| flowtype, dead tier (article: 1,748)                        | 1747                     | same                                                                    | 8.0.3    | 2026-09-04 |
| xss, dead tier (article: 1,507)                             | 1506                     | same                                                                    | 0.1.12   | 2026-09-04 |
| security-node, dead tier (article: 951)                     | 951                      | same                                                                    | 1.1.4    | 2026-09-04 |
| eslint-plugin-standard carries an npm deprecation flag      | true                     | read `versions[latest].deprecated` from the registry document           | 5.0.0    | 2026-09-04 |
| flowtype `time.modified` vs its real last release           | 2026-01-24 vs 2021-10-29 | `npm view eslint-plugin-flowtype time.modified` against `time['8.0.3']` | 8.0.3    | 2026-09-04 |
| the false-reassurance gap that creates                      | 1548 days                | difference between those two dates                                      | 8.0.3    | 2026-09-04 |
| security 3.0.1 publish date (article: June 2024)            | 2024-06-14               | read `time['3.0.1']`                                                    | 3.0.1    | 2026-09-04 |
| security 4.0.0 publish date (article: February 2026)        | 2026-02-19               | read `time['4.0.0']`                                                    | 4.0.0    | 2026-09-04 |
| security shipped again in June (article: June)              | 2026-06-12, v4.0.1       | read `time['4.0.1']`                                                    | 4.0.1    | 2026-09-04 |
| the silence between those two releases (article: 20 months) | 20 months                | 2024-06-14 to 2026-02-19                                                | 4.0.0    | 2026-09-04 |
| releases in 12mo for the three quiet plugins                | 0 each                   | count version entries within 365 days of 2026-08-12                     | as above | 2026-09-04 |

**Not verifiable as stated.** "Nine of the eighteen I measured shipped nothing
at all in the last twelve months" — the article names nine plugins in its table
and six in the dead tier, overlapping, and never lists all eighteen. The
denominator cannot be checked by a reader, and was not checked here. It is left
in the article because the claim it supports is carried independently by the
table, but it is the one number on the page nobody can audit.

Rows for the actively-maintained plugins (unicorn 8 days, jest 0, n 3, sonarjs
28, promise 107, security 61) were **not** re-verified to 2026-08-12: several
have published since, and the registry does not preserve what "days since
release" was on a past date. That is a limit of the instrument, not a doubt
about the article.

## Known traps pre-empted

- [x] **Export shape** — no plugin is imported; the code blocks are registry
      queries.
- [x] **Rule counts** — none claimed anywhere in the article.
- [x] **Config option names** — none.
- [x] **Detection logic** — no rule behaviour is described.
- [x] **Frozen identifiers** — unpublished. The slug carries no number, though
      the title carries a year.

## Outline

1. The one-second signal — the three quiet-plugin rows.
2. **Dormant is not dead** — the deprecation-flag row and the supersession row.
3. **The genuinely dead tier** — all six dead-tier rows.
4. **The one that came back** — the three `eslint-plugin-security` date rows
   and the 20-month row.
5. **Measure your own config** — the `time.modified` rows, which is where the
   correction landed.

## Framing check

Landscape, and it does the harder version: the article argues against its own
most flattering reading. "Dormant is not dead" concedes that a stable spec
should produce a stable plugin, and the package we have elsewhere called
unmaintained is shown recovering, with the lesson that a verdict needs an
expiry date. No neighbour is called worse than us; the numbers are presented
and the interpretations are hedged.
