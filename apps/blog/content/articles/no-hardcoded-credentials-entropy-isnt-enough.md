---
title: "My credential rule reported 842 secrets in vercel/ai. The real count was 0."
description: "Our no-hardcoded-credentials rule fired 842 times on vercel/ai. The peer plugin fired 380. I assumed we had better recall — until I sampled. 807 of the 'extra' findings were TypeScript union-type literals, error class names, and the string 'test'. The real number of hardcoded credentials was zero. Here's how a context-blind regex becomes a context-aware detector — and why AI assistants keep regenerating the exact strings that fool it."
published: false
tags:
  - "security"
  - "eslint"
  - "ai"
  - "node"
canonical_url: "https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough"
cover_image: ""
series: "Inside our linter benchmarks"
---

A credential scanner that reports 842 secrets in a codebase with zero hardcoded secrets isn't cautious. It's broken. Mine was, and it took a peer plugin reporting less than half my count to make me check.

The flagship rule `secure-coding/no-hardcoded-credentials` runs alongside `eslint-plugin-no-secrets/no-secrets` on vercel/ai (the AI SDK) as part of our ILB-Flagship bench. Both rules see the same source. Findings count:

| Rule                                            | Findings on vercel-ai |
| :---------------------------------------------- | :-------------------: |
| `secure-coding/no-hardcoded-credentials` (ours) |        **842**        |
| `eslint-plugin-no-secrets/no-secrets` (peer)    |          380          |
| Both flagged (intersection)                     |          35           |
| Ours-only                                       |        **807**        |
| Peer-only                                       |          344          |

A 2.2× gap is the kind of number you'd want to publish — except every credential-detection rule has a precision problem, and the _direction_ of the gap matters. We sampled the 807 ours-only findings.

The top hits looked like this:

```ts
// packages/ai/src/agent/tool-loop-agent.ts:88
| 'experimental_onToolExecutionStart'    // ← TS union-type literal

// packages/ai/src/error/tool-call-not-found-for-approval-error.ts:3
const name = 'AI_ToolCallNotFoundForApprovalError';   // ← error class name

// packages/ai/src/generate-object/stream-object.test-d.ts:13
prompt: 'test'                            // ← test prompt argument
```

None of those are credentials. Our rule was firing on type names, error class names, and the literal string `"test"`. The 807-finding gap was 807 false positives.

### Why this survived code review

I wrote that regex. It passed review — my own, and the unit tests'. Here's the honest reason it shipped: every test fixture I fed it was a string that _looked_ like a secret. `sk_live_4eC39H…` (a redacted Stripe-shaped key). `AKIAIOSFODNN7EXAMPLE`. A real JWT. The regex caught all of them, the suite went green, and I shipped. The comment above the line even said `// any 32+-char alphanumeric with underscores/hyphens` — I read that as "32+ chars of randomness," because every example in front of me _was_ random. What I never wrote a test for was a 35-character string that's English. `experimental_onToolExecutionStart` is identifier-shaped, not credential-shaped, and a test suite built from positive examples never surfaces that gap. The rule didn't have a bug in the code I tested. It had a bug in the code I didn't.

This is the second flagship-bench finding to teach me a hard lesson: **a high findings count is meaningless without precision**. The first was when our `no-cycle` reported 0 findings on next.js — the real number was 245, see [the cache-poisoning article](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale). This one is the inverse: we reported plenty, almost all wrong.

## The two rules' algorithms

`eslint-plugin-no-secrets` uses a single signal: **Shannon entropy**. The rule walks every string literal and computes:

```js
function shannonEntropy(value) {
  const len = value.length;
  if (len === 0) return 0;
  const freq = {};
  for (const c of value) freq[c] = (freq[c] || 0) + 1;
  let entropy = 0;
  for (const c in freq) {
    const ratio = freq[c] / len;
    if (ratio > 0) entropy += -(ratio * Math.log2(ratio));
  }
  return entropy;
}
```

