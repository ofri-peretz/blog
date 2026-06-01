---
title: "MD5, exec(), and Zip Slip: 34 ESLint Rules That Fail Your Node.js CI Before They Ship."
description: "Weak crypto (MD5/SHA-1/ECB), command injection via exec(), Zip Slip path traversal, Math.random() tokens — Node.js built-in footguns that pass tests and ship as CVEs. 34 CWE-mapped ESLint rules that catch them in CI."
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
  - "eslint"
  - "node"
  - "security"
  - "cryptography"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Hardened Stack"
---

Four lines, four CVEs, zero compiler complaints:

```ts
crypto.createHash("md5").update(password).digest("hex"); // broken hash (CWE-327)
exec(`convert ${req.query.file} out.png`); // command injection (CWE-78)
await unzipper.extract({ path: dest }); // Zip Slip path traversal (CWE-22)
const token = Math.random().toString(36).slice(2); // predictable token (CWE-338)
```

Every one of these is a property of the **Node.js standard library** — `crypto`,
`child_process`, `fs`, `Math` — used the easy way instead of the safe way. They
pass type-checking. They pass unit tests (the test feeds trusted input). Then
they ship, and a researcher finds them with `grep`.

`eslint-plugin-node-security` reads those call sites and fails CI on the
dangerous shape. It's **34 rules** spanning weak crypto, command/eval injection,
filesystem traversal, SSRF, supply-chain, and secrets-at-rest — each pinned to a
CWE, CVSS, and compliance tags. (It also **absorbed the deprecated
`eslint-plugin-crypto`** — all the cipher/hash/randomness rules live here now.)

This guide walks the crypto footguns, command injection, Zip Slip, the full
34-rule map, and exact install/engine support.

---

## TL;DR

- **34 rules**, each carrying a `CWE` id, CVSS, and compliance tags
  (PCI-DSS / HIPAA / SOC2 / …).
- **2 presets**: `recommended` (20 rules, mixed severity — the production
  baseline) and `strict` (all 34 as errors).
- **Flat-config**, CommonJS, ESLint `8 || 9 || 10`, Node `>= 18`. AST-based — it
  lints source; no runtime peers. The former `eslint-plugin-crypto` is
  consolidated here (deprecated → use `node-security`).

---

## The crypto footguns

Node's `crypto` API will happily hand you broken primitives. Several rules,
mostly **CWE-327** (broken/risky algorithm), draw the line:

```ts
// ❌ no-weak-hash-algorithm (CWE-327) — MD5/SHA-1 are collision-broken
crypto.createHash("md5").update(data);
// ❌ no-ecb-mode (CWE-327) — ECB leaks plaintext structure
crypto.createCipheriv("aes-256-ecb", key, null);
// ❌ no-static-iv (CWE-329) — a fixed IV destroys CBC/GCM security
crypto.createCipheriv("aes-256-gcm", key, FIXED_IV);
// ❌ no-math-random-crypto (CWE-338) — Math.random() is not a CSPRNG
const token = Math.random().toString(36).slice(2);
```

```ts
// ✅
crypto.createHash("sha256").update(data);
crypto.createCipheriv("aes-256-gcm", key, crypto.randomBytes(12)); // unique IV
const token = crypto.randomBytes(32).toString("hex"); // CSPRNG
```

The companion rules cover the rest of the surface: `no-weak-cipher-algorithm`,
`no-sha1-hash`, `no-insecure-rsa-padding`, `no-deprecated-cipher-method`,
`no-insecure-key-derivation` (CWE-916, e.g. low-iteration PBKDF2),
`no-timing-unsafe-compare` (CWE-208, use `crypto.timingSafeEqual`),
`no-self-signed-certs` (CWE-295), and `no-cryptojs` / `prefer-native-crypto`
(CWE-1104, prefer the audited native module over `crypto-js`).

---

## Command injection — `detect-child-process` (CWE-78)

```ts
// ❌ shell string interpolation = command injection
import { exec } from "node:child_process";
exec(`convert ${req.query.file} out.png`); // file="x.png; rm -rf /"
```

```ts
// ✅ no shell, arguments as an array — the rule's own fix
import { execFile } from "node:child_process";
execFile("convert", [req.query.file, "out.png"], { shell: false });
```

`exec`/`execSync` run their argument through `/bin/sh`, so any user-controlled
substring is shell code. `execFile`/`spawn` with an args array and
`shell: false` pass arguments directly to the binary — there's no shell to
inject into. `detect-eval-with-expression` (CWE-95) and `no-dynamic-require`
(CWE-94) close the analogous `eval`/`require()` holes.

---

## Zip Slip — `no-zip-slip` (CWE-22)

Extracting an archive without validating entry paths lets a crafted entry
(`../../../../etc/cron.d/x`) write **outside** the destination directory:

```ts
// ❌ no-zip-slip (CWE-22) — entry path is trusted
zip.extractAllTo(dest);
```

```ts
// ✅ resolve each entry and confirm it stays under dest
const target = path.resolve(dest, entry.name);
if (!target.startsWith(path.resolve(dest) + path.sep))
  throw new Error("Zip Slip");
```

`detect-non-literal-fs-filename` and `no-arbitrary-file-access` (both CWE-22)
catch the broader "user input reaches an `fs` path" pattern;
`no-toctou-vulnerability` (CWE-367) catches the check-then-use race.

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

That's all 34 (14 + 4 + 6 + 5 + 5). `recommended` turns on 20 of them (criticals
as errors, a few as warnings); `strict` turns on all 34.

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

Run it — findings carry the CWE, OWASP category, CVSS, compliance tags, and fix:

```text
src/auth/hash.ts
  4:3  error  🔒 CWE-327 OWASP:A04-Cryptographic CVSS:7.5 | Use of weak hash algorithm: MD5. MD5 is cryptographically broken and unsuitable for security purposes. | CRITICAL [PCI-DSS,HIPAA,ISO27001,NIST-CSF]
             Fix: Replace with sha256: crypto.createHash("sha256").update(data)
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

- **Source patterns, not runtime.** It flags `createHash("md5")`, `exec(\`…${x}\`)`,
and an unguarded `extract()`. It can't confirm the key in your KMS is rotated
  or that your archive source is trusted — it removes the "we shipped MD5 / a
  shell string" failure mode at the call site.
- **Taint detection has edges.** The injection and fs rules track user input
  toward a sink with configurable patterns; tune them rather than assuming the
  defaults are exhaustive, and pair with runtime input validation.

---

## Where this sits in the ecosystem

The generic security linters flag a few of these (`eval`, obvious `child_process`),
but they don't carry the CWE/CVSS/compliance metadata a security or audit
reviewer needs, and they don't cover the crypto surface at this depth.
`eslint-plugin-node-security` is the dedicated Node.js-stdlib layer — crypto,
injection, filesystem, SSRF, supply-chain, secrets — and the consolidation home
for the retired crypto plugin. It's the runtime-foundation member of the
[Interlace](https://eslint.interlace.tools) family, underneath the
framework-specific plugins (`-express-security`, `-nestjs-security`, …).

---

## Links

- 📦 [npm: eslint-plugin-node-security](https://www.npmjs.com/package/eslint-plugin-node-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-node-security/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-node-security)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your Node.js code does any of the above.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-node-security`
is its Node.js-standard-library layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
