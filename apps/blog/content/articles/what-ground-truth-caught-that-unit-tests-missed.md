---
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/what-ground-truth-caught-that-unit-tests-missed.jpg"
devto_url: "https://dev.to/ofri-peretz/what-ground-truth-caught-that-unit-tests-missed-3-real-bugs-in-9-flagship-lint-rules-o0b"
devto_id: 3667300
title: "2 of 3 bugs a 5KB corpus caught were the exact shapes AI writes by default"
description: "Nine flagship ESLint rules. Months of green unit tests, weeks of OSS benchmarking. A 5KB ground-truth corpus failed three of them at F1=1.00 the first time we ran it — and two of the three blind spots are the exact patterns AI assistants emit. Three diagnostics, three fixes, one CI gate, and why both green signals shared one hole."
published: true
tags:
  - "security"
  - "node"
  - "devsecops"
  - "eslint"
canonical_url: "https://ofriperetz.dev/articles/what-ground-truth-caught-that-unit-tests-missed"
tier: "T3"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/what-ground-truth-caught-that-unit-tests-missed.jpg"
series: "Inside our linter benchmarks"
---

Our test suite was green. Our CI was green. Then [ground-truth](https://ofriperetz.dev/articles/ground-truth-in-security-testing) fixtures caught three bugs those two signals had carried for months — two rules that silently _missed_ a real vulnerability, one that _fired on safe code_. Here's the specific difference between unit-test coverage and ground-truth coverage.

Three of our flagship ESLint security rules had passing unit tests for months and had been benchmarked against peer plugins on real OSS for weeks. Then a 5KB corpus — 12 fixtures, runs in 3 seconds — failed all three the first time we ran it. None of the prior signals had flinched.

Here's the number that makes this concrete: **3 ground truth findings, all 3 had passing unit tests, 2 had 100% unit test branch coverage.** The unit tests were not inadequate — they were complete. They just validated the wrong thing.

**100% unit-test coverage and three shipped rule bugs — two of them missed vulnerabilities — aren't contradictory. Mocks are the gap between them.**

The reason that should worry you before you read a single fix: each rule's widest blind spot sat exactly where AI-generated code is densest. These are security rules teams adopt to backstop AI output — and they were silently trusting the one input distribution they were never tested against.

**Skip to:** [Bug #1 — false positive on AI's default fetch](#bug-1) · [Bug #2 — `$where` injection goes invisible](#bug-2) · [Bug #3 — the AI-output XSS](#bug-3) · [Why AI writes exactly these shapes](#ai-shapes) · [Install the 3 fixed rules](#the-config)

## Why "green unit tests" isn't "tested against the real world"

Unit tests verify that the rule does what its author thought it should do. Ground truth verifies that the rule does what the world needs it to do. Those are different questions, and for security rules, the difference kills you.

The crisp version:

- **Unit test**: mock input `{ x: req.body.x }` fires the `no-unsafe-query` rule → test passes.
- **Ground truth**: the real injection shape `$where: \`...${req.query.name}...\`` doesn't fire → vulnerability ships to production.

Both signals are green. One is wrong in exactly the way that matters.

Here's how that gate works. We added a `npm run ilb:flagship:smoke` step to the `quality` script. It's small: for each flagship rule with a labeled corpus, run the rule against `vulnerable/*` (must fire) and `safe/*` (must stay silent). Compute [precision, recall, F1](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis). Fail the build below F1=1.00.

The first run hit nine rules. Six passed. Three failed.

| Rule                                           | Result               | What broke                                                                       |
| :--------------------------------------------- | :------------------- | :------------------------------------------------------------------------------- |
| `react-features/hooks-exhaustive-deps`         | P=67% R=100% F1=0.80 | False positive on the standard `.then((r) => r.json())` pattern                  |
| `mongodb-security/no-unsafe-query`             | P=100% R=50% F1=0.67 | Missed `$where` injection via template-literal interpolation                     |
| `vercel-ai-security/no-unsafe-output-handling` | P=— R=0% F1=—        | Found nothing in `const { text } = await generateText(...); el.innerHTML = text` |

All three rules had passing unit-test suites. All three had been benchmarked alongside peer plugins on real OSS for weeks. None of those signals would have surfaced these bugs.

What did surface them: 12 fixtures across 3 corpora — 4 per corpus, 12 to 18 lines each — labeled with `// This MUST be detected` or `// This MUST NOT fire` comments and run through the same lint config a real user would have.

## Bug #1: hooks-exhaustive-deps fires on inner-callback parameters {#bug-1}

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

**Why unit test #31 passed while the real pattern failed:** the test fixture used a closure-only effect — `useEffect(() => { setData(userId); }, [userId])` — and validated that `userId` must be in deps. Test #31 passed with green. But test #31's mock never had `.then((r) => r.json())`. The author's mental model didn't include nested callback parameters. The rule and the test shared the same blind spot — so both stayed green while the [false-positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) shipped.

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

## Bug #2: NoSQL injection via `$where` was invisible {#bug-2}

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

**Unit test: mock input `find({ x: req.body.x })` fires the rule → test passes. Ground truth: the real injection `$where: \`...${req.query.name}...\`` doesn't fire → the SQL-equivalent vulnerability ships.** The test corpus had `find({ x: req.body.x })` shapes — direct user input as a property value. That shape gets caught by `isUnsafePropertyValue`'s `MemberExpression` branch. The `$where`template literal is _also_ user input, but expressed differently. The pattern-matching code path was never tested against`TemplateLiteral`as the value node. 100% branch coverage of the`getNodeSource`function, zero coverage of the`TemplateLiteral` branch that didn't exist yet — and the test suite couldn't tell the difference.

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

`TemplateLiteral`, `BinaryExpression` (string concat), and `CallExpression` (e.g. `.toString()` chains, `String(req.x)`, `JSON.stringify(req.body)`) are all routes for [tainted data](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) into a query. Each gets recursed into now.

## Bug #3: AI-output detection missed the standard SDK pattern {#bug-3}

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

**Unit test: `el.innerHTML = result.text` fires the rule → test passes. Ground truth: `const { text } = await generateText(...); el.innerHTML = text` doesn't fire → XSS vulnerability ships.** The test corpus used `result.text` patterns, matching `'result.text'` in the patterns list literally. The destructured pattern was never in the test suite — even though it's the more common shape in production code copied from the official SDK docs. The test for `isLikelyAIOutput` had full branch coverage. The uncovered case was the variable binding from a destructured SDK call — which requires scope tracking, not string matching.

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

## The uncomfortable part: two of these three blind spots are exactly what AI writes {#ai-shapes}

Re-read the fixtures with one question in mind: _what does an AI assistant produce when you ask it for this?_

- Ask any model for "fetch user data in a `useEffect`" and you get `.then((r) => r.json())` — the inner-callback shape that bug #1 false-positived on.
- Ask for "render the model's response into the page" and you get `const { text } = await generateText(...)` straight from the Vercel AI SDK docs, then `el.innerHTML = text` — the destructure-into-sink that bug #3 was blind to.

That's not a coincidence. AI assistants are trained on the canonical documentation examples, so they emit the canonical shapes — the same shapes a rule author, writing tests from their own mental model, is least likely to enumerate. The result is a specific, repeatable failure: **the rule has its widest blind spot exactly where AI-generated code is densest.** A team that adopts a security linter to backstop AI output is, by default, trusting the rule on the one input distribution it was never tested against.

This is the same thread I keep pulling on from the other direction — [I let Claude write 80 functions and 65–75% had security vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities), and [Claude wrote a NestJS service; ESLint found 6 security holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes). There the AI shipped the vulnerability. Here the AI ships a vulnerability the linter _silently waves through_. Both failure modes only surface when your fixtures are written from the patterns code actually takes — not the ones you imagined.

Before you adopt a security plugin to audit your AI-generated code, run the [30-minute onboarding audit](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) and check the plugin against real AI output shapes. And if you want to compare which plugin actually catches which patterns, the [benchmark of 17 ESLint security plugins](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) is the starting point.

And the shape of the AI output is not uniform across models, which makes this worse, not better. When I ran [700 AI-generated functions through 5 models and ranked them by security](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong), the rankings inverted the moment I [broke them down by domain](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain): the "most dangerous" model fixes 93% of the database vulnerabilities it writes, the "safest" fixes 45%. Different models favor different canonical shapes — so the same rule that's blind to Claude's preferred `const { text } = await generateText(...)` may sail through a different model's `result.text` and trip on a third's. A linter validated against one model's output distribution is not validated against the next model you swap in. The corpus is the only thing that holds the line, because its fixtures come from documentation — the source _every_ model is trained on — not from whichever assistant you happened to test with.

If you want to reproduce this without our corpus: paste the three fixtures above into a file, point your model of choice — Claude, GPT, Gemini, whatever your team ships on — at the same three prompts, and diff what it generates against what your linter flags. Run it across two or three models and the blind spots move; the gap between "what the model writes" and "what your linter catches" is the test you were missing.

The two AI-shape detections that shipped with these patches — the destructured-`generateText` sink and the `$where`-template injection — are turned on by the single install + config block [at the bottom of this article](#the-config).

The one line worth pasting into your team channel: **a security linter you adopted to backstop AI is, by default, untested on exactly the shapes that AI emits most.**

## Run the recipe on another model: the verdicts are deterministic

"Point your model of choice" isn't a hand-wave. The prose above says the blind spot moves with the model — here it is as a table. Each row pairs the documented default shape a model emits for that prompt with the rule's verdict on that shape, before and after the patch. The verdict columns aren't opinion; they're what the smoke gate's F1 computes on those exact shapes.

| Fixture / prompt                            | Documented default shape                        | Pre-patch rule        | Post-patch rule |
| :------------------------------------------ | :---------------------------------------------- | :-------------------- | :-------------- |
| "fetch user data in a `useEffect`"          | `.then((r) => r.json())` inner callback         | false positive on `r` | clean (pass)    |
| "search MongoDB by a name from the request" | `$where: \`...${req...}...\`` template          | silent miss (FN)      | fires (TP)      |
| "render the model's response into the page" | `const { text } = await generateText(...)` sink | silent miss (FN)      | fires (TP)      |

These are the documented defaults across the assistants I've measured — the same shape family from the [Claude-vs-Gemini NestJS run](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors) (Gemini 2.5 Flash, n=1 per toolchain) and the [four-domain dead-heat](https://ofriperetz.dev/articles/claude-vs-gemini-4-security-domains-dead-heat). The honest caveat, because it's the whole point: I have the per-domain generation rates at n=700, but a fixture-by-fixture run at statistical n is its own experiment — the companion writeup, not this one. What's not in doubt is the direction: swap the model, the blind spots relocate, and the documentation-sourced fixture holds the line because it's downstream of the docs every model trained on.

## What this whole episode is really about

Three rules. Three bugs. All caught by ground truth, none by unit tests. The pattern across them is the same:

**Unit tests verify that the rule does what its author thought it should do.** The author wrote the test, the author writes the rule, the same mental model produces both. If the author didn't think of the `.then((r) => …)` pattern, neither the rule nor the tests cover it. The tests pass; the rule has a hole.

**Ground-truth corpora verify that the rule does what the world needs it to do.** The fixtures are written from real CVE shapes, real framework documentation, real production codebases. They don't match the rule's mental model — they match the user's. Mismatches surface as F1<1.00.

And this is why these bugs survived code review, not just unit tests. When I reviewed each of these rules, I had two green signals in front of me: a passing test suite and a clean run against peer plugins on real OSS. Two independent checks, both green — that is normally enough to approve. What I couldn't see from the diff was that both signals shared the same blind spot. The unit tests encoded the author's mental model; the OSS sweep happened not to contain the `$where`-template or destructured-`generateText` shapes in the sampled files. Two green checks that fail the same way look exactly like two green checks that pass. The corpus was the first signal with an _independent_ source of truth — documentation, not the author — so it was the first one that could disagree.

The fixtures are tiny — 12 to 18 lines each, four per corpus, under 5KB on disk, ~3 seconds to run end to end.

**A 5KB corpus that runs in 3 seconds found three bugs that green unit tests had carried for months.** That should change how you think about "what does it mean to test a static-analysis rule."

Three concrete takeaways for any team writing or shipping linters:

**Write fixtures from documentation, not from your tests.** When you start a new rule, open the canonical docs for the pattern (CVE description, framework doc, OWASP example). Copy the example into a fixture _before_ writing the rule. If the rule passes the fixture later, you've shipped a feature; if it doesn't, you've found a bug before users do.

**Make the corpus a CI gate.** Unit tests verify _implementation_; corpus tests verify _behavior_. Treating them as the same kind of test means one of them will atrophy. Run both, fail the build on either.

**Surface the failures with confusion-matrix detail.** "Test failed" is one bit. "F1 = 0.67, TP=1 FP=0 FN=1 TN=2 — `where-string.js` did not fire" is the actual diagnostic. The test framework should output the matrix, not just the boolean. Triage time goes from 15 minutes to 30 seconds.

## The config {#the-config}

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

New to these plugins? The per-rule docs and quick-starts live at [eslint.interlace.tools](https://eslint.interlace.tools). See also: [vercel-ai-security getting started](https://ofriperetz.dev/articles/getting-started-eslint-plugin-vercel-ai-security) and [mongodb-security getting started](https://ofriperetz.dev/articles/getting-started-eslint-plugin-mongodb-security).

The three fixes here are in [`packages/eslint-plugin-react-features`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-react-features), [`eslint-plugin-mongodb-security`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-mongodb-security), and [`eslint-plugin-vercel-ai-security`](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-vercel-ai-security). The corpora are in [`benchmarks/corpus/`](https://github.com/ofri-peretz/eslint/tree/main/benchmarks/corpus). The smoke gate is [`benchmarks/suites/ilb-flagship/smoke.ts`](https://github.com/ofri-peretz/eslint/blob/main/benchmarks/suites/ilb-flagship/smoke.ts) and it runs in three seconds.

Three seconds. Three bugs. Months of "fully tested." Pick which signal you trust.

## Two more from the same bench, written up separately

This piece is part of the _Inside our linter benchmarks_ series — the smoke gate caught the three above. The full ILB-Flagship sweep on 45K+-star OSS repos exposed the same class of bug from the opposite direction, in two more rules:

- **[5 cycles invisible in 14,556 files — the cache bug that hid them](https://ofriperetz.dev/articles/import-next-no-cycle-reported-0-cycles-nextjs-we-found-why-and-fixed-it)** (and the [cache-poisoning-at-scale companion](https://ofriperetz.dev/articles/no-cycle-cache-poisoning-at-scale)) — our `import-next/no-cycle` reported 0 cycles on next.js's 14K-file repo, but found 5+ in a 33-file subset of the _same_ repo, same rule, same config. The bug was a DFS cache that encoded "depth limit hit" as "proven acyclic," and the cascade swallowed 245 files. A false _negative_, where these three were false negatives and a false positive.
- **The false-positive twin:** `no-hardcoded-credentials` fired 842 times on vercel/ai; 807 were TypeScript union-type literals and error class names, not secrets. Same root cause as bug #2 here — a detector matching on shape without enough context — just inverted. (Writeup pending; the benchmark methodology behind both is in [I ran 40 vulnerable patterns through 17 plugins](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared), which also covers what these rules do on AI-generated code.)

All of these survived months of unit-test coverage. All fell to ground-truth fixtures + bench data. Same lesson, more receipts: the test that disagrees with the author is the only one that can find the author's blind spot.

What's the worst discrepancy you've seen between test coverage and production security — the green CI run that was hiding something? Drop it in the comments.

---

_Part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_

---

## About the author

I'm Ofri Peretz, building the Interlace ESLint ecosystem — a JavaScript static-analysis catalog that runs under ESLint and Oxlint with CI-enforced parity.

- [Portfolio & live metrics](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=ilb-ground-truth)
- [The Interlace ESLint plugins on npm](https://www.npmjs.com/~ofri-peretz)
- [GitHub: ofri-peretz/eslint](https://github.com/ofri-peretz/eslint)
- [Live impact dashboard](https://ofriperetz.dev/stats?utm_source=devto&utm_medium=article&utm_campaign=ilb-ground-truth)

{% user ofri-peretz %}
