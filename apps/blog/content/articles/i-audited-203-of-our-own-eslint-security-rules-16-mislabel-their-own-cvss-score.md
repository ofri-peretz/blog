---
devto_url: "https://dev.to/ofri-peretz/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score-3hgo"
devto_id: 4250212
title: "I Audited 203 of Our Own ESLint Security Rules. 16% Mislabel Their Own CVSS Score."
description: "A CVSS 9.1 SSRF rule ships labeled LOW. A CVSS 9.8 JWT rule ships labeled MEDIUM. The root cause was one unvalidated string field."
slug: "i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score"
canonical_url: "https://ofriperetz.dev/articles/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score"
tier: "T3"
# devto_url: (fill after publishing)
# devto_id: (fill after publishing)
published: true
published_at: "2026-07-06"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score-og.jpg?v=b2"
reading_time_minutes: 9
tags:
  - "security"
  - "node"
  - "devsecops"
  - "eslint"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
---

Run `eslint-plugin-node-security` against a Server-Side Request Forgery
pattern and the terminal prints this:

```text
src/fetch-avatar.ts
  4:7  warning  🔒 CWE-918 CVSS:9.1 | HTTP call whose URL argument name
              suggests user input. | LOW
```

CVSS 9.1. Read the number on the calculator and it's nine tenths of a point
from the maximum possible score a vulnerability can get. Read the word next
to it and it says **LOW**. Those two facts are printed four characters apart
on the same line, by the same rule, and they disagree with each other.

I write the CWE/CVSS/OWASP metadata that ships in every one of our lint
messages — it's meant to be the thing that tells you, at a glance, how
worried to be. So I went and checked whether it actually does that. I wrote
a 25-line script that reads every rule in the Interlace ESLint ecosystem,
pulls its CVSS score and its shipped severity label, and checks whether the
label matches the official band the score falls in.

**33 of 203 rules — 16% — don't.** Some of those are defensible once you
know why. Some aren't. All of them are a good excuse to explain what CWE,
CVSS, and OWASP actually measure, because the gap between them is exactly
where lint output stops being trustworthy and starts being decoration.

## What the three labels actually measure

A single line of our lint output packs in three unrelated standards. Quick
definitions — there's a full reference for each if you need it:

- **[CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained)** names _what kind_ of bug it is.
  `CWE-918` is SSRF; `CWE-287` is Improper Authentication. A category, not a
  verdict.
