---
kind: plan
slug: 2026-08-31-measured-claims
opened: 2026-08-31
---

# Plan: bind copy to the measurement it quotes

Intent: [`2026-08-31-measured-claims.intent.md`](./2026-08-31-measured-claims.intent.md)

## Ground truth

| Claim | Value | Source | Read on |
|---|---|---|---|
| Invite copy said | three of the 35 rules | `lint-embeds.ts` before the fix | 2026-08-30 |
| Plugin actually shipped | 42 rules | `node -p` on the published package | 2026-08-30 |
| Gate button said | about 400 KB | `article-playground.tsx` before the fix | 2026-08-31 |
| Bundle actually weighs | 370,746 brotli, 362 KB | brotli of the built artifact | 2026-08-31 |
| Article published | 362 KB | the article body | 2026-08-31 |
| Existing rule-count lock | yes, added with the 35 to 42 fix | `lint-embeds-lock.test.ts` | 2026-08-31 |
| Existing size lock | none | grep of the test suite | 2026-08-31 |

The rule-count half already exists — it was written when the "35 rules" drift
was found, and it reads the installed plugin rather than a constant. The size
half does not, which is why the gate label drifted freely.

## Approach

**Extend the existing pattern rather than inventing one.** The rule-count lock
already demonstrates the shape: parse the number out of the copy, compare it to
the live measurement, fail with a message naming both.

For size, the measurement is the built artifact, which is gitignored. So the
lock must build it — `scripts/build-lint-worker.mjs` is hermetic, needs no
network, and already runs on `predev`/`prebuild`, so a test can invoke it and
brotli the output.

```
measured = brotliSync(readFileSync("public/lint-worker.js")).length
quoted   = /\((\d+) KB\)/.exec(gateLabel)
assert |quoted*1024 - measured| within a stated tolerance
```

**Tolerance, not equality.** Equality would red the build on every dependency
bump, which trains people to edit the number without reading it — the opposite
of the goal. A band (say ±8%) fails when the claim becomes *misleading* and
stays quiet when it is merely stale in the last digit. The band's width is the
real design decision here and should be stated in the test, not buried.

Rejected: committing the artifact so the test can read it without building.
1.7 MB of generated output in git, rebuilt every deploy, to avoid a two-second
build step — that trade is backwards.

Rejected: a build-time codegen that writes the number into the label. It removes
the drift but also removes the human from the claim, and "about 400 KB" is a
sentence a person should own.

## Sequence

1. Size lock: build, brotli, parse the gate label, compare within band.
2. Verify it fails: hand-edit the label to a wrong number and watch it red.
3. Verify the rule-count half still fails on a stale count (it was verified when
   written; re-verify, because a lock nobody re-checks is a lock nobody trusts).
4. Document the band and the reason in the test header.

## Gates

- Both halves must be seen failing before they are believed.
- The failure message names the copy, the measured value, and the file — a red
  build that does not say what to edit is a tax, not a signal.
- No new committed artifact, no network in the test.

## Risks

- **Build time in CI.** The worker build is a couple of seconds; if that turns
  out to be worse in CI, gate the size half behind the same job that already
  builds, rather than making every `vitest` run pay it.
- A band chosen too wide protects nothing; too narrow and it cries wolf on
  routine bumps. Start at ±8% and adjust from evidence, recording why.
- This locks the *gate label*. Other surfaces may quote sizes later; the lock
  should grow a list rather than being copy-pasted per surface.