If entropy ≥ 4.0 (default `tolerance`), it reports. There's an opt-out `ignoreIdentifiers` deny-list and a path-shaped string filter (`./foo`, `node:fs`, `@scope/pkg` get skipped). That's it.

The model is: **high entropy ⇒ probably random ⇒ probably a credential**. It's a permissive heuristic that errs toward false positives. On vercel/ai it flagged 380 findings — including `"experimental_onLanguageModelCallStart"` (entropy 4.04, also a false positive).

Our rule used a different strategy: **regex shape matching**. We had patterns for AWS access keys (`AKIA[0-9A-Z]{16}`), JWT (`eyJ[…].eyJ[…].[…]`), OAuth (`ghp_[…]`, `gho_[…]`), DB connection strings (`mysql://user:pass@…`), and a generic API-key catchall:

```ts
// Generic API key pattern: any 32+-char alphanumeric with underscores/hyphens
if (/^[A-Za-z0-9_-]{32,}$/.test(value)) {
  return { isCredential: true, type: "API key" };
}
```

That last regex is the FP source. It matches:

- `experimental_onToolExecutionStart` (35 chars) ✓
- `AI_ToolCallNotFoundForApprovalError` (35 chars) ✓
- Any TypeScript identifier 32+ chars long ✓

Our pattern was supposed to encode "32+ chars of randomness." It actually encoded "32+ chars of identifier-shaped text" — which TypeScript codebases produce in abundance.

We also had a `commonPassword` literal-match list:

```ts
commonPassword: /^(?:password|admin|123456|qwerty|test|guest)$/i;
```

That's why `prompt: 'test'` fired. The rule didn't care that `test` is in a test file in a property called `prompt`. The regex matched, the rule fired.

## The fix: structural vs ambiguous, with context

The breakthrough was recognizing that **patterns aren't all equally trustworthy**. Some patterns are unambiguous — a JWT is a JWT, the shape is too specific to mean anything else. Others are weakly suggestive — a 32-char alphanumeric _might_ be a credential or might be a long enum value.

I split the patterns into two confidence tiers:

```ts
type CredentialConfidence = "structural" | "ambiguous";
```

**Structural patterns** report immediately. These are shapes that only fit one purpose:

- JWT (`eyJ…`)
- OAuth provider tokens (`ghp_…`, `gho_…`)
- AWS access key (`AKIA[16 chars]`)
- DB connection string (`protocol://user:pass@host`)
- User-supplied custom patterns

**Ambiguous patterns** require additional evidence. The generic 32+-char alphanumeric and the common-password literal-match are now classified ambiguous. They only report if the surrounding _identifier_ is also credential-named:

```ts
function isCredentialContext(node, parent): boolean {
  // const apiKey = '...' / let secret = '...'
  if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
    return matches(parent.id.name);
  }
  // obj.password = '...' / this.token = '...'
  if (parent.type === "AssignmentExpression" && parent.right === node) {
    const left = parent.left;
    if (
      left.type === "MemberExpression" &&
      left.property.type === "Identifier"
    ) {
      return matches(left.property.name);
    }
  }
  // { apiKey: '...', secret: '...' }
  if (parent.type === "Property" && parent.value === node) {
    if (parent.key.type === "Identifier") return matches(parent.key.name);
    if (parent.key.type === "Literal") return matches(parent.key.value);
  }
  return false;
}

const matches = (name) => {
  const lower = name.toLowerCase();
  return (
    CREDENTIAL_VARIABLE_NAMES.has(lower) ||
    lower.endsWith("apikey") ||
    lower.endsWith("secret") ||
    lower.endsWith("token") ||
    lower.endsWith("password") ||
    lower.endsWith("credential")
  );
};
```

The set covers `apiKey`, `api_key`, `API_KEY`, `secret`, `password`, `token`, `accessToken`, `clientSecret`, `connectionString`, `dbUrl` — the full cluster of names developers actually use for credentials.

