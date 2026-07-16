---
title: "Node.js Security Bugs That Pass Code Review Every Day — 34 Static Analysis Rules That Don't"
description: "Path traversal via fs, child_process injection, eval usage, prototype pollution — Node.js built-in footguns that survive code review and ship as CVEs. Here's the guard that catches all of them in CI."
slug: "getting-started-eslint-plugin-node-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-node-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-crypto-4a8g"
devto_id: 3143570
published_at: "2026-01-02T15:15:04Z"
edited_at: "2026-02-03T04:59:37Z"
cover_image: "https://ofriperetz.dev/og/cover/getting-started-eslint-plugin-node-security"
social_image: "https://ofriperetz.dev/og/article/getting-started-eslint-plugin-node-security"
reading_time_minutes: 9
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

These four lines have shipped as CVEs. They passed code review first.

```ts
crypto.createHash("md5").update(password).digest("hex"); // weak hash (CWE-327)
exec(`convert ${req.query.file} out.png`);               // command injection (CWE-78)
await unzipper.extract({ path: dest });                  // Zip Slip path traversal (CWE-22)
const token = Math.random().toString(36).slice(2);       // predictable token (CWE-338)
```

Each one is a property of the Node.js standard library used the easy way instead of the safe way. They pass type-checking. They pass unit tests (the test feeds trusted input). Then they ship, and a researcher finds them with `grep`.

Below is the case file: what each bug looks like, why it survived review, which rule catches it, and how to fix it. At the end: the single install that gates all four in CI.

> **The Hardened Stack series** · **`eslint-plugin-node-security` (you are here)** → [`eslint-plugin-express-security`](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security) → [`eslint-plugin-nestjs-security`](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules) → [`eslint-plugin-jwt`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt). This is the stdlib floor every other layer stands on. New here? Start with [The 30-Minute Security Audit](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase), the protocol these plugins plug into.

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

`createHash("md5")` and `createHash("sha256")` differ by one string literal. In a 40-line PR about a new export feature, a reviewer scanning for logic bugs reads `createHash(...)` as "they're hashing something" and moves on — the algorithm name is the kind of detail the eye rounds off. The line is also typed: the function signature is correct, the return type is correct, nothing is red. There's no signal that the argument is wrong.

**The rule**

```text
  4:3  error  🔒 CWE-327 OWASP:A04-Cryptographic CVSS:7.5
              Use of weak hash algorithm: MD5. MD5 is cryptographically broken
              and unsuitable for security purposes.
              Fix: Replace with sha256: crypto.createHash("sha256").update(data)
              [PCI-DSS, HIPAA, ISO27001, NIST-CSF]
```

**Fix**

```ts
// ✅
crypto.createHash("sha256").update(password).digest("hex");
```

Related rules in the same category: `no-sha1-hash`, `no-ecb-mode` (CWE-327), `no-static-iv` (CWE-329), `no-math-random-crypto` (CWE-338), `no-timing-unsafe-compare` (CWE-208).

---

## Finding 2: Command injection (`detect-child-process`, CWE-78)

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

The `exec(\`convert ${file}\`)` line looks *more* correct than the safe version — it reads like the shell command you'd type by hand. `execFile("convert", [file])` looks fussier. The "clean code" instinct argues for the wrong one. And because the vulnerability lives in what an attacker might pass for `filename` — not in the code itself — the reviewer would need to mentally model the attack path, which isn't what code review optimizes for.

I approved an `exec()` shelling out to a media tool in a PR I led. The diff was a feature I'd asked for, and the line read like the command I'd have typed in a terminal. It sat in production until a dependency bump made me re-read the file. Nothing about my review process would have caught it.

**The rule**

```text
  3:3  error  🔒 CWE-78 Command injection via exec() with string interpolation.
              Fix: Use execFile() with an array of arguments and shell: false
```

**Fix**

```ts
// ✅ no shell — arguments as an array, no injection surface
import { execFile } from "node:child_process";
execFile("convert", [filename, "out.png"], { shell: false });
```

`exec`/`execSync` run their argument through `/bin/sh`, so any user-controlled substring is shell code. `execFile`/`spawn` with an args array and `shell: false` pass arguments directly to the binary — there's no shell to inject into.

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

**The rule**

```text
  4:25  error  🔒 CWE-22 OWASP:A01 | Non-literal filename in fs call — user
               input may reach an fs path without validation.
               Fix: Validate that path.resolve(base, userPath) stays under base
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

`eval` in application code is rare enough that reviewers flag it on sight — except when the surrounding context makes it look intentional and bounded. A template-rendering function that reaches for `eval` looks like a deliberate design choice ("this is how templates work"), not a footgun. The distinction between *evaluating an expression* and *executing attacker-controlled code* doesn't surface from the diff alone.

**The rule**

```text
  4:10  error  🔒 CWE-95 OWASP:A03 | eval() called with a non-literal expression.
               Dynamic eval is a code injection sink — ban or replace with a safe
               template engine.
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

## Here's the guard that catches all of this in CI

```bash
npm install --save-dev eslint-plugin-node-security
```

```js
// eslint.config.js — `configs` is a NAMED export
import { configs } from "eslint-plugin-node-security";

export default [
  configs.recommended, // 20 rules, production baseline
  // configs.strict,   // all 34 as errors
];
```

> **One install, four vulnerabilities blocked.** Every Node.js CI pipeline that runs ESLint and doesn't include this is betting on code review catching the `md5` string, the shell interpolation, the `../` in a path, and the `eval`. That bet has a known loss rate — [65–75% of AI-generated Node.js functions carry at least one of these](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities), and human review misses them at the same sites, for the same structural reasons.

