---
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/crypto-misuse-taxonomy.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/crypto-misuse-taxonomy-og.jpg"
title: "Nobody Writes Bad Crypto. They Write Correct Crypto at Four Layers."
description: "Crypto failures are not one mistake repeated. They are four distinct layers of correctness, and each one looks fine from the layer above it."
slug: "crypto-misuse-taxonomy"
published: false
date: 2026-08-05
tags:
  - "ai"
  - "security"
  - "node"
  - "javascript"
canonical_url: https://ofriperetz.dev/articles/crypto-misuse-taxonomy
reading_time_minutes: 6
tier: "T1"
series: "Foundations"
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
overall_score: 8.8
reviews:
  discovery & hook: 9
  discovery & hook_why: "**Add `#eslint`.** Current tags — `ai / security / node / javascript` — are all winners and correctly avoid dead `#staticanalysis`, but for a detection-focused piece that leans on taint-vs-heuristic and ground-truth, ..."
  technical: 9
  technical_why: "**Row 3 files \"reused IV\" under CWE-1204, which is the one contestable cell.** CWE-1204 is *Generation of Weak Initialization Vector (IV)* — it covers *weak/predictable generation*, not *reuse*. IV/nonce reuse maps to..."
  quality: 8.7
  quality_why: "**Actionability is currently zero — add one runnable thing.** This is a genre-2 methodology piece and the genre-2 bar asks for at least one command a reader can run. The article says \"the rule list tells you what to g..."
  practitioner: 8.5
  practitioner_why: "The maturity-clustering hypothesis is the single most interesting claim in the piece — \"a just-audited team fails at layer 2, a mature team fails at layers 3–4\" — and it's backed by nothing. The author says so plainly..."
  linkability: 8.5
  linkability_why: "**Per-layer anchors — the single biggest linkability gap for a taxonomy.** All four layers live under one `{#the-four-layers}` anchor, so no other article can deep-link \"Layer 3 — the parameters.\" Give each its own: `..."
  abstraction: 9
  abstraction_why: "**Anchor the four layers — this is the article's whole reason to exist and the single thing keeping it off 9.5+.** The layers are the citable atoms of a T1 taxonomy: a Semgrep/CodeQL/Bandit doc, or your own T2/T3 piec..."
  checklist: 10
  checklist_why: "None required for tier scope. One thing to keep an eye on for future edits: the Node `crypto` vs userland-library section (`#the-one-that-is-not-a-layer`) is a supply-chain judgment framed generically, which is correc..."
  challenge: 7.7
  challenge_why: "The load-bearing claim — that layer-failures cluster by team maturity — is the article's headline differentiator over \"just a rule list,\" and it is backed by nothing but the author's own hedge (\"a hypothesis, not some..."
  voice & agenda: 9
  voice & agenda_why: "Kill the one AI-tell. \"The code is not merely plausible, it is *correct at the layer a reader checks*\" is the false-choice \"not just X, it's Y\" tic — the only mechanical strike in the piece. It's a one-word fix: \"It i..."
---
The code review comment I have written most often, and regretted most often, is
"use a stronger algorithm."

It is regrettable because it is almost never the actual defect. It is the defect I can see
from where I am standing. The team swaps SHA-1 for SHA-256, everyone agrees the review was
useful, and the thing that would have mattered stays where it was.

---

## Four layers, each hiding the next {#the-four-layers}

A crypto call has to be right four separate times, and being correct at one layer makes
the next one invisible. AES looks like a decision you already made. It is four.