So now:

- `'experimental_onToolExecutionStart'` matches the generic API-key regex → ambiguous → no credential context → **suppressed**.
- `const API_KEY = 'sk-live-abc123…'` matches the regex → ambiguous → context check sees `API_KEY` (lowercases to `api_key`, in the set) → **reports**.
- `password: 'SuperSecret123!'` doesn't match any regex → but the property key is `password` → context-positive path fires → **reports**.

The third case (context-positive) was new. The pre-fix rule only reported on regex matches. But a 15-character alphanumeric assigned to `password:` is clearly a credential by virtue of where it's stored, even with no recognizable shape. Adding the context-positive path closed that recall gap.

### Run the context-aware version

The tiering ships in `eslint-plugin-secure-coding`. Install it and turn the rule on — no extra config needed for the behavior above:

```bash
npm i -D eslint-plugin-secure-coding
```

```js
// eslint.config.js (flat config)
import secureCoding from "eslint-plugin-secure-coding";

export default [
  {
    plugins: { "secure-coding": secureCoding },
    rules: {
      // ambiguous patterns (generic 32+ alphanumeric, common passwords)
      // only fire inside a credential-named context; structural shapes
      // (JWT, AWS key, OAuth, DB URL) still report immediately.
      "secure-coding/no-hardcoded-credentials": "error",
    },
  },
];
```

Defaults that matter: `minLength: 8` (shorter strings are skipped), `allowInTests: false` (set it `true` to suppress findings in `*.test.*`/`*.spec.*`). If you have an in-house token prefix the structural tier doesn't know about, add it as a `customPattern` — custom patterns are trusted and report immediately, same tier as a JWT. Point it at your own AI-generated branch and see what comes back.

## The corpus result

We have a labeled CWE-798 fixture set: 2 vulnerable files, 2 safe files. Pre-fix:

| Stack                      | Precision | Recall |  F1  |
| :------------------------- | :-------: | :----: | :--: |
| Ours (pre-fix)             |   0.67    |  1.00  | 0.80 |
| `eslint-plugin-no-secrets` |   1.00    |  0.50  | 0.67 |

Post-fix:

| Stack           | Precision |  Recall  |    F1    |
| :-------------- | :-------: | :------: | :------: |
| Ours (post-fix) | **1.00**  | **1.00** | **1.00** |

But here's the catch — the recall stayed 1.00 because the labeled vulnerable cases use credential-named contexts (`const API_KEY`, `password:`). Our pre-fix rule was actually catching `password-in-config.js` for the _wrong reason_: it flagged the literal `'admin'` (the username, in `user: 'admin'`) as a "Common password," and the file-level recall counted that as a hit. Post-fix, `'admin'` is correctly suppressed (no credential context), and we catch the actual password value via the new context-positive path.

The corpus tested whether the file got flagged. It didn't test whether we flagged the _right line_. That's a gap worth fixing in the corpus methodology.

## What we lost — and didn't

On vercel/ai, post-fix:

- Findings dropped from **842 to 0**.
- All 807 ours-only FPs eliminated.
- The 35 "both" findings? Still gone. Sampling them: they were all in `.test.ts` files with `apiKey: 'secret'` patterns where `'secret'` is 6 chars (below `minLength` default 8) — not actual security issues, just test fixtures. Our `isTestFile` skip plus the length floor correctly handles them.

So the real recall change on vercel/ai was zero — there were no real hardcoded credentials to find. The 842-finding gap was 100% noise.

## Why this matters more in the age of AI codegen

vercel/ai is a hand-written human library, and it still buried my rule under 807 false positives. The reason was identifier density: a TypeScript codebase that names things `experimental_onToolExecutionStart` and `AI_ToolCallNotFoundForApprovalError` produces long, alphanumeric, underscore-laced strings by the hundred. That's precisely the texture of code an LLM emits — verbose, descriptively-named, type-literal-heavy. Run a context-blind credential regex over a folder of Claude- or Gemini-generated TypeScript and you don't get a security report; you get noise proportional to how thoroughly the model named its symbols. Precision collapses on exactly the code people are now generating fastest.