Run it — every finding carries CWE, OWASP category, CVSS, compliance tags, and the fix:

```text
src/auth/hash.ts
  4:3  error  🔒 CWE-327 OWASP:A04-Cryptographic CVSS:7.5 | Use of weak hash algorithm: MD5.
             Fix: Replace with sha256: crypto.createHash("sha256").update(data)
             [PCI-DSS, HIPAA, ISO27001, NIST-CSF]
```

For the full picture of what the Node.js security plugin field looks like, see [Benchmark: 17 ESLint Security Plugins Compared](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83). And if you're using this as part of an onboarding protocol, [The 30-Minute Security Audit](https://dev.to/ofri-peretz/the-30-minute-security-audit-onboarding-a-new-codebase-4f91) maps exactly where this plugin fits.

---

## TL;DR

- **34 rules**, each carrying a `CWE` id, CVSS, and compliance tags (PCI-DSS / HIPAA / SOC2 / …).
- **2 presets**: `recommended` (20 rules, mixed severity — the production baseline) and `strict` (all 34 as errors).
- **Flat-config**, CommonJS, ESLint `8 || 9 || 10`, Node `>= 18`. AST-based — it lints source; no runtime peers. The former `eslint-plugin-crypto` is consolidated here (deprecated → use `node-security`).

---

## The full rule set

All 34, grouped, with each rule's declared CWE:

### Cryptography

| Rule                          | CWE      |
| ----------------------------- | -------- |
| `no-weak-hash-algorithm`      | CWE-327  |
| `no-sha1-hash`                | CWE-327  |
| `no-weak-cipher-algorithm`    | CWE-327  |
| `no-ecb-mode`                 | CWE-327  |
| `no-insecure-rsa-padding`     | CWE-327  |
| `no-deprecated-cipher-method` | CWE-327  |
| `no-static-iv`                | CWE-329  |
| `no-insecure-key-derivation`  | CWE-916  |
| `no-timing-unsafe-compare`    | CWE-208  |
| `no-self-signed-certs`        | CWE-295  |
| `no-math-random-crypto`       | CWE-338  |
| `no-cryptojs-weak-random`     | CWE-338  |
| `no-cryptojs`                 | CWE-1104 |
| `prefer-native-crypto`        | CWE-1104 |

### Injection / dynamic execution

| Rule                          | CWE    |
| ----------------------------- | ------ |
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
| `no-pii-in-logs`                    | CWE-359 |

That's all 34 (14 + 4 + 6 + 5 + 5). `recommended` turns on 20 of them (criticals as errors, a few as warnings); `strict` turns on all 34.

---

## Install

```bash
# npm
npm install --save-dev eslint-plugin-node-security
# yarn
yarn add --dev eslint-plugin-node-security
# pnpm
pnpm add --save-dev eslint-plugin-node-security
# bun
bun add --dev eslint-plugin-node-security
```

Flat config (`eslint.config.js`):

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-node-security";

export default [
  configs.recommended, // 20 rules — production baseline
  // configs.strict,    // all 34 as errors
];
```

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
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-node-security` port, with ESLint↔Oxlint parity gated in CI. The full 34-rule set runs on ESLint today. |

---

## What it does — and doesn't — see

- **Source patterns, not runtime.** It flags `createHash("md5")`, `exec(\`…${x}\`)`, and an unguarded `extract()`. It can't confirm the key in your KMS is rotated or that your archive source is trusted — it removes the "we shipped MD5 / a shell string" failure mode at the call site.
- **Taint detection has edges.** The injection and fs rules track user input toward a sink with configurable patterns; tune them rather than assuming the defaults are exhaustive, and pair with runtime input validation.

---

## Your turn

Run `configs.recommended` against your largest Node service and look at the first finding. Which vulnerability do you actually recall shipping — the `md5` left from a "temporary" password hash, the `exec()` someone added to shell out to ffmpeg, the `Math.random()` token in a password-reset flow, or the unguarded archive extract? Drop it in the comments — I'm most interested in which of these survived review the longest, and whether it was written by a human or pasted from an assistant.

---

## Where this sits in the ecosystem

The generic security linters flag a few of these (`eval`, obvious `child_process`), but they don't carry the CWE/CVSS/compliance metadata a security or audit reviewer needs, and they don't cover the crypto surface at this depth. If you want the full picture of what the field looks like, I benchmarked 17 ESLint security plugins head-to-head in [Benchmark: 17 ESLint Security Plugins Compared](https://dev.to/ofri-peretz/i-benchmarked-17-eslint-security-plugins-only-one-found-every-vulnerability-c83), and the story for the incumbent (`eslint-plugin-security`) is bleak — it's unmaintained and nobody's saying so. `eslint-plugin-node-security` is the dedicated Node.js-stdlib layer — crypto, injection, filesystem, SSRF, supply-chain, secrets — and the consolidation home for the retired crypto plugin.

> **The Hardened Stack** · **`eslint-plugin-node-security` (current)** | [`eslint-plugin-express-security` →](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security) | [`eslint-plugin-nestjs-security` →](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules) | [`eslint-plugin-jwt` →](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt). Writing code with an assistant? See how often it ships these exact bugs in [I Let Claude Write 80 Functions](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities).

---

## Links

- 📦 [npm: eslint-plugin-node-security](https://www.npmjs.com/package/eslint-plugin-node-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-node-security/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-node-security)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your Node.js code does any of the above.
::

---

*[eslint-plugin-node-security](https://www.npmjs.com/package/eslint-plugin-node-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
