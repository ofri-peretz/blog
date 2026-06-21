---
title: "An SSRF in Your Lambda Steals the Execution Role. Action: '*' Hands Over the Account. 14 ESLint Rules Break the Chain."
description: "SSRF to the metadata endpoint, Action:'*' IAM, secrets in env vars, stack traces in responses — AWS Lambda mistakes that pass review and become account takeovers. 14 CWE-mapped ESLint rules that catch them in CI."
slug: "getting-started-with-eslint-plugin-lambda-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-lambda-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-lambda-security-44h8"
devto_id: 3144087
published_at: "2026-01-02T19:26:45Z"
edited_at: "2026-02-05T06:02:24Z"
cover_image: "https://ofriperetz.dev/og/cover/getting-started-with-eslint-plugin-lambda-security"
social_image: "https://ofriperetz.dev/og/article/getting-started-with-eslint-plugin-lambda-security"
reading_time_minutes: 9
tags:
  - "eslint"
  - "security"
  - "aws"
  - "ai"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Hardened Stack"
---

Here is a two-step path from "valid HTTP request" to "attacker owns your AWS
account," and every step compiles:

```ts
// Step 1: the handler fetches a URL the caller controls
export const handler = async (event) => {
  const res = await fetch(event.queryStringParameters.callbackUrl); // SSRF
  return { statusCode: 200, body: await res.text() };
};
```

An attacker points `callbackUrl` at `http://169.254.169.254/latest/meta-data/iam/security-credentials/`
— the Lambda **instance metadata endpoint** — and your handler dutifully
fetches and returns the **execution role's temporary credentials**. Step 2: if
that role's IAM policy contains `"Action": "*"` (the default reflex when "it
just needs to work"), those credentials now do _anything_ in your account.

