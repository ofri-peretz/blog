---
devto_url: "https://dev.to/ofri-peretz/nobody-writes-bad-crypto-they-write-correct-crypto-at-four-layers-2noa"
devto_id: 4286252
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/crypto-misuse-taxonomy.jpg"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/crypto-misuse-taxonomy-og.jpg"
title: "Nobody Writes Bad Crypto. They Write Correct Crypto at Four Layers."
description: "Crypto failures are not one mistake repeated. They are four distinct layers of correctness, and each one looks fine from the layer above it."
slug: "crypto-misuse-taxonomy"
published: true
date: 2026-08-05
published_at: "2026-08-01T09:00:32.914Z"
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
overall_score: 8.9
reviews:
  discovery & hook: 9
  discovery & hook_why: "**The hook rests on a reframe, not a testable number — and that's the one thing between this and 9.5.** Every top-3 corpus winner carries a stat the reader can run against their own code (\"80% of them,\" \"65-75% had vu..."
  technical: 9.4
  technical_why: "The RSA line (\"RSA padding left at a default that predates the attack it enables\") is the one spot a Node specialist would push back on. Node's `crypto.publicEncrypt` defaults to `RSA_PKCS1_OAEP_PADDING` (the *safe* o..."
  quality: 8.8
  quality_why: "**Give the reader one runnable thing.** This is a genre-2 methodology piece and the genre-2 bar asks for at least one command a reader can actually execute. Right now the article is 100% argument, 0% \"try it.\" A singl..."
  practitioner: 8.6
  practitioner_why: "The maturity-clustering claim is the article's actual differentiator over \"just a rule list,\" and it's the least-supported thing in the piece. Everything else here overlaps with the known crypto-misuse literature the ..."
  linkability: 8.5
  linkability_why: "**Missing the single most obvious cross-link — the Layer 1 worked example.** Layer 1 literally says \"`Math.random()` where you needed a CSPRNG,\" and you have a whole article on exactly that. Link it:; `` `Math.random(..."
  abstraction: 9
  abstraction_why: "**Anchor stability on the four layers — the one thing holding this off 9.5+.** The layers are the citable atoms of this taxonomy, and each carries an inline `{#layer-1}`…`{#layer-4}`. But they sit on **bold lead-ins i..."
  checklist: 10
  checklist_why: "(Scope-only, non-blocking) The four-layer framing is a coined taxonomy. At T1 that is in scope — it's domain-general security vocabulary, not an Interlace-branded term — but if a later edit ever attaches an Interlace ..."
  challenge: 8
  challenge_why: "Add one runnable artifact. This is an ESLint-ecosystem blog by the author of 20+ plugins, and a detection piece with no command is a self-inflicted gap. Even a single `grep -rE \"aes-.*-ecb|createHash\\(.sha1\"` for laye..."
  voice & agenda: 9
  voice & agenda_why: "The frontmatter `voice & agenda_why` note flags one AI-tell — `\"The code is not merely plausible, it is *correct at the layer a reader checks*\"` (the \"not just X, it's Y\" false-choice tic). **That note is stale.** The..."
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
static IV. An iteration count set in 2015 and never revisited. RSA where someone passed
`RSA_PKCS1_PADDING` explicitly — Node defaults to OAEP, so this one takes a deliberate
argument to get wrong, which is exactly why it survives review. Each is a single value,
usually a constant, and constants do not attract attention.

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
