---
devto_url: "https://dev.to/ofri-peretz/what-ground-truth-caught-that-unit-tests-missed-3-real-bugs-in-9-flagship-lint-rules-o0b"
devto_id: 3667300
title: "A 5KB corpus that runs in 3 seconds found 3 bugs months of unit tests missed"
description: "Nine flagship ESLint rules. Months of green unit tests, weeks of OSS benchmarking. A 5KB ground-truth corpus failed three of them at F1=1.00 the first time we ran it — including the exact patterns AI assistants emit. Three diagnostics, three fixes, one CI gate."
published: true
tags:
  - "eslint"
  - "testing"
  - "ai"
  - "security"
canonical_url: "https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed"
cover_image: "https://media2.dev.to/dynamic/image/width=1200,height=627,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2F49iz3bb9eg4zte81hhqn.png"
series: "Inside our linter benchmarks"
---

Three of our flagship ESLint rules had green unit tests for months and had been benchmarked against peer plugins on real OSS for weeks. Then a 5KB corpus that runs in 3 seconds failed all three the first time we ran it. Two of the three bugs were on the exact patterns an AI assistant emits by default.

Here's how that gate works. We added a `npm run ilb:flagship:smoke` step to the `quality` script. It's small: for each flagship rule with a labeled corpus, run the rule against `vulnerable/*` (must fire) and `safe/*` (must stay silent). Compute precision, recall, F1. Fail the build below F1=1.00.

The first run hit nine rules. Six passed. Three failed.

| Rule                                           | Result               | What broke                                                                       |
| :--------------------------------------------- | :------------------- | :------------------------------------------------------------------------------- |
| `react-features/hooks-exhaustive-deps`         | P=67% R=100% F1=0.80 | False positive on the standard `.then((r) => r.json())` pattern                  |
| `mongodb-security/no-unsafe-query`             | P=100% R=50% F1=0.67 | Missed `$where` injection via template-literal interpolation                     |
| `vercel-ai-security/no-unsafe-output-handling` | P=— R=0% F1=—        | Found nothing in `const { text } = await generateText(...); el.innerHTML = text` |

All three rules had passing unit-test suites. All three had been benchmarked alongside peer plugins on real OSS for weeks. None of those signals would have surfaced these bugs.

What did surface them: 14 fixtures across 3 corpora — 12 lines of code per corpus on average — labeled with `// This MUST be detected` or `// This MUST NOT fire` comments and run through the same lint config a real user would have.

## Bug #1: hooks-exhaustive-deps fires on inner-callback parameters

The fixture:

```tsx
import { useEffect, useState } from "react";

export function Profile({ userId }: { userId: string }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then((r) => r.json())
      .then(setData);
  }, [userId]);
  return <div>{JSON.stringify(data)}</div>;
}
```

This is the canonical "fetch on user-id change" pattern. `userId` is closed over and listed in deps. `r` is a parameter of the `.then()` callback — local to that arrow function, not a closure.

Our rule fired:

```text
React Hook useEffect has missing dependencies: r
```

Tracing into the source, `extractLocallyDeclaredIdentifiers` walked the effect body, collected `VariableDeclaration` and `FunctionDeclaration` names, but **didn't collect `params` of nested `ArrowFunctionExpression` / `FunctionExpression`**. Every callback parameter inside the effect was treated as a closure-from-outside.

Fix: when visiting a nested function node, add its `params` to the `declared` set:

```ts
if (
  n.type === "ArrowFunctionExpression" ||
  n.type === "FunctionExpression" ||
  n.type === "FunctionDeclaration"
) {
  for (const param of n.params) collectFromPattern(param);
}
```

`collectFromPattern` handles `Identifier`, `ObjectPattern` (with nested `Property` and `RestElement`), `ArrayPattern`, `RestElement`, and `AssignmentPattern` — destructured params, rest spreads, defaults. After the fix, the fixture passes.

The reason unit tests missed this: every test fixture in the suite used either a closure-only effect or an effect with a single top-level callback. None had `.then((r) => …).then((data) => …)` — the most common real-world shape.

## Bug #2: NoSQL injection via `$where` was invisible

The fixture:

```js
async function searchByName(req) {
  return db
    .collection("items")
    .find({
      $where: `this.name == '${req.query.name}'`,
    })
    .toArray();
}
```

