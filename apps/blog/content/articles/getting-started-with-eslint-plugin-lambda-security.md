---
title: "AWS Lambda Security Bugs Your Serverless Functions Are Shipping — 14 Rules That Catch Them"
description: "Unvalidated event input, hardcoded credentials, Action:'*' IAM, sensitive data in logs — four Lambda vulnerabilities that survive code review and become account takeovers. 14 CWE-mapped ESLint rules that catch them in CI."
slug: "getting-started-with-eslint-plugin-lambda-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-lambda-security"
tier: "TUTORIAL"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-lambda-security-44h8"
devto_id: 3144087
published_at: "2026-01-02T19:26:45Z"
edited_at: "2026-07-05T00:00:00Z"
cover_image: "https://ofriperetz.dev/og/cover/getting-started-with-eslint-plugin-lambda-security"
social_image: "https://ofriperetz.dev/og/article/getting-started-with-eslint-plugin-lambda-security"
reading_time_minutes: 10
tags:
  - "security"
  - "node"
  - "devsecops"
  - "eslint"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Hardened Stack"
---

> **Lambda's event-driven model hides an attack surface that code review reliably misses — the same four bugs ship again and again because they look like ordinary code.**

Four patterns. Every one compiles. Every one passes tests. Every one passes review. Here's what each one actually does, why reviewers miss it, and the ESLint rule that catches it in CI.

---

## Bug 1: Unvalidated event input reaching a request

```ts
// ❌ no-user-controlled-requests (CWE-918, CVSS 9.1)
export const handler = async (event) => {
  const res = await fetch(event.queryStringParameters.callbackUrl);
  return { statusCode: 200, body: await res.text() };
};
```

**Why it survived review.** The `fetch` is a single line doing an ordinary thing — a webhook callback, a "fetch the user's avatar URL" feature. The reviewer isn't picturing the trust boundary that line sits inside: the function can reach VPC-internal services, and its own role credentials are sitting in `process.env` one reflected-`env` away. SSRF only reads as dangerous when you already hold the runtime's internal surface in your head. Reading a feature PR, that intuition isn't there. The line reads as "calls a URL," and "calls a URL" is not a red flag.

Here's the Lambda-specific nuance most write-ups get wrong: **Lambda has no EC2 metadata service.** There's no `169.254.169.254` handing out role credentials the way IMDSv1 does on an EC2 box. The execution role's keys are injected as environment variables — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`. So the SSRF that steals credentials is the one whose client can read `file:///proc/self/environ`, or a handler you can coax into echoing `process.env` — not the EC2 IMDS payload people reflexively block.

**The rule:** `no-user-controlled-requests` flags a request whose URL carries user-controlled input ([rule docs](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-user-controlled-requests)).

```ts
// ✅ allow-list the destination before you call it
const ALLOWED = new Set(["api.partner.com", "hooks.example.com"]);
const url = new URL(event.queryStringParameters.callbackUrl);
if (!ALLOWED.has(url.hostname)) throw new Error("destination not allowed");
const res = await fetch(url);
```

---

## Bug 2: Hardcoded credentials in environment configuration

```ts
// ❌ no-secrets-in-env / no-hardcoded-credentials-sdk (CWE-798)
export const handler = async (event) => {
  const client = new DynamoDBClient({
    credentials: {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    },
  });
  // ...
};
```