Neither line throws. Neither fails a test. The type-checker is delighted. Both
are **source patterns** — and that's what `eslint-plugin-lambda-security` reads.
It's **14 rules** for the AWS Lambda / serverless surface — SSRF, IAM
over-permissioning, secrets in env vars, error-detail leakage, unbounded batch
DoS — organized around the [OWASP Serverless Top 10](https://owasp.org/www-project-serverless-top-10/),
each pinned to a CWE.

This guide walks the SSRF→IAM takeover chain, the serverless-specific gotchas
(env vars aren't secret), the full 14-rule map, and exact install/engine support.

### Why this passes code review

Neither half of this chain looks like a vulnerability to a reviewer reading the
diff. The `fetch` is a single line doing an ordinary thing — a webhook callback,
a "fetch the user's avatar URL" feature — and the reviewer doesn't have IMDS's
`169.254.169.254` loaded in their head while reading a feature PR. SSRF only
registers as dangerous when you _already_ know the runtime exposes a credential
endpoint on the loopback; on a long-lived server you've never deployed to, that
intuition isn't there. So the line reads as "calls a URL," and "calls a URL" is
not a red flag.

The `"Action": "*"` is worse, because it's usually not even in the same PR. The
handler ships in application code; the IAM policy ships in a SAM/CDK/Serverless
template that a different person reviews — often a platform engineer optimizing
for "the deploy stops failing with AccessDenied," not for blast radius. Each
half is locally reasonable. The chain is only visible when you hold both files
at once, which no single reviewer does. That's the gap a linter closes: it reads
the source AST, not the diff, and it doesn't get bored on line 4 of a 600-line
PR.

---

## TL;DR

- **14 rules**, each carrying a `CWE` id and CVSS, mapped to the OWASP
  Serverless Top 10.
- **2 presets**: `recommended` and `strict` (both enable all 14 — focused
  plugin, the sane default is everything).
- **Flat-config**, CommonJS, ESLint `8 || 9 || 10`, Node `>= 18`. Detects raw
  handlers, Middy middleware, and IAM policy literals (SAM/CDK/Serverless
  Framework) — it lints source, no AWS credentials or peer SDK required.

---

## Step 1: SSRF — `no-user-controlled-requests`

```ts
// ❌ no-user-controlled-requests (CWE-918, CVSS 9.1)
const res = await fetch(event.queryStringParameters.callbackUrl);
```

```ts
// ✅ allow-list the destination before you call it
const ALLOWED = new Set(["api.partner.com", "hooks.example.com"]);
const url = new URL(event.queryStringParameters.callbackUrl);
if (!ALLOWED.has(url.hostname)) throw new Error("destination not allowed");
const res = await fetch(url);
```

The rule flags a request whose URL carries user-controlled input. In Lambda
this is uniquely dangerous because the runtime exposes the **IMDS** endpoint
(`169.254.169.254`) on the loopback network — an unfiltered SSRF reaches it and
returns the execution role's credentials. The fix is an allow-list of
destinations; the rule's own guidance: _"Never use user input directly in
URLs."_ (You should also pin IMDSv2 and block the metadata CIDR at the network
layer — defense in depth.)

---

## Step 2: least privilege — `no-overly-permissive-iam-policy`

What turns a stolen credential from "bad" into "account takeover" is the policy
attached to the role.

```ts
// ❌ no-overly-permissive-iam-policy (CWE-732)
policy: { Effect: "Allow", Action: "*", Resource: "*" }
```

```ts
// ✅ scope to exactly what the function needs
policy: {
  Effect: "Allow",
  Action: ["s3:GetObject"],
  Resource: "arn:aws:s3:::my-bucket/*",
}
```

The rule flags `"*"` in `Action`/`Resource` of IAM policy literals (the shape
you write in SAM, CDK, the Serverless Framework, or inline policy objects). Its
fix message is concrete: _restrict to specific resources/actions, e.g.
`"arn:aws:s3:::my-bucket/*"` instead of `"*"`._ Least privilege is what bounds
the blast radius of step 1 — with a scoped role, the stolen credentials can
read one bucket, not delete your databases.

### Make both halves a build error

Two of these patterns just earned an SSRF→takeover chain. Here's the entire
config that fails CI on both — the [full install matrix](#install) (package
managers, inline tuning, sample output) is below:

```bash
npm install --save-dev eslint-plugin-lambda-security
```

```js
// eslint.config.js — `configs` is a NAMED export
import { configs } from "eslint-plugin-lambda-security";

export default [configs.recommended]; // all 14 rules, CWE-tagged
```

---

## The serverless gotchas

Lambda has its own footguns that don't exist on a long-lived server:

- **Env vars are not a secret store.** `no-secrets-in-env` (CWE-798) flags
  secrets assigned to environment variables: they're readable by anyone with
  `lambda:GetFunctionConfiguration` (and visible in the console), and one
  `console.log(process.env)` dumps them to CloudWatch forever. The fix is a
  runtime fetch from **AWS Secrets Manager** / SSM Parameter Store.
- **Logging leaks.** `no-env-logging` (CWE-532) catches `process.env` going to
  logs; `no-exposed-error-details` (CWE-209) catches `error.stack` returned in
  the HTTP response (log it to CloudWatch, return a generic message).
- **Unbounded work = DoS / cost.** `no-unbounded-batch-processing` (CWE-770)
  flags processing an event's records with no cap (tune via
  `{ maxBatchSize: 100 }`); `require-timeout-handling` (CWE-400) wants a
  fallback before the function's hard timeout.

---

## What happens when an AI assistant writes the handler

Ask any coding assistant to "write a Lambda that fetches a URL from the request
and returns the body," and you get the SSRF line at the top of this article —
`fetch(event.queryStringParameters.callbackUrl)`, no allow-list. Ask it to "give
this function an IAM role so it can read from S3," and a meaningful share of the
time you get `Action: "*"` or `Resource: "*"`, because the broad policy is the
one that always works and the scoped one requires knowing the exact ARNs. The
model isn't being careless — it's reproducing the median of its training data,
and for both of these patterns the median is the insecure one. The IMDS-aware,
least-privilege version is the minority of the corpus, so it's the minority of
the output.