This is a real NoSQL injection. `$where` evaluates JavaScript on the database server. With `req.query.name` interpolated unescaped, an attacker sends `name=' || true || '` and gets every record.

Our rule didn't fire. Walking the source:

```ts
function getNodeSource(node: TSESTree.Node): string {
  if (node.type === Identifier) return node.name;
  if (node.type === MemberExpression) /* …recurse */ ;
  if (node.type === Literal) return String(node.value);
  return "[expression]"; // ← TemplateLiteral hit this
}

function containsUserInput(node: TSESTree.Node): boolean {
  const code = getNodeSource(node);
  return USER_INPUT_PATTERNS.some((pattern) => code.includes(pattern));
}
```

When the value of `$where` was a `TemplateLiteral`, `getNodeSource` returned the literal string `'[expression]'`. Then `containsUserInput` checked whether `'[expression]'` contained `req.query` — it doesn't. Silent skip.

The fix is to recurse into composite expressions instead of stringifying them:

```ts
function containsUserInput(node: TSESTree.Node): boolean {
  if (node.type === TemplateLiteral) {
    return node.expressions.some(containsUserInput);
  }
  if (node.type === BinaryExpression) {
    return containsUserInput(node.left) || containsUserInput(node.right);
  }
  if (node.type === CallExpression) {
    return (
      containsUserInput(node.callee) ||
      node.arguments.some(
        (a) => a.type !== "SpreadElement" && containsUserInput(a),
      )
    );
  }
  if (node.type === MemberExpression) {
    return USER_INPUT_PATTERNS.some((p) => getNodeSource(node).includes(p));
  }
  return false;
}
```

`TemplateLiteral`, `BinaryExpression` (string concat), and `CallExpression` (e.g. `.toString()` chains, `String(req.x)`, `JSON.stringify(req.body)`) are all routes for tainted data into a query. Each gets recursed into now.

Why the unit tests missed it: the existing test corpus had `find({ x: req.body.x })` shapes — direct user input as a property value. That shape gets caught by `isUnsafePropertyValue`'s `MemberExpression` branch. The `$where` template literal is _also_ user input, but expressed differently — and the pattern-matching code path didn't recurse far enough to see it.

## Bug #3: AI-output detection missed the standard SDK pattern

The fixture:

```ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

async function render(prompt: string, target: HTMLElement) {
  const { text } = await generateText({ model: openai("gpt-4"), prompt });
  target.innerHTML = text; // ← LLM output flows directly into innerHTML
}
```

This is straight from the Vercel AI SDK's official documentation. `const { text } = await generateText(...)` is the destructured pattern every example uses.

Our rule fired on nothing. The detection model:

```ts
const aiOutputPatterns = [
  "result.text",
  "response.text",
  "completion",
  "generated",
  "aiOutput",
  "aiResponse",
  "llmOutput",
  ".text",
];

function isLikelyAIOutput(node: TSESTree.Node): boolean {
  const text = sourceCode.getText(node);
  return aiOutputPatterns.some((pattern) => text.includes(pattern));
}
```

When the rule visits `target.innerHTML = text`, the right-hand side is the bare identifier `text`. The string `'text'` doesn't match `'result.text'`, `'response.text'`, or `'.text'` (which all require a member-access prefix). So `isLikelyAIOutput` returns false. No diagnostic.

The pattern list assumes the LLM result is referenced as a property of an object. But the destructured pattern produces a free identifier. Two completely valid sources, only one detectable.

The fix is to add scope tracking — record any local variable bound from a known AI SDK call, and treat references to those as AI output:

```ts
const aiBoundNames = new Set<string>();
const AI_SDK_CALLS = new Set([
  "generateText",
  "streamText",
  "generateObject",
  "streamObject",
]);

function isAISDKCall(node: TSESTree.Expression): boolean {
  let target = node;
  if (target.type === "AwaitExpression") target = target.argument;
  if (target.type !== "CallExpression") return false;
  const callee = target.callee;
  if (callee.type === "Identifier" && AI_SDK_CALLS.has(callee.name))
    return true;
  if (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier" &&
    AI_SDK_CALLS.has(callee.property.name)
  )
    return true;
  return false;
}

return {
  VariableDeclarator(node) {
    if (!node.init || !isAISDKCall(node.init)) return;
    if (node.id.type === "Identifier") {
      aiBoundNames.add(node.id.name);
    } else if (node.id.type === "ObjectPattern") {
      for (const prop of node.id.properties) {
        if (prop.type === "Property" && prop.value.type === "Identifier") {
          aiBoundNames.add(prop.value.name);
        }
      }
    }
  },
  // …
};
```

