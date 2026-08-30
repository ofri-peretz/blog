---
title: "Node.js Security Bugs That Pass Code Review Every Day — 35 Static Analysis Rules That Don't"
description: "Path traversal via fs, shell injection via child_process, eval on user input, weak hashes — Node.js built-in footguns that survive code review and ship as CVEs. Here's the guard that catches all of them in CI, with the real linter output."
slug: "getting-started-eslint-plugin-node-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-node-security"
tier: "TUTORIAL"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-crypto-4a8g"
devto_id: 3143570
published_at: "2026-01-02T15:15:04Z"
edited_at: "2026-02-03T04:59:37Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-node-security.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-node-security-og.jpg?v=b2"
reading_time_minutes: 10
tags:
  - "security"
  - "node"
  - "devsecops"
  - "javascript"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Hardened Stack"
---

Four lines. Each is a Node.js built-in used the easy way instead of the safe way, and each already has a [CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained) id waiting for it:

```ts
crypto.createHash("md5").update(password).digest("hex"); // weak hash       (CWE-327)
exec(`convert ${filename} out.png`); // shell injection (CWE-78)
await fs.readFile(`./uploads/${userPath}`, "utf8"); // path traversal  (CWE-22)
return eval(expr); // code injection  (CWE-95)
```

They pass type-checking. They pass unit tests, because the test feeds trusted input. They pass code review, because nothing _on the line_ looks wrong. Then they ship, and someone finds them with `grep`.

Below is the case file for each: what it looks like, why review waved it through, the exact finding the linter prints, and the fix. Total cost to make all four fail your CI: one install and three lines of config, about two minutes, in the setup section right after. Every terminal block is real output — `eslint-plugin-node-security` v4.4.2 on ESLint 9.39.5, captured 2026-07-28. Don't take my word for it; run it and compare.

> **The Hardened Stack series** · **`eslint-plugin-node-security` (you are here)** → [`eslint-plugin-express-security`](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security) → [`eslint-plugin-nestjs-security`](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules) → [`eslint-plugin-jwt-security`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt-security). This is the stdlib floor every other layer stands on. New here? Start with [The 30-Minute Security Audit](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase), the protocol these plugins plug into.

---

## Finding 1: Weak hash algorithm (`no-weak-hash-algorithm`, CWE-327)

**Vulnerable code**

```ts
// auth/hash.ts
import crypto from "node:crypto";

export function hashPassword(password: string): string {
  return crypto.createHash("md5").update(password).digest("hex");
}
```

**Why it survived review**

`createHash("md5")` and `createHash("sha256")` differ by one string literal. In a 40-line PR about a new export feature, a reviewer scanning for logic bugs reads `createHash(...)` as "they're hashing something" and moves on — the algorithm name is the kind of detail the eye rounds off. The line is typed correctly, so nothing is red. There is no signal that the argument is wrong.

**What the linter actually prints**

```text
auth/hash.ts
  5:28  error  🔒 CWE-327 OWASP:A04-Cryptographic CVSS:7.5 | Use of weak hash
        algorithm: MD5. MD5 is cryptographically broken and unsuitable for
        security purposes. | CRITICAL [PCI-DSS,HIPAA,ISO27001,NIST-CSF]
        Fix: Replace with sha256: crypto.createHash("sha256").update(data)
        node-security/no-weak-hash-algorithm
```

One finding carries the [CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained) id, the [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) category, the [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) score, the compliance frameworks that care, and the replacement call — enough for an auditor or an AI assistant to act without opening a second tab. One gotcha if you cross-check these: the A-codes are **2025-edition** numbering, so `A04-Cryptographic` here is what you may know as A02:2021. An OWASP letter without a year is ambiguous by construction.

**Fix**

```ts
// ✅
crypto.createHash("sha256").update(password).digest("hex");
```

Related rules in the same category: `no-sha1-hash`, `no-ecb-mode`, `no-dynamic-algorithm-selection` (CWE-327), `no-static-iv` (CWE-329), `no-math-random-crypto` (CWE-338), `no-timing-unsafe-compare` (CWE-208).

---

## Finding 2: Shell injection (`no-shell-injection`, CWE-78)

**Vulnerable code**

```ts
// media/convert.ts
import { exec } from "node:child_process";

export function convertImage(filename: string) {
  exec(`convert ${filename} out.png`);
  // filename = "x.png; rm -rf /" → executes both commands
}
```

**Why it survived review**

The `exec(\`convert ${filename}\`)`line looks *more* correct than the safe version — it reads like the shell command you'd type by hand, while`execFile("convert", [filename])`looks fussier. The "clean code" instinct argues for the wrong one. And the vulnerability lives in what an attacker might pass for`filename`, not in the code on screen, so catching it requires modelling the attack path — which is not what code review optimizes for.