The other half is worse, and it's the half the context-positive path was built for. AI assistants don't just generate identifiers that _look_ like secrets — they cheerfully generate the real thing. Ask a model to "wire up the API client" and it will happily write `const apiKey = "sk-..."` inline, because the training data is full of quickstarts that do exactly that. I've watched it happen often enough to write a separate piece on autofixing it: [hardcoded secrets in AI-agent code](https://ofriperetz.dev/articles/hardcoded-secrets-ai-agents-autofix). A purely shape-based rule has a coin-flip shot at those — `sk-` prefixes it might know, a 15-char project password it won't. The `isCredentialContext` check catches them by the variable name (`apiKey`, `password`, `clientSecret`) regardless of the value's shape. Both halves of the AI-codegen problem — the identifier flood and the inline-secret habit — are the same gap: the rule has to know what a string is _for_, not just what it looks like.

If you want to reproduce this on AI output instead of vercel/ai, the methodology is identical: point the bench at a model-generated branch and diff the structural-only run against the context-tiered run. Same rule, same fixtures, swap the corpus. That's also the one-line pivot to a [Build with Gemini](https://dev.to/challenges) submission — generate the corpus with Gemini, measure precision before and after the context tiers, report the delta.

## Three lessons for credential-detection rules

**Patterns and entropy alone aren't enough.** Both signal "this looks random." Neither knows what the string is _for_. A long random string assigned to `const errorCode = …` isn't a credential; the same string assigned to `const apiKey = …` is. Without context the rule guesses, and on TypeScript code it guesses wrong.

**Confidence is part of the rule's contract.** Treating "JWT shape match" and "32+ alphanumeric chars" as equally credential-y is the flaw. Surface that distinction in code (the `confidence` field), and use it at the call site to decide whether additional evidence is required.

**Recall needs context-positive detection too.** A purely pattern-based rule can't catch `password: 'SuperSecret123!'` because the value has no signature. The credential is in the name, not the value. Once you have an `isCredentialContext` helper, you can fire on context alone for any string above a length floor — and you're now catching the right thing for the right reason.

The fix is in [packages/eslint-plugin-secure-coding/src/rules/no-hardcoded-credentials/index.ts](https://github.com/ofri-peretz/eslint/blob/main/packages/eslint-plugin-secure-coding/src/rules/no-hardcoded-credentials/index.ts). The bench is [`benchmarks/suites/ilb-flagship`](https://github.com/ofri-peretz/eslint/tree/main/benchmarks/suites/ilb-flagship).

What's the highest false-positive count you've ever gotten from a security scanner that turned out to be 100% noise — and how long did you trust the number before you sampled it? I trusted mine until a peer plugin reported less than half. Drop yours in the comments; I'd bet someone reading this is still trusting a 4-digit one.

Two more rule bugs from the same bench sweep, written up separately: [What ground truth caught that unit tests missed](https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed) (the smoke-gate piece on three more rules) and [no-cycle finds 0 cycles in next.js](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale) (DFS cache poisoning).

---

## 📊 About the author

I'm Ofri Peretz, building the Interlace ESLint ecosystem — a JavaScript static-analysis catalog that runs under ESLint and Oxlint with CI-enforced parity.

- 🔗 [Portfolio & live metrics](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=ilb-credentials-context-tiers)
- 📦 [eslint-plugin-secure-coding on npm](https://www.npmjs.com/package/eslint-plugin-secure-coding)
- 🐙 [GitHub: ofri-peretz/eslint](https://github.com/ofri-peretz/eslint)
- 📈 [Live impact dashboard](https://ofriperetz.dev/stats?utm_source=devto&utm_medium=article&utm_campaign=ilb-credentials-context-tiers)

{% user ofri-peretz %}