Now both `const result = await generateText(...)` (binding `result` → access via `result.text`) and `const { text } = await generateText(...)` (binding `text` directly) flow into `aiBoundNames`. The `isLikelyAIOutput` check picks them up by referenced identifier, regardless of how the user destructured.

Why the unit tests missed it: the test corpus used `result.text` patterns, matching `'result.text'` in the patterns list literally. The destructured pattern was never in the test suite — even though it's the more common shape in production code.

## The uncomfortable part: two of these three blind spots are exactly what AI writes

Re-read the fixtures with one question in mind: _what does an AI assistant produce when you ask it for this?_

- Ask any model for "fetch user data in a `useEffect`" and you get `.then((r) => r.json())` — the inner-callback shape that bug #1 false-positived on.
- Ask for "render the model's response into the page" and you get `const { text } = await generateText(...)` straight from the Vercel AI SDK docs, then `el.innerHTML = text` — the destructure-into-sink that bug #3 was blind to.

That's not a coincidence. AI assistants are trained on the canonical documentation examples, so they emit the canonical shapes — the same shapes a rule author, writing tests from their own mental model, is least likely to enumerate. The result is a specific, repeatable failure: **the rule has its widest blind spot exactly where AI-generated code is densest.** A team that adopts a security linter to backstop AI output is, by default, trusting the rule on the one input distribution it was never tested against.

This is the same thread I keep pulling on from the other direction — [I let Claude write 60 functions and 65–75% had security vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities), and [Claude wrote a NestJS service; ESLint found 6 security holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes). There the AI shipped the vulnerability. Here the AI ships a vulnerability the linter _silently waves through_. Both failure modes only surface when your fixtures are written from the patterns code actually takes — not the ones you imagined.

If you want to reproduce this without our corpus: paste the three fixtures above into a file, point your model of choice at the same three prompts, and diff what it generates against what your linter flags. The gap is the test you were missing.

## What this whole episode is really about

Three rules. Three bugs. All caught by ground truth, none by unit tests. The pattern across them is the same:

**Unit tests verify that the rule does what its author thought it should do.** The author wrote the test, the author writes the rule, the same mental model produces both. If the author didn't think of the `.then((r) => …)` pattern, neither the rule nor the tests cover it. The tests pass; the rule has a hole.

**Ground-truth corpora verify that the rule does what the world needs it to do.** The fixtures are written from real CVE shapes, real framework documentation, real production codebases. They don't match the rule's mental model — they match the user's. Mismatches surface as F1<1.00.

And this is why these bugs survived code review, not just unit tests. When I reviewed each of these rules, I had two green signals in front of me: a passing test suite and a clean run against peer plugins on real OSS. Two independent checks, both green — that is normally enough to approve. What I couldn't see from the diff was that both signals shared the same blind spot. The unit tests encoded the author's mental model; the OSS sweep happened not to contain the `$where`-template or destructured-`generateText` shapes in the sampled files. Two green checks that fail the same way look exactly like two green checks that pass. The corpus was the first signal with an _independent_ source of truth — documentation, not the author — so it was the first one that could disagree.

The fixtures in our suite are tiny — 12 to 18 lines per corpus, 4 fixtures each. The total disk cost is under 5KB. They run in ~3 seconds total. They caught three bugs the unit tests had missed across months of development.

**A 5KB corpus that runs in 3 seconds found bugs hundreds of unit tests missed.** That should change how you think about "what does it mean to test a static-analysis rule."

Three concrete takeaways for any team writing or shipping linters:

**Write fixtures from documentation, not from your tests.** When you start a new rule, open the canonical docs for the pattern (CVE description, framework doc, OWASP example). Copy the example into a fixture _before_ writing the rule. If the rule passes the fixture later, you've shipped a feature; if it doesn't, you've found a bug before users do.