I approved an `exec()` shelling out to a media tool in a PR I led. The diff was a feature I'd asked for, and the line read like the command I'd have typed in a terminal. It sat in production until a dependency bump made me re-read the file. Chess players call it the blunder-check: the position you're winning is the one you stop double-checking. The fix was one function name. Getting there took writing a lint rule — a fair summary of how much my review process contributed.

**What the linter actually prints**

```text
media/convert.ts
  5:8  error  🔒 CWE-78 OWASP:A05-Injection CVSS:9.8 | Shell command built via
       string concatenation or template literal. An attacker who controls any
       interpolated value can execute arbitrary OS commands.
       | CRITICAL [SOC2,PCI-DSS,ISO27001,NIST-CSF]
       Fix: Use spawn(cmd, [arg1, arg2]) with separate arguments instead of
       exec(cmd + args). Never build shell commands via string interpolation.
       node-security/no-shell-injection
```

**Fix**

```ts
// ✅ no shell — arguments as an array, no injection surface
import { execFile } from "node:child_process";
execFile("convert", [filename, "out.png"], { shell: false });
```

`exec`/`execSync` run their argument through `/bin/sh`, so any user-controlled substring is shell code. `execFile`/`spawn` with an args array and `shell: false` pass arguments directly to the binary — there's no shell to inject into.

Worth knowing before you tune anything: the plugin ships **two** CWE-78 rules. `no-shell-injection` is structural — it fires on the shape of the call, which is why it caught the snippet above without knowing where `filename` came from. `detect-child-process` is the [taint-tracking](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) one, and wants to watch user input reach the sink. Run both: they fail in opposite directions.

Related rules: `detect-eval-with-expression` (CWE-95), `no-dynamic-require` (CWE-94).

---

## Finding 3: Path traversal via `fs` (`detect-non-literal-fs-filename`, CWE-22)

**Vulnerable code**

```ts
// files/serve.ts
import fs from "node:fs/promises";

export async function serveFile(userPath: string) {
  const content = await fs.readFile(`./uploads/${userPath}`, "utf8");
  return content;
  // userPath = "../../etc/passwd" → reads outside uploads/
}
```

**Why it survived review**

The `./uploads/` prefix looks like a guard — it reads as "we're only serving files from the uploads directory." The reviewer's eye stops there. The problem isn't the prefix; it's that a `../` sequence in `userPath` escapes it entirely. Unless you mentally run `path.resolve()` on the composed string, the prefix looks protective when it isn't.

**What the linter actually prints**

```text
files/serve.ts
  5:25  error  🔑 CWE-22 OWASP:A01-Broken CVSS:7.5 | Path traversal
        vulnerability | HIGH [SOC2,PCI-DSS,HIPAA,ISO27001]
        Fix: path.resolve(SAFE_DIR, path.basename(userInput))
        node-security/detect-non-literal-fs-filename
```

**Fix**

```ts
// ✅ resolve and confirm the path stays under uploads/
import path from "node:path";

const base = path.resolve("./uploads");
const target = path.resolve(base, userPath);
if (!target.startsWith(base + path.sep)) {
  throw new Error("Path traversal attempt");
}
const content = await fs.readFile(target, "utf8");
```

Related rules: `no-zip-slip` (CWE-22 — same pattern in archive extraction), `no-arbitrary-file-access`, `no-toctou-vulnerability` (CWE-367).

---

## Finding 4: `eval` with user input (`detect-eval-with-expression`, CWE-95)

**Vulnerable code**

```ts
// templates/render.ts
export function renderTemplate(template: string, vars: Record<string, string>) {
  const expr = template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
  return eval(expr);
  // template = "process.exit(1)" → arbitrary code execution
}
```

**Why it survived review**

`eval` in application code is rare enough that reviewers flag it on sight — except when the surrounding context makes it look intentional and bounded. A template renderer that reaches for `eval` reads as a design choice ("this is how templates work"), not a footgun. The distinction between _evaluating an expression_ and _executing attacker-controlled code_ doesn't surface from the diff alone.

**What the linter actually prints**

```text
templates/render.ts
  4:10  error  🔒 CWE-95 OWASP:A05-Injection CVSS:9.8 | eval() can be refactored
        to safer alternative | HIGH [SOC2,PCI-DSS,ISO27001]
        Fix: Remove eval entirely
        node-security/detect-eval-with-expression
```

**Fix**

```ts
// ✅ simple interpolation with no execution surface
export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}
```

For cases that genuinely need expression evaluation, prefer a sandboxed template engine (`Handlebars`, `Eta`) that never touches `eval`.

---