- **[CVSS](https://ofriperetz.dev/articles/cvss-scores-explained)** is a
  _computed_ 0.0–10.0 score. Its four bands are the ruler this audit uses:
  0.1–3.9 Low, 4.0–6.9 Medium, 7.0–8.9 High, 9.0–10.0 Critical. The number is
  the primary source; the band name is derived from it.
- **[OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained)** is a _category_ bucket
  (A01–A10) — an address, not a severity measurement.

Only CVSS is actually a severity measurement. So when a lint rule prints a
severity word, that word has exactly one legitimate source: the CVSS score
next to it. If they disagree, the word is wrong.

## Case 1: a 9.1 that prints LOW — and the honest reason it might be fine

`no-ssrf` flags HTTP calls where the URL argument's _name_ looks
user-supplied (`userUrl`, `req.query.endpoint`, `targetUri`) — a classic
[Server-Side Request Forgery](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
setup, the bug class behind more than one well-known cloud metadata-endpoint
breach:

```js
// flagged — the *name* suggests user input, not a data-flow trace
async function fetchAvatar(userUrl) {
  return fetch(userUrl);
}
```

The rule's own metadata: `cwe: 'CWE-918'`, `cvss: 9.1` — squarely in the
Critical band. The message it prints: `severity: 'LOW'`.

Here's the part that's genuinely defensible: the rule's own doc comment
calls itself out as **"a naming heuristic, not data-flow analysis."** It
matches on identifier names, not on whether the value actually reaches an
attacker-influenced source. That's a real limitation — plenty of
`userUrl`-named parameters are perfectly safe, admin-configured constants.
A low-confidence match that could be a
[false positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn)
_does_ deserve a lower-urgency label than a rule that traced the actual
[taint](https://ofriperetz.dev/articles/taint-vs-heuristic-detection).

The part that isn't defensible: **confidence and impact are two different
axes, and `severity` is only supposed to encode one of them.** "How sure are
we this is real" and "how bad is it if it's real" are independent
questions — a low-confidence match on a 9.1-impact bug is still worth
_more_ attention than a high-confidence match on a 3.0. Collapsing both into
one `LOW`/`MEDIUM`/`HIGH`/`CRITICAL` string means the reader can't tell
which axis they're looking at, and a `grep`-based triage pass (or an
LLM agent doing the same) will deprioritize a Critical-impact finding on the
strength of a label that was only ever describing detection confidence.

## Case 2: a 9.8 with no heuristic excuse at all

`require-audience-validation` and `require-issuer-validation` aren't naming
heuristics — they check one deterministic fact: does a `jwt.verify()` call
pass an `audience` (or `issuer`) option? Yes or no, no ambiguity:

```js
// flagged — no audience claim checked
jwt.verify(token, publicKey);

// not flagged
jwt.verify(token, publicKey, { audience: "https://api.example.com" });
```

Skip audience validation and a JWT minted for _any_ service that trusts the
same signing key gets accepted by _this_ service too — a textbook confused
deputy, [CWE-287](https://cwe.mitre.org/data/definitions/287.html),
`cvss: 9.8`. Same story on the issuer side. Both rules print `severity:
'MEDIUM'`.

There's no false-positive story to hide behind here — the check is exact.
9.8 is a hair under the maximum a CVSS score can reach. `MEDIUM` sits two
whole bands below where that number lives. If a reader — or a CI gate that
filters on severity string instead of CVSS number — treats `MEDIUM` findings
as "fix this sprint," a near-maximum-severity auth bypass just got queued
behind a color contrast warning.

## Case 3: the one that runs the other way

Not every mismatch under-states. [`no-unsafe-search-path`](https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack)
— the PostgreSQL `search_path` hijacking rule I wrote up in full elsewhere —
ships `cvss: 7.5` (High band) but prints `severity: 'CRITICAL'`, one band
_above_ its own score. I won't re-run the attack walkthrough here — the
short version, if a label disagreeing with a number bothers you as much as
it bothers me: read that piece for the exploit, come back here for why the
label drifted in the first place.

## Why this happens: `severity` is the one field nobody enriches

Every rule funnels its message through one formatter,
`formatLLMMessage()`, and every formatter call goes through the same
enrichment step first:

```ts
// packages/eslint-devkit/src/messaging/formatters.ts
function enrichFromCWE(options) {
  if (!options.cwe) return options;
  const cweData = CWE_MAPPING[options.cwe];
  if (!cweData) return options;

  return {
    ...options,
    owasp: options.owasp ?? cweData.owasp,
    cvss: options.cvss ?? cweData.cvss,
    compliance: options.compliance ?? CWE_COMPLIANCE_MAPPING[options.cwe],
  };
}
```

There's a canonical lookup table, `CWE_MAPPING`, and it's _correct_ — its
entry for `CWE-918` is `{ cvss: 9.1, severity: 'CRITICAL' }`, internally
consistent, right band. `CWE-287` maps to `{ cvss: 9.8, severity:
'CRITICAL' }`. If every rule simply deferred to this table, none of the 33
mismatches would exist.

But look at what `enrichFromCWE` actually forwards: `owasp`, `cvss`,
`compliance` — and that's the whole list. **`severity` isn't in it.** Every
`cvss` number in our output either comes from this vetted table or from an
explicit override that a human cross-checked against it. Every `severity`
string is whatever word the rule's author typed into that one call site,
with nothing checking it against the table, the CVSS number, or any other
rule's choice for the same CWE. Two rules can share a CWE, share a CVSS
score, and print two different severity words, and nothing in the pipeline
would ever notice.

That's the actual bug: not "someone mislabeled 33 rules," but "the schema
has a field with no source of truth." Free-text fields drift; that's what
they do when nothing enriches them. The fix is the same one-line pattern
already applied to `owasp` and `cvss` — default `severity` from
`CWE_MAPPING[cwe].severity` unless a rule explicitly overrides it, the same
`options.severity ?? cweData.severity` fallback the other three fields
already get. I've filed it; it hasn't shipped as of this writing, and I'd
rather say that than quietly imply it's fixed.

## The audit, if you want to run it yourself

Point this at any rule set that ships CVSS numbers and severity strings —
ours included — and it'll tell you exactly where they disagree:

```ts
// audit-severity-drift.ts — flags rules where severity doesn't match its own CVSS band
import { readFileSync, globSync } from "node:fs";

const BANDS = [
  [9.0, 10.01, "CRITICAL"],
  [7.0, 9.0, "HIGH"],
  [4.0, 7.0, "MEDIUM"],
  [0.0, 4.0, "LOW"],
] as const;

const bandFor = (cvss: number) =>
  BANDS.find(([lo, hi]) => cvss >= lo && cvss < hi)?.[2] ?? "?";

for (const file of globSync("packages/eslint-plugin-*/src/rules/*/index.ts")) {
  const src = readFileSync(file, "utf-8");
  const cvss = src.match(/cvss:\s*([\d.]+)/)?.[1];
  const severity = src.match(/severity:\s*'([A-Z]+)'/)?.[1];
  if (!cvss || !severity) continue;

  const expected = bandFor(Number(cvss));
  if (expected !== severity) {
    console.log(`${file}: CVSS ${cvss} → ${expected}, shipped ${severity}`);
  }
}
```

203 rule files scanned, 33 flagged — an 84% clean rate I'd rather publish
honestly than round up. And that rate is itself a snapshot: the rule sources
as they stood when this published (2026-07-06), spread across the ecosystem's
twenty-odd independently-versioned plugins, not one pinned release. The
article's own thesis applies to its own numbers — a printed audit is a cache
too. Re-run the script against today's checkout and trust that count over
mine.

## Reading a severity label like a security engineer, not a triage bot

None of this is specific to our plugins — it generalizes to any tool that
prints a severity word next to a CVSS number, including the ones you didn't
write:

1. **The number is the primary source. The word is a cache of it, and
   caches go stale.** If a `CRITICAL`/`HIGH`/`MEDIUM`/`LOW` string and a
   CVSS score disagree, trust the score — it's the one with a formula
   behind it, not a human's word choice.
2. **CWE tells you the shape of the bug, not how loudly to worry.** "This is
   a `CWE-918` (SSRF)" is a fact about the code. It says nothing about
   _this instance's_ severity until a CVSS vector is computed for it
   specifically.
3. **A low-confidence detector and a low-impact bug produce the same label
   and mean opposite things.** If a tool's docs mention "heuristic" anywhere
   near a `LOW`, ask whether `LOW` is describing the bug or the detector's
   certainty — they're rarely the same axis, and only one of them tells you
   whether to actually go read the code.
4. **Don't build a CI gate on the adjective.** `severity !== 'CRITICAL'`
   as a merge-blocking filter inherits every mislabel in the tool it's
   reading from. Gate on the CVSS number, or on the CWE list you've decided
   matters, not on a string a human typed by hand.

## The config

```bash
npm install --save-dev eslint-plugin-node-security eslint-plugin-jwt
```

```js
import nodeSecurity from "eslint-plugin-node-security";
import jwt from "eslint-plugin-jwt";

export default [nodeSecurity.configs.recommended, jwt.configs.recommended];
```

Both plugins print the CWE/CVSS/OWASP line on every finding — that's what
made this audit possible to run against our own output in the first place.
[Getting started with eslint-plugin-node-security](https://ofriperetz.dev/articles/getting-started-eslint-plugin-node-security)
and [getting started with eslint-plugin-jwt](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt)
cover the rest of what each ships.

---

I'm not writing this to talk our own numbers down — 84% of 203 rules
printing a severity word that matches their own CVSS band is a real bar,
and I'd take it over a tool that doesn't print a CVSS number at all and so
never gets caught disagreeing with itself. I'm writing it because "check
the number, not the adjective" is a rule I only started following rigorously
_after_ writing the script that caught my own tool getting it wrong three
different ways in three different rules.

**Your turn:** open whatever security linter you already run, pick one
finding, and look up its CVSS vector by hand. If the vector notation is new,
[what a CVSS score actually measures](https://ofriperetz.dev/articles/cvss-scores-explained)
walks the AV/AC/PR/UI fields — and why severity, exploit probability, and
confirmed exploitation are three separate measurements with three separate
owners. Does the severity word next to it still hold up once you've done the
math yourself?

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if you've ever trusted a severity label more than the score behind it.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