**Make the corpus a CI gate.** Unit tests verify _implementation_; corpus tests verify _behavior_. Treating them as the same kind of test means one of them will atrophy. Run both, fail the build on either.

**Surface the failures with confusion-matrix detail.** "Test failed" is one bit. "F1 = 0.67, TP=1 FP=0 FN=1 TN=2 — `where-string.js` did not fire" is the actual diagnostic. The test framework should output the matrix, not just the boolean. Triage time goes from 15 minutes to 30 seconds.

If you just want the three fixed rules in your own pipeline — including the `$where` and destructured-`generateText` detection that shipped with these patches — install the plugins and turn the rules on:

```bash
npm i -D eslint-plugin-react-features eslint-plugin-mongodb-security eslint-plugin-vercel-ai-security
```

```js
// eslint.config.js (flat config)
import reactFeatures from "eslint-plugin-react-features";
import mongodbSecurity from "eslint-plugin-mongodb-security";
import vercelAiSecurity from "eslint-plugin-vercel-ai-security";

export default [
  {
    plugins: {
      "react-features": reactFeatures,
      "mongodb-security": mongodbSecurity,
      "vercel-ai-security": vercelAiSecurity,
    },
    rules: {
      "react-features/hooks-exhaustive-deps": "error",
      "mongodb-security/no-unsafe-query": "error",
      "vercel-ai-security/no-unsafe-output-handling": "error",
    },
  },
];
```

New to these plugins? The per-rule docs and quick-starts live here: [vercel-ai-security](https://ofriperetz.dev/articles/getting-started-eslint-plugin-vercel-ai-security) and [mongodb-security](https://ofriperetz.dev/articles/getting-started-eslint-plugin-mongodb-security).

The three fixes here are in [`packages/eslint-plugin-react-features`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-react-features), [`eslint-plugin-mongodb-security`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-mongodb-security), and [`eslint-plugin-vercel-ai-security`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-vercel-ai-security). The corpora are in [`benchmarks/corpus/`](https://github.com/ofri-peretz/eslint/tree/main/benchmarks/corpus). The smoke gate is [`benchmarks/suites/ilb-flagship/smoke.ts`](https://github.com/ofri-peretz/eslint/blob/main/benchmarks/suites/ilb-flagship/smoke.ts) and it runs in three seconds.

Three seconds. Three bugs. Months of "fully tested." Pick which signal you trust.

What's the bug that got past your green test suite — the one a single fixture copied from the docs would have caught the day the rule shipped? I want to hear it in the comments.

## Two more from the same bench, written up separately

This piece is part of the _Inside our linter benchmarks_ series. The smoke gate caught the three above. The full ILB-Flagship sweep on 45K+-star OSS repos exposed two more rule bugs the same week — both deeper algorithmic stories than fit here:

- **[no-cycle finds 0 cycles in next.js (and other lies caches tell you)](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale)** — our `import-next/no-cycle` reported 0 cycles on next.js's 14K-file repo. A 33-file subset of the _same_ repo, same rule, same config: 5+ cycles. The bug was a DFS cache that encoded "depth limit hit" as "proven acyclic," and the cascade swallowed 245 files.
- **[When entropy isn't enough: how 807 credential "findings" turned out to be type names](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough)** — `no-hardcoded-credentials` reported 842 findings on vercel/ai. 807 were TypeScript union-type literals and error class names. The fix split detection into structural vs ambiguous patterns with a credential-named context gate.

Both bugs survived months of unit-test coverage. Both fell to ground-truth fixtures + bench data. Same lesson, two more receipts.

---

## 📊 About the author

I'm Ofri Peretz, building the Interlace ESLint ecosystem — a JavaScript static-analysis catalog that runs under ESLint and Oxlint with CI-enforced parity.

- 🔗 [Portfolio & live metrics](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=ilb-ground-truth)
- 📦 [The Interlace ESLint plugins on npm](https://npmjs.com/~ofriperetz)
- 🐙 [GitHub: ofri-peretz/eslint](https://github.com/ofri-peretz/eslint)
- 📈 [Live impact dashboard](https://ofriperetz.dev/stats?utm_source=devto&utm_medium=article&utm_campaign=ilb-ground-truth)

{% user ofri-peretz %}