**Why it survived review.** Secrets in code look like configuration. A reviewer scanning a PR diff sees a string literal — not a privilege that, if leaked, gives an attacker durable access. The Lambda-specific danger is compounded: even secrets you put in Lambda environment variables (not hardcoded, "properly" externalized) are readable by anyone with `lambda:GetFunctionConfiguration` and are visible in the AWS console. One `console.log(process.env)` dumps them to CloudWatch forever. Entropy scanners often miss the assignment that matters because they scan for pattern rather than structure — why a structural AST rule beats a secret scanner here is the argument in [Hardcoded Secrets in AI-Generated Code, and the Autofix That Removes Them](https://ofriperetz.dev/articles/hardcoded-secrets-ai-agents-autofix).

**The rules:** `no-hardcoded-credentials-sdk` ([CWE-798](https://ofriperetz.dev/articles/cwe-taxonomy-explained)) catches AWS credentials hardcoded in SDK config. `no-secrets-in-env` (CWE-798) flags secrets assigned to environment variables.

```ts
// ✅ fetch secrets at runtime from Secrets Manager / SSM
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const sm = new SecretsManagerClient({});
const secret = await sm.send(new GetSecretValueCommand({ SecretId: "my-db-password" }));
```

---

## Bug 3: Missing IAM least-privilege in infrastructure code

```ts
// ❌ no-overly-permissive-iam-policy (CWE-732)
const policy = {
  Effect: "Allow",
  Action: "*",
  Resource: "*",
};
```

**Why it survived review.** The handler ships in application code; the IAM policy ships in a SAM/CDK/Serverless template that a different person reviews — often a platform engineer optimizing for "the deploy stops failing with AccessDenied," not for blast radius. Each half is locally reasonable. The chain is only visible when you hold both files at once, which no single reviewer does. That's the gap a linter closes: it reads the source AST, not the diff, and it doesn't get bored on line 4 of a 600-line PR.

The real stakes: stolen Lambda credentials are short-lived session tokens — but when the role policy contains `"Action": "*"`, those tokens do _anything_ in your account for their duration. A small SSRF becomes a full account takeover.

**The rule:** `no-overly-permissive-iam-policy` flags `"*"` in `Action`/`Resource` of IAM policy literals — the shape you write in SAM, CDK, the Serverless Framework, or inline policy objects ([rule docs](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-overly-permissive-iam-policy)).

```ts
// ✅ scope to exactly what the function needs
const policy = {
  Effect: "Allow",
  Action: ["s3:GetObject"],
  Resource: "arn:aws:s3:::my-bucket/*",
};
```

---

## Bug 4: Sensitive data written to logs

```ts
// ❌ no-env-logging + no-exposed-error-details (CWE-532, CWE-209)
export const handler = async (event) => {
  try {
    console.log("env:", process.env);   // dumps credentials to CloudWatch
    // ...
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.stack }), // stack trace in response
    };
  }
};
```

**Why it survived review.** Debug logging during development is routine. `console.log(process.env)` is the fastest way to verify configuration is wired up — and it persists to CloudWatch forever after the debug session ends. The stack trace in the error response is the mirror image: a well-intentioned "give the client enough to debug," which also gives an attacker the file paths, function names, and dependency versions they need to find the next exploit. Both patterns are so normal that reviewers read past them.

**The rules:** `no-env-logging` (CWE-532) catches `process.env` written to logs. `no-exposed-error-details` (CWE-209) catches `error.stack` returned in the HTTP response.

```ts
// ✅ log a structured message; return a generic response
export const handler = async (event) => {
  try {
    console.log("handler invoked", { requestId: event.requestContext?.requestId });
    // ...
  } catch (err) {
    console.error("handler error", { message: err.message });   // log detail
    return { statusCode: 500, body: JSON.stringify({ error: "internal error" }) }; // return generic
  }
};
```

---

## Here's the guard that catches all of this in CI

All four patterns — and ten more Lambda-specific rules — are caught by `eslint-plugin-lambda-security`. Add it once; it runs on every push.

```bash
npm install --save-dev eslint-plugin-lambda-security
```

```js
// eslint.config.js — `configs` is a NAMED export
import { configs } from "eslint-plugin-lambda-security";

export default [configs.recommended]; // all 14 rules, CWE-tagged
```

Findings carry the CWE, OWASP category, [CVSS score](https://ofriperetz.dev/articles/cvss-scores-explained), and a concrete fix instruction:

```text
src/handlers/proxy.ts
  4:21  error  🔒 CWE-918 OWASP:A01-Broken CVSS:9.1 | HTTP request URL contains user-controlled input from event.queryStringParameters. Attackers can access internal services or exfiltrate data. | CRITICAL
               Fix: Validate URL against allowlist before making request. Never use user input directly in URLs.
```

You can wire a cross-codebase protocol for what to do when this fires in
[The 30-Minute Security Audit: A Static Analysis Protocol for Onboarding](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase).

---

## The full rule set

All 14 rules are organized around the [OWASP Serverless Top 10](https://owasp.org/www-project-serverless-top-10/) and pinned to a CWE — the same CWE-as-the-unit approach used to map a whole codebase in [Mapping Your Codebase to the OWASP Top 10 with 247 ESLint Rules](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules).

| Rule                              | Catches                           | CWE     |
| --------------------------------- | --------------------------------- | ------- |
| `no-user-controlled-requests`     | SSRF via user-controlled URL      | CWE-918 |
| `no-overly-permissive-iam-policy` | `*` in IAM `Action`/`Resource`    | CWE-732 |
| `no-missing-authorization-check`  | handler with no authorization     | CWE-862 |
| `no-unvalidated-event-body`       | event body used unvalidated       | CWE-20  |
| `no-secrets-in-env`               | secrets in environment variables  | CWE-798 |
| `no-hardcoded-credentials-sdk`    | AWS creds hardcoded in SDK config | CWE-798 |
| `no-env-logging`                  | `process.env` written to logs     | CWE-532 |
| `no-exposed-error-details`        | stack traces in the response      | CWE-209 |
| `no-exposed-debug-endpoints`      | debug endpoints left enabled      | CWE-489 |
| `no-error-swallowing`             | empty `catch` hides failures      | CWE-390 |
| `no-permissive-cors-response`     | `Access-Control-Allow-Origin: *`  | CWE-942 |
| `no-permissive-cors-middy`        | permissive CORS via Middy         | CWE-942 |
| `no-unbounded-batch-processing`   | uncapped record processing → DoS  | CWE-770 |
| `require-timeout-handling`        | no fallback before hard timeout   | CWE-400 |

Two presets: `recommended` and `strict` — both enable all 14. Focused plugin; the sane default is everything.

---

## What happens when an AI assistant writes the handler

I wanted first-party numbers for this article instead of borrowing them, so I ran the experiment twice — and the second run found something I didn't expect.

```bash
# corpus + scan live in the benchmark suite. Model: claude-opus-4-7, June 2026.
node benchmarks/lambda-ai-corpus/scripts/generate.mjs              # 10 from-scratch handlers
node benchmarks/lambda-ai-corpus/scripts/generate.mjs prompts-terse.json generated-terse  # 10 "just make it work" edits
node benchmarks/lambda-ai-corpus/scripts/scan.mjs [generated|generated-terse]              # lambda-security over a corpus
```

**Run 1 — ten neutral, from-scratch prompts** ("write a Lambda that fetches a `callbackUrl` and returns the body," "give this function an IAM role to read/write S3"). The uncomfortable result: on the SSRF prompt the model did **not** hand me the naked `fetch(callbackUrl)`. It wrote a full `assertSafeUrl` guard — protocol allow-list, an explicit `169.254.169.254` block, DNS checks against private ranges, `redirect: 'error'`. Zero of ten handlers tripped any critical rule. Frontier defaults have genuinely moved — on a clean, explicit prompt, today's model often writes the hardened version.

**Run 2 — the same tasks, but phrased the way assistants are actually used under deadline**: "Quick one — fetch the `callbackUrl` and return the body, just make it work," "simple proxy, read `target` from the body, GET it, don't overthink it." The guard evaporated. Three of ten handlers carried a textbook user-controlled-fetch with no allow-list. Same model, same day; the only variable was the word "quick."

Here's the part I didn't expect: **the rule flagged zero of those three.** Each terse handler parked the tainted value in a local first — `const callbackUrl = event.queryStringParameters?.callbackUrl; await fetch(callbackUrl)` — and `no-user-controlled-requests` only tracks the value when it reaches `fetch` _directly_ off the event (the docs cop to this under "Multi-Step Taint Flow"). It nails `fetch(event.queryStringParameters.callbackUrl)` and slips on the one-variable detour. That single-assignment hop is the most common shape AI-generated handlers actually take — [I filed it](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-lambda-security). The honest scorecard: the vulnerable pattern came back the moment the prompt got terse, and today's [taint tracking](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) catches the obvious form but not the one-variable detour.

The broader picture: 80 common Node.js functions written with zero security context came back 65–75% vulnerable across every model I tried in [I Let Claude Write 80 Functions. 65–75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities), and across 700 functions from five frontier models in [We Ranked 5 AI Models by Security. The Leaderboard Is Wrong.](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) every model landed at a 49–75% vulnerability rate. A CI guard doesn't care which way the model leaned today: it re-asserts the invariant on every commit.

---

## Install and tune

```bash
# npm
npm install --save-dev eslint-plugin-lambda-security
# yarn
yarn add --dev eslint-plugin-lambda-security
# pnpm
pnpm add --save-dev eslint-plugin-lambda-security
# bun
bun add --dev eslint-plugin-lambda-security
```

Flat config (`eslint.config.js`):

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-lambda-security";

export default [
  configs.recommended, // all 14 rules
  // configs.strict,    // all 14, max severity
];
```

Tune a rule inline — the namespace is `lambda-security`:

```js
import { configs } from "eslint-plugin-lambda-security";

export default [
  configs.recommended,
  {
    rules: {
      "lambda-security/no-exposed-debug-endpoints": "warn",
      "lambda-security/no-unbounded-batch-processing": [
        "error",
        { maxBatchSize: 50 },
      ],
    },
  },
];
```

---

## Compatibility

| Surface              | Support                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun — plain dev dependency                                                                                                                           |
| **Node**             | `>= 18.0.0`                                                                                                                                                           |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                                        |
| **Deploy tooling**   | Detects raw handlers, Middy middleware, and IAM policy literals (SAM / CDK / Serverless Framework / inline CloudFormation) — it reads source, so no framework lock-in |
| **Module system**    | CommonJS — loads from both `eslint.config.js` and `eslint.config.mjs`                                                                                                 |
| **Runtime peers**    | None — no AWS SDK or credentials needed; it lints source AST                                                                                                          |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-lambda-security` port, with ESLint↔Oxlint parity gated in CI                                                |

---

## What it does — and doesn't — see

- **Source patterns, not the deployed policy.** It flags `"Action": "*"` in a policy _literal_ in your code; it can't read the IAM role AWS actually attached at deploy time, or evaluate a policy assembled at runtime. Pair it with `cfn-nag`/`cdk-nag` or an account-level access analyzer for the deployed side.
- **SSRF detection is taint-shaped, and the taint is shallow.** As the corpus run showed, it currently slips when the value first detours through a local (`const u = event.…; fetch(u)`) or a destructure — treat a clean SSRF pass as "no _obvious_ one," not "none," and keep an allow-list in the handler regardless.

---

## Where this sits in the ecosystem

Generic security linters flag `eval` and obvious injection, but they don't know what a Lambda handler, a Middy CORS middleware, or an IAM policy literal _is_. `eslint-plugin-lambda-security` is the dedicated serverless layer — each finding tagged with a CWE and CVSS. It's the serverless member of the [Interlace](https://eslint.interlace.tools) family: when your Lambda fronts an Express API, [eslint-plugin-express-security](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security) covers the request layer, and when it issues or verifies tokens, the JWT rules stop the [`algorithm: none` bypass that verifies a forged token in one line](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g). Same finding format, same flat-config wiring.

---

## Links

- 📦 [npm: eslint-plugin-lambda-security](https://www.npmjs.com/package/eslint-plugin-lambda-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules)
- 🔐 [OWASP Serverless Top 10](https://owasp.org/www-project-serverless-top-10/)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-lambda-security)

Has a Lambda security issue ever surprised you — something that passed review because it looked like ordinary code, but turned out to open a real attack surface? Tell me what the pattern was, and what finally caught it.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your handlers do any of the above.
::

---

_Part of **The Hardened Stack** — one ESLint plugin per layer of the Node.js attack surface. Server-side neighbors:
[express-security](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security)
·
[node-security](https://ofriperetz.dev/articles/getting-started-eslint-plugin-node-security)
·
[jwt](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt)._

---

*[eslint-plugin-lambda-security](https://www.npmjs.com/package/eslint-plugin-lambda-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