This is the same dynamic I keep hitting across the stack: an assistant doesn't
invent novel bugs, it _reintroduces the well-documented ones_. I measured the
broad version of this — letting an assistant write functions and counting the
holes — in [I Let Claude Write 60 Functions. 65–75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities),
and watched the same negative-space failure mode play out one prompt at a time
in [Claude Wrote a NestJS Service. ESLint Found 6 Security Holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes).
The constant: the assistant fills in the behavior you asked for and skips the
constraint you didn't — and "don't let this URL reach the metadata endpoint" is
a constraint nobody puts in a prompt.

So the volume of handler code that needs review just went up, while the per-line
attention each one gets went down. That's the exact condition these rules are
built for. You don't read the AI's handler line by line hoping to spot the
missing allow-list; you make the missing allow-list a build error. Run
`recommended` over AI-generated serverless code and the SSRF line and the `"*"`
policy fail CI on the call shape the assistant defaults to — same as they would
for code a human wrote on a Friday afternoon.

---

## The full rule set

All 14, with each rule's declared CWE:

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

---

## Install

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
      "lambda-security/no-error-swallowing": "warn",
      "lambda-security/no-unbounded-batch-processing": [
        "error",
        { maxBatchSize: 50 },
      ],
    },
  },
];
```

Run it — findings carry the CWE, OWASP category, CVSS, and fix:

```text
src/handlers/proxy.ts
  4:21  error  🔒 CWE-918 OWASP:A01-Broken CVSS:9.1 | HTTP request URL contains user-controlled input from event.queryStringParameters. Attackers can access internal services or exfiltrate data. | CRITICAL
               Fix: Validate URL against allowlist before making request. Never use user input directly in URLs.
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
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-lambda-security` port, with ESLint↔Oxlint parity gated in CI. The full 14-rule set runs on ESLint today.     |

---

## What it does — and doesn't — see

- **Source patterns, not the deployed policy.** It flags `"Action": "*"` in a
  policy _literal_ in your code; it can't read the IAM role AWS actually
  attached at deploy time, or evaluate a policy assembled at runtime. Pair it
  with `cfn-nag`/`cdk-nag` or an account-level access analyzer for the deployed
  side.
- **SSRF detection is taint-shaped, not a proof.** It flags user-controlled
  input reaching a request URL; whether your allow-list is airtight is your
  job. Block the metadata CIDR and require IMDSv2 at the infra layer too.

---

## Where this sits in the ecosystem

Generic security linters flag `eval` and obvious injection, but they don't know
what a Lambda handler, an IMDS fetch, a Middy CORS middleware, or an IAM policy
literal _is_. `eslint-plugin-lambda-security` is the dedicated serverless layer
— SSRF, IAM least-privilege, secrets handling, the OWASP Serverless Top 10 —
each finding tagged with a CWE and CVSS. It's the serverless member of the
[Interlace](https://eslint.interlace.tools) family, complementary to the generic
set and to the server-side plugins: when your Lambda fronts an Express API,
[eslint-plugin-express-security](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security)
covers the request layer, and when it issues or verifies tokens,
[the JWT rules](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt)
stop the `algorithm: none` bypass. Same finding format, same flat-config wiring
— pick the plugins that match your runtime.

---

## Links

- 📦 [npm: eslint-plugin-lambda-security](https://www.npmjs.com/package/eslint-plugin-lambda-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules)
- 🔐 [OWASP Serverless Top 10](https://owasp.org/www-project-serverless-top-10/)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-lambda-security)

Run `recommended` over one Lambda repo and tell me what it caught: a `fetch` of
a caller-supplied URL, an `Action: "*"` nobody scoped down, a secret sitting in
an env var? Or — the one I most want to hear — has an over-broad execution role
ever actually been the thing that turned a small bug into an incident in your
account? Drop it in the comments.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your handlers do any of the above.
::

---

_Part of **The Hardened Stack** — one ESLint plugin per layer of the Node.js
attack surface. Server-side neighbors:
[express-security](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security)
·
[node-security](https://ofriperetz.dev/articles/getting-started-eslint-plugin-node-security)
·
[jwt](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt)._

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-lambda-security`
is its serverless layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