## Get it running (about two minutes)

**1. Install.** Plain dev dependency, no runtime peers:

```bash
npm  install --save-dev eslint-plugin-node-security   # npm
yarn add     --dev      eslint-plugin-node-security   # yarn
pnpm add     --save-dev eslint-plugin-node-security   # pnpm
bun  add     --dev      eslint-plugin-node-security   # bun
```

**2. Wire the preset.** `configs` is a **named** export — this is the one thing people get wrong, because the default export is the plugin object, not the config:

```js
// eslint.config.js
import { configs } from "eslint-plugin-node-security";

export default [
  // 22 rules — production baseline. Spread with `files` so it scopes to
  // your source; the preset ships no `files` key, so on its own it lints
  // everything ESLint reaches, dist/ included.
  { ...configs.recommended, files: ["src/**/*.{js,ts}"] },
  // { ...configs.strict, files: ["src/**/*.{js,ts}"] },  // all 35 as errors
];
```

The preset carries its own `plugins` key, so there's nothing else to register.

**3. Confirm it fires.** Paste one bad line into a file and run:

```bash
npx eslint src
```

A clean pass on a file containing `crypto.createHash("md5")` means your `files` glob isn't matching. That's the failure mode, roughly every time.

> **One install, four vulnerabilities blocked.** A Node.js pipeline that runs ESLint without something like this is betting on code review catching the `md5` string, the shell interpolation, the `../` in a path, and the `eval`. That bet has a measured [base rate](https://ofriperetz.dev/articles/base-rate-problem-explained): across an 80-function corpus (3-model run measured 2026-02-06, plus a 20-function Opus 4.6 follow-up), [65–75% of AI-written functions carried at least one security vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities), with no significant difference between models (χ² = 0.640, p > 0.05). Human review misses the same lines at the same sites.

Onboarding a codebase you inherited? [The 30-Minute Security Audit](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) maps where this plugin fits in the sequence.

---

## TL;DR

_All counts below are from `eslint-plugin-node-security` **v4.4.2**, read off the published package on **2026-07-28** (ESLint 9.39.5, Node 18)._

- **35 rules**, each carrying a `CWE` id, a CVSS score, and compliance tags (PCI-DSS / HIPAA / SOC2 / …).
- **2 presets**: `recommended` (22 rules — 18 errors, 4 warnings, the production baseline) and `strict` (all 35 as errors).
- **Flat-config**, CommonJS, ESLint `8 || 9 || 10`, Node `>= 18`, no runtime peers. The former `eslint-plugin-crypto` is deprecated on npm and consolidated here.

---

## The full rule set

All 35, grouped, with each rule's declared CWE:

### Cryptography

| Rule                             | CWE      |
| -------------------------------- | -------- |
| `no-weak-hash-algorithm`         | CWE-327  |
| `no-sha1-hash`                   | CWE-327  |
| `no-weak-cipher-algorithm`       | CWE-327  |
| `no-ecb-mode`                    | CWE-327  |
| `no-insecure-rsa-padding`        | CWE-327  |
| `no-deprecated-cipher-method`    | CWE-327  |
| `no-dynamic-algorithm-selection` | CWE-327  |
| `no-static-iv`                   | CWE-329  |
| `no-insecure-key-derivation`     | CWE-916  |
| `no-timing-unsafe-compare`       | CWE-208  |
| `no-self-signed-certs`           | CWE-295  |
| `no-math-random-crypto`          | CWE-338  |
| `no-cryptojs-weak-random`        | CWE-338  |
| `no-cryptojs`                    | CWE-1104 |
| `prefer-native-crypto`           | CWE-1104 |

### Injection / dynamic execution

| Rule                          | CWE    |
| ----------------------------- | ------ |
| `no-shell-injection`          | CWE-78 |
| `detect-child-process`        | CWE-78 |
| `detect-eval-with-expression` | CWE-95 |
| `no-unsafe-dynamic-require`   | CWE-95 |
| `no-dynamic-require`          | CWE-94 |

### Filesystem & buffers

| Rule                             | CWE     |
| -------------------------------- | ------- |
| `no-zip-slip`                    | CWE-22  |
| `detect-non-literal-fs-filename` | CWE-22  |
| `no-arbitrary-file-access`       | CWE-22  |
| `no-toctou-vulnerability`        | CWE-367 |
| `no-buffer-overread`             | CWE-126 |
| `no-deprecated-buffer`           | CWE-676 |

### SSRF & supply chain

| Rule                             | CWE      |
| -------------------------------- | -------- |
| `no-ssrf`                        | CWE-918  |
| `detect-suspicious-dependencies` | CWE-506  |
| `lock-file`                      | CWE-829  |
| `require-dependency-integrity`   | CWE-494  |
| `no-dynamic-dependency-loading`  | CWE-1104 |

### Secrets & data-at-rest

| Rule                                | CWE     |
| ----------------------------------- | ------- |
| `require-secure-credential-storage` | CWE-312 |
| `require-storage-encryption`        | CWE-312 |
| `no-data-in-temp-storage`           | CWE-312 |
| `require-secure-deletion`           | CWE-459 |

That's all 35 (15 + 5 + 6 + 5 + 4). `recommended` turns on 22 of them — 18 as errors, and 4 as warnings: `no-buffer-overread`, `no-ssrf`, `detect-suspicious-dependencies`, and `lock-file`. Each of those four is either heuristic or reaches outside the AST, so it starts as a warning rather than a broken build. `strict` turns on all 35 as errors.

---

## Compatibility

| Surface              | Support                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun — plain dev dependency                                                                                                                     |
| **Node**             | `>= 18.0.0`                                                                                                                                                     |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                                  |
| **Module system**    | CommonJS — loads from both `eslint.config.js` and `eslint.config.mjs`                                                                                           |
| **Runtime peers**    | None — it lints source AST                                                                                                                                      |
| **Replaces**         | `eslint-plugin-crypto` (deprecated) — its cipher/hash/randomness rules are consolidated here                                                                    |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-node-security` port, with ESLint↔Oxlint parity gated in CI. The full 35-rule set runs on ESLint today. |

---

## What it does — and doesn't — see

- **Source patterns, not runtime.** It flags `createHash("md5")`, `exec(\`…${x}\`)`, and an unguarded `extract()`. It can't confirm the key in your KMS is rotated or that your archive source is trusted — it removes the "we shipped MD5 / a shell string" failure mode at the call site.
- **A linter, not a scanner.** No cross-file data flow, no build step, no separate service — it runs in the same pass as the rest of your ESLint config. That's the deliberate trade on the [linting-vs-SAST](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting) line: something that runs on every save, not on Fridays. Neither replaces the other.
- **[Taint detection](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) has edges.** The injection and fs rules track user input toward a sink with configurable patterns; tune them rather than assuming the defaults are exhaustive, and pair with runtime input validation.
- **The four warnings are warnings for a reason.** `no-ssrf`, `no-buffer-overread`, `detect-suspicious-dependencies`, and `lock-file` are the likeliest to hand you a [false positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) on a codebase they've never seen. Read those findings before promoting them to errors.

---

## Your turn

Run `configs.recommended` against your largest Node service and look at the first finding — not the count, the first finding. Which of the four do you actually recall shipping: the `md5` from a "temporary" password hash, the `exec()` someone added to shell out to ffmpeg, the `./uploads/${...}` that looked like a guard, or the `eval` inside something that called itself a template engine? Drop it in the comments — I want to know which one survived review the longest, and whether a human wrote it or an assistant pasted it.

Once the stdlib floor is green, the next layer up is the framework boundary, where request objects arrive and your own input handling starts: [`eslint-plugin-express-security`](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security).

---

## Where this sits in the ecosystem

Generic security linters flag a few of these (`eval`, obvious `child_process`), but they don't carry the CWE/CVSS/compliance metadata an audit reviewer needs, and they don't reach the crypto surface at this depth. The incumbent is the clearest case: on a 40-vulnerability [ground-truth corpus](https://ofriperetz.dev/articles/ground-truth-in-security-testing), `eslint-plugin-security` **v2.1.1** scored **50.0% [precision](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) / 27.5% recall** (measured on ESLint 8.57.0) — one false alarm per true finding — and that version throws `context.getScope is not a function` the moment you put it on ESLint 9. Roughly 1.5M weekly downloads still pull it. The rest of the field is in [Benchmark: 17 ESLint Security Plugins Compared](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared).

`eslint-plugin-node-security` is the dedicated Node.js-stdlib layer — crypto, injection, filesystem, SSRF, supply chain, secrets — and the consolidation home for the retired crypto plugin. It doesn't compete with the framework plugins; it sits under them.

> **The Hardened Stack** · **`eslint-plugin-node-security` (current)** | [`eslint-plugin-express-security` →](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security) | [`eslint-plugin-nestjs-security` →](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules) | [`eslint-plugin-jwt-security` →](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt-security). Writing code with an assistant? See how often it ships these exact bugs in [I Let Claude Write 80 Functions](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities).

---

## Links

- 📦 [npm: eslint-plugin-node-security](https://www.npmjs.com/package/eslint-plugin-node-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-node-security/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-node-security)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your Node.js code does any of the above.
::

---

_[eslint-plugin-node-security](https://www.npmjs.com/package/eslint-plugin-node-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
