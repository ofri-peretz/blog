---
slug: eslint-plugin-dependency-weight
stage: spec
intent: sdlc/intent/eslint-plugin-dependency-weight.md
status: approved
gathered: 2026-09-04
---

## Thesis

Subtract the baseline before quoting an install count, and stop quoting direct
dependency counts entirely — they do not predict tree size.

**The evidence did not move the claim at all, and that is the notable result.**
Every one of the fourteen numbers in this article was re-resolved on the
`gathered` date and came back identical to the 2026-08-12 measurement: the
69-package baseline, all eleven plugin trees, the 3-package outlier, and the
228-package combined install. The article's own closing advice is "re-run the
four lines rather than citing mine", so it was re-run, and the stability is
itself evidence for the article's other point — the trees at the top of the
table have not moved because those packages are not releasing.

**Method**, taken verbatim from the article so the check is the reader's check:
`npm init -y`, then `npm i --package-lock-only <plugin>`, then count keys under
`node_modules/` in the resulting lockfile. Nothing is downloaded.

## Ground truth

The claim column carries the published figure; the value column carries the
2026-09-04 re-resolution. They agree on every row.

| Claim                                                 | Value      | Command                                                                                       | Version       | Verified   |
| ----------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- | ------------- | ---------- |
| bare eslint, the baseline (article: 69)               | 69         | `npm i --package-lock-only eslint` then count `node_modules/` keys                            | eslint latest | 2026-09-04 |
| eslint-plugin-import tree (article: 205)              | 205        | same, for that plugin                                                                         | latest        | 2026-09-04 |
| eslint-plugin-react tree (article: 204)               | 204        | same                                                                                          | latest        | 2026-09-04 |
| eslint-plugin-jsx-a11y tree (article: 194)            | 194        | same                                                                                          | latest        | 2026-09-04 |
| eslint-plugin-unicorn tree (article: 110)             | 110        | same                                                                                          | latest        | 2026-09-04 |
| eslint-plugin-sonarjs tree (article: 83)              | 83         | same                                                                                          | latest        | 2026-09-04 |
| eslint-plugin-n tree (article: 80)                    | 80         | same                                                                                          | latest        | 2026-09-04 |
| eslint-plugin-promise tree (article: 70)              | 70         | same                                                                                          | latest        | 2026-09-04 |
| eslint-plugin-security tree, the outlier (article: 3) | 3          | same                                                                                          | latest        | 2026-09-04 |
| eslint-plugin-react-features tree (article: 71)       | 71         | same                                                                                          | latest        | 2026-09-04 |
| eslint-plugin-modernization tree (article: 71)        | 71         | same                                                                                          | latest        | 2026-09-04 |
| eslint-plugin-browser-security tree (article: 71)     | 71         | same                                                                                          | latest        | 2026-09-04 |
| eslint-plugin-import-next tree (article: 97)          | 97         | same                                                                                          | latest        | 2026-09-04 |
| the combined React setup (article: 228)               | 228        | same, installing eslint plus react, jsx-a11y and import together                              | latest        | 2026-09-04 |
| every "adds" figure is tree minus baseline            | consistent | 205-69=136, 204-69=135, 194-69=125, 110-69=41, 83-69=14, 80-69=11, 70-69=1, 71-69=2, 97-69=28 | derived       | 2026-09-04 |
| the union is far below the sum of parts               | 228 vs 465 | 69+135+125+136 = 465 against a measured 228                                                   | derived       | 2026-09-04 |

**Direct-dependency counts were not re-verified.** The `direct deps` column
(19, 18, 15, 20, 13, 8, 1, 1, 2) is read from each package's manifest and was
not re-fetched on 2026-09-04. It carries no weight in the argument beyond
demonstrating that it does not track the tree column, which the tree figures
establish on their own.

## Known traps pre-empted

- [x] **Export shape** — no plugin is imported; every code block is a shell
      command.
- [x] **Rule counts** — none claimed. All counts are packages, resolved from a
      lockfile rather than from a directory listing.
- [x] **Config option names** — none appear.
- [x] **Detection logic** — no rule behaviour is described.
- [x] **Frozen identifiers** — unpublished. The slug carries no number, though
      the title carries two.

## Outline

1. The 205 and the 69 — the import row and the baseline row.
2. **What each plugin actually adds** — the seven peer rows and the derived
   "adds" row.
3. **The number you actually install** — the combined row and the
   union-versus-sum row.
4. **Where mine land** — the four rows for our own plugins, plus the
   eslint-plugin-security outlier row.
5. **How to check yours** — the method, which is the command every row uses.

## Framing check

Landscape, and it concedes more than it has to. Our own row is printed beside
the others, `eslint-plugin-promise` is named as the leaner package, and the
smallest tree on the page belongs to a package the article then argues a small
tree does not vindicate — with the reasoning given, and a link to the longer
argument, rather than an assertion. No banned vocabulary: "promise wins" was
reworded to "promise is the leaner choice", which is the same concession
without the word.
