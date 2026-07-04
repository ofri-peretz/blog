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

Step 1 is a server-side request forgery: the caller now drives outbound calls
from inside your trust boundary — VPC-internal services, databases, admin
endpoints not exposed to the internet — and can exfiltrate the response. The
credential prize is the part most people get wrong about Lambda. **Lambda has no
EC2 metadata service** — there's no `169.254.169.254` returning role credentials
the way there is on an EC2 box. The execution role's keys are injected as
**environment variables** (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_SESSION_TOKEN`). So the SSRF that steals them is the one whose client can
read `file:///proc/self/environ`, or a handler you can coax into reflecting
`process.env` — not the EC2 IMDS payload people reflexively copy over. Step 2:
if that role's IAM policy contains `"Action": "*"` (the reflex when "it just
needs to work"), those leaked keys now do _anything_ in your account.

Neither line throws. Neither fails a test. The type-checker is delighted. Both
are **source patterns** — and that's what `eslint-plugin-lambda-security` reads.
It's **14 rules** for the AWS Lambda / serverless surface — SSRF, IAM
over-permissioning, secrets in env vars, error-detail leakage, unbounded batch
DoS — organized around the [OWASP Serverless Top 10](https://owasp.org/www-project-serverless-top-10/),
each pinned to a CWE.

This guide walks the SSRF→IAM takeover chain, the serverless-specific gotchas
(env vars aren't secret — and on Lambda they're where the credentials live), the
full 14-rule map, and exact install/engine support.

### Why this passes code review

Neither half of this chain looks like a vulnerability to a reviewer reading the
diff. The `fetch` is a single line doing an ordinary thing — a webhook callback,
a "fetch the user's avatar URL" feature — and the reviewer isn't picturing the
trust boundary that line sits inside: that the function can reach VPC-internal
services, and that its own role credentials are sitting in `process.env` one
`file://` or reflected-`env` away. SSRF only registers as dangerous when you
_already_ hold the runtime's internal surface in your head; reading a feature PR,
that intuition isn't there. So the line reads as "calls a URL," and "calls a URL"
is not a red flag.

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

The rule flags a request whose URL carries user-controlled input
([rule docs](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-user-controlled-requests)).
The fix is an allow-list of destinations; the rule's own guidance: _"Never use
user input directly in URLs."_

Here's the nuance that separates a real Lambda threat model from a copied EC2
one — and it's where most "SSRF steals your role" write-ups are quietly wrong.
On **EC2**, the classic SSRF prize is the IMDS endpoint
(`http://169.254.169.254/latest/meta-data/iam/security-credentials/`), and on a
box still allowing **IMDSv1** a single unauthenticated GET returns the role's
credentials. **Lambda is not that.** There is no IMDS in a Lambda execution
environment; the role's keys live in `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
/ `AWS_SESSION_TOKEN` env vars, and the only loopback service is the **Lambda
Runtime API** (`$AWS_LAMBDA_RUNTIME_API`), which serves invocation lifecycle, not
credentials. So on Lambda the SSRF that matters reaches **internal/VPC services**
or reads the credential env directly (a client that follows `file:///proc/self/environ`,
or a handler coaxed into echoing `process.env`) — not `169.254.169.254`.

Why keep the link-local block anyway? Because the rule reads source, and the
same handler file routinely gets lifted onto **EC2 or ECS-on-EC2**, where that
exact GET _does_ hit IMDS — and `no-user-controlled-requests` flags the
user-controlled URL regardless of which compute it lands on, before the deploy
target is even decided. The linter doesn't assume your runtime; it removes the
user-controlled destination that your runtime's internal surface is the only
thing standing in front of.

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
you write in SAM, CDK, the Serverless Framework, or inline policy objects —
[rule docs](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-overly-permissive-iam-policy)).
Its fix message is concrete: _restrict to specific resources/actions, e.g.
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
  runtime fetch from **AWS Secrets Manager** / SSM Parameter Store. (Entropy
  scanners miss the assignment that matters here — why a structural rule beats a
  secret-scanner is the whole argument of
  [Hardcoded Secrets in AI-Generated Code, and the Autofix That Removes Them](https://ofriperetz.dev/articles/hardcoded-secrets-ai-agents-autofix).)
- **Logging leaks.** `no-env-logging` (CWE-532) catches `process.env` going to
  logs; `no-exposed-error-details` (CWE-209) catches `error.stack` returned in
  the HTTP response (log it to CloudWatch, return a generic message).
- **Unbounded work = DoS / cost.** `no-unbounded-batch-processing` (CWE-770)
  flags processing an event's records with no cap (tune via
  `{ maxBatchSize: 100 }`); `require-timeout-handling` (CWE-400) wants a
  fallback before the function's hard timeout.

---

## What happens when an AI assistant writes the handler

I wanted first-party numbers for this article instead of borrowing them, so I
ran the experiment twice — and the second run found something I didn't expect.
The corpus, prompts, and scan script are reproducible:

```bash
# corpus + scan live in the benchmark suite. Model: claude-opus-4-7, June 2026.
node benchmarks/lambda-ai-corpus/scripts/generate.mjs              # 10 from-scratch handlers
node benchmarks/lambda-ai-corpus/scripts/generate.mjs prompts-terse.json generated-terse  # 10 "just make it work" edits
node benchmarks/lambda-ai-corpus/scripts/scan.mjs [generated|generated-terse]              # lambda-security over a corpus
```

The generator is model-agnostic — it shells out to whatever assistant CLI you
point it at. Swap the `claude` call for a Gemini one (same prompts, same scan)
and you have an apples-to-apples _"how does each model's unprompted Lambda
default score against a CWE-tagged linter"_ benchmark — the exact shape of a
[Build with Gemini](https://dev.to/challenges) submission. I'm publishing the
ESLint-side result here; the cross-model leaderboard is its own piece.

**Run 1 — ten neutral, from-scratch prompts** (_"write a Lambda that fetches a
`callbackUrl` and returns the body,"_ _"give this function an IAM role to
read/write S3"_). The uncomfortable-for-_my-own-thesis_ result: on the SSRF
prompt the model did **not** hand me the naked `fetch(callbackUrl)` from the top
of this article. It wrote a full `assertSafeUrl` guard — protocol allow-list, an
explicit `169.254.169.254` block, DNS checks against private ranges,
`redirect: 'error'`. **Zero of ten** handlers tripped any critical rule; the IAM
prompt produced a scoped `s3:GetObject`/`PutObject` on the bucket ARN, not
`Action: "*"`. Frontier defaults have genuinely moved — on a clean, explicit
prompt, today's model often writes the hardened version.

That is not "the problem is solved." The floor hasn't moved; only the best case
has. So **Run 2 — the same tasks, but phrased the way assistants are actually
used under deadline**: _"Quick one — fetch the `callbackUrl` and return the body,
just make it work,"_ _"simple proxy, read `target` from the body, GET it, don't
overthink it."_ The guard evaporated. The model wrote the bare
`fetch(callbackUrl)`, `fetch(target)`, `fetch(body.notifyUrl)` — **three of ten
handlers carried a textbook user-controlled-fetch** with no allow-list. Same
model, same day; the only variable was the word "quick."

Here's the part I didn't expect, and it's why running the linter over real output
beats trusting it: **the rule flagged zero of those three.** Each terse handler
parked the tainted value in a local first — `const callbackUrl =
event.queryStringParameters?.callbackUrl; await fetch(callbackUrl)` — or
destructured it (`const { target } = JSON.parse(event.body)`), and
`no-user-controlled-requests` only tracks the value when it reaches `fetch`
_directly_ off the event (its docs cop to this under "Multi-Step Taint Flow").
It nails `fetch(event.queryStringParameters.callbackUrl)` and slips on
`const u = event.…; fetch(u)`. That single-assignment hop is the most common
shape AI-generated handlers actually take, so it's the gap that matters most —
[I filed it](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-lambda-security).
The honest scorecard, then: the vulnerable pattern came back the moment the
prompt got terse, and today's taint tracking catches the obvious form but not
the one-variable detour — which is exactly the kind of finding a corpus scan
exists to surface, and exactly why "the model wrote it safely once" is not a
control you can ship.

That conditionality is the actual argument for a build-time guard. I've measured
the broad, prompt-stripped version of this repeatedly: 80 common Node.js
functions written with zero security context came back **65–75% vulnerable
across every model I tried** in
[I Let Claude Write 80 Functions. 65–75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities),
and across 700 functions from five frontier Claude **and Gemini** models in
[We Ranked 5 AI Models by Security. The Leaderboard Is Wrong.](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
every model landed at a **49–75% vulnerability rate** — and the model that scored
_worst_ on raw generation (Gemini 2.5 Pro, 73%) was the _best_ at fixing the bug
once a rule named it. No model is the secure one; the rankings just shuffle
_which_ vulnerabilities each leaks. A
CI guard doesn't care which way the model leaned today: it re-asserts the
invariant on every commit, the secure-by-default generation and the
"quick, just make it work" edit alike. You don't read the AI's handler line by
line hoping to spot the missing allow-list — you make the rule the thing that
checks, on every push, and you keep tightening it where the corpus shows it
slipping (that taint hop above is next on my list). A control you run beats a
generation you trusted once.

---

## The full rule set

All 14 are organized around the [OWASP Serverless Top 10](https://owasp.org/www-project-serverless-top-10/)
and pinned to a CWE — the same CWE-as-the-unit approach I used to map a whole
codebase to the broader risk surface in
[Mapping Your Codebase to the OWASP Top 10 with 247 ESLint Rules](https://ofriperetz.dev/articles/mapping-your-codebase-to-owasp-top-10-with-247-eslint-rules).
Here they are, each with its declared CWE:

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
      // recommended ships no-exposed-debug-endpoints as "error"; drop it to
      // "warn" if you gate debug routes another way (a real override, not a no-op)
      "lambda-security/no-exposed-debug-endpoints": "warn",
      // and tighten the batch cap below the default
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
- **SSRF detection is taint-shaped, and the taint is shallow.** It flags
  user-controlled input reaching a request URL when the event value lands on
  `fetch`/`axios` fairly directly; as my corpus run showed, it currently slips
  when the value first detours through a local (`const u = event.…; fetch(u)`)
  or a destructure — so treat a clean SSRF pass as "no _obvious_ one," not
  "none," and keep an allow-list in the handler regardless. (That gap is the
  next thing I'm tightening.) For the credential side, remember the Lambda
  threat is the env-injected role keys, not an IMDS endpoint — scope the role
  and don't log `process.env`.

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
covers the request layer, and when it issues or verifies tokens, the JWT rules
stop the
[`algorithm: none` bypass that verifies a forged token in one line](https://ofriperetz.dev/articles/the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g).
Same finding format, same flat-config wiring — pick the plugins that match your
runtime.

---

## Links

- 📦 [npm: eslint-plugin-lambda-security](https://www.npmjs.com/package/eslint-plugin-lambda-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules)
- 🔐 [OWASP Serverless Top 10](https://owasp.org/www-project-serverless-top-10/)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-lambda-security)

One question, and it's the one I most want answered: has an `Action: "*"`
execution role ever turned a small bug in your account into a big incident —
the blast radius being the whole problem? Tell me what the bug was and how far
the role let it reach. (Run `recommended` over one Lambda repo first if you want
to find your own before you tell the story.)

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