**Layer 1 — the primitive.** {#layer-1} Right kind of thing? A hash where you needed a
KDF. A cipher where you needed a MAC. `Math.random()` where you needed a CSPRNG. Everyone
reviews this layer, because it is visible in the function name.

**Layer 2 — the mode.** {#layer-2} Primitive right, mode wrong. AES in ECB encrypts
identical blocks to identical ciphertext — which is why the famous penguin is still
legible after "encryption." Nothing about `aes-256-ecb` reads as wrong at a glance; it
contains `aes` and `256`, and both are reassuring.

**Layer 3 — the parameters.** {#layer-3} Right primitive, right mode, wrong inputs. A
static IV. An iteration count set in 2015 and never revisited. RSA padding left at a
default that predates the attack it enables. Each is a single argument, usually a
constant — and constants do not attract review attention.

**Layer 4 — the usage.** {#layer-4} Everything above correct, and the surrounding code
gives it away. Comparing an HMAC with `===` and leaking the answer through timing.
Deriving a key correctly, then logging it. This layer is not crypto code at all, which is
why crypto review misses it.

## Why layers beat a rule list {#why-layers}

A rule list tells you what to grep for. The layer tells you where your team is, and
therefore what you are *not* going to catch.

My working hypothesis — and it is a hypothesis, not something I have measured — is that
failures cluster by how much crypto attention a team has already had. Never thought about
it: layer 1. Just audited: layer 2, because the audit said "upgrade the primitives" and it
did exactly that. Careful for years: layers 3 and 4.

If that holds, the uncomfortable corollary is that layer 3 and 4 defects live longest
*because* the code passes every review asking "are we using strong algorithms." The
maturity that fixes the first two layers is the same maturity that stops looking further
down. That is the measurement I most want from this taxonomy.

## Detection: the easy layers are the trap {#detection}

Layers 1 and 2 live in a single call expression. `createHash("sha1")` and `aes-256-ecb`
are string literals; matching them is syntactic and any linter does it well.

Layers 3 and 4 are not. Whether an IV is static depends on where it came from — a
data-flow question, the difference between
[matching a pattern and following a value](https://ofriperetz.dev/articles/taint-vs-heuristic-detection).
Whether a comparison is timing-unsafe depends on whether the value is a secret, which no
analyzer knows from the expression alone.

So tool coverage is inversely correlated with how long a defect survives. The layers a
tool covers cleanly are the ones your team already fixes. Read any claim that a tool
"covers crypto" as "covers layers 1 and 2" until shown otherwise — and checking that needs
[a corpus with known answers](https://ofriperetz.dev/articles/ground-truth-in-security-testing),
not a rule count.

## Where this lands in the standards {#standards}

The layers map to distinct CWEs, which is the useful part —
[the taxonomy](https://ofriperetz.dev/articles/cwe-taxonomy-explained) already encodes the
distinction most reviews collapse:

| Layer | CWE |
| --- | --- |
| 1 — primitive | [CWE-327](https://cwe.mitre.org/data/definitions/327.html) risky algorithm; [CWE-338](https://cwe.mitre.org/data/definitions/338.html) weak PRNG |
| 2 — mode | [CWE-327](https://cwe.mitre.org/data/definitions/327.html) — ECB has no dedicated CWE |
| 3 — parameters | [CWE-1204](https://cwe.mitre.org/data/definitions/1204.html) weak IV *generation*; [CWE-323](https://cwe.mitre.org/data/definitions/323.html) *reusing* a nonce or IV; [CWE-916](https://cwe.mitre.org/data/definitions/916.html) insufficient computational effort |
| 4 — usage | [CWE-208](https://cwe.mitre.org/data/definitions/208.html) observable timing discrepancy |

Filing all four as "weak crypto" is how the layer 3 and 4 instances disappear from your own
bug data, and then from your priorities.

Prior art worth reading: Egele et al., *An Empirical Study of Cryptographic Misuse in
Android Applications* (CCS 2013), which found the overwhelming majority of apps using
crypto APIs got at least one layer wrong. A decade old, different platform, and the
layering has not aged at all.
[NIST SP 800-175B](https://csrc.nist.gov/pubs/sp/800/175/b/r1/final) is the reference for
what each primitive is for, and Bernstein's cache-timing work on AES is the clearest
statement of why layer 4 is not paranoia.

## Why generated code lands on layers 2 and 3 {#generated-code}

A model asked for "AES encryption in Node" produces something that runs. Running is the
constraint it optimizes, and every one of these layers is invisible to that constraint.
ECB runs. A static IV runs. An iteration count of 1000 runs. The code is correct at the
layer a reader checks, because it was trained on a corpus where that is what correct
looked like.

Same reason the human review misses it. The model read the same tutorials you did.

---

_Which layer does your codebase fail at? The answer tends to say more about when the code
was written than who wrote it — layer 2 usually means "audited once, years ago."_

---

I write about measurement and static analysis at
[dev.to/ofri-peretz](https://dev.to/ofri-peretz).
