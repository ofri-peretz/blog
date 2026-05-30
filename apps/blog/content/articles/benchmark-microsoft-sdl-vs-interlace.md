---
devto_url: "https://dev.to/ofri-peretz/microsofts-eslint-security-plugin-catches-10-of-vulnerabilities-heres-what-it-misses-5gii"
devto_id: 3240750
title: "Microsoft's ESLint Security Plugin Catches 10% of Vulnerabilities. Here's What It Misses."
description: "A head-to-head benchmark between @microsoft/eslint-plugin-sdl and the Interlace security ecosystem. Microsoft's SDL standard covers 1 of 14 security categories."
slug: "benchmark-microsoft-sdl-vs-interlace"
published: true
date: 2026-02-08
cover_image: https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&h=630&fit=crop
tags:
  - security
  - eslint
  - javascript
  - benchmark
series: "ESLint Security Benchmark Series"
canonical_url: https://ofriperetz.dev/articles/benchmark-microsoft-sdl-vs-interlace
reading_time_minutes: 10
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

**Skip to:** [Results](#the-results) | [Every Test Case](#every-test-case-detailed-results) | [False Positives](#the-false-positive-analysis) | [Verdict](#the-verdict)

## TL;DR

Microsoft's SDL (Security Development Lifecycle) is a respected enterprise security methodology that has shaped how Microsoft builds software since 2004. Their `@microsoft/eslint-plugin-sdl` brings a subset of those checks to ESLint — and the rules it has are **well-implemented and precise**. But the ESLint plugin covers a narrow scope: browser-side DOM security. When tested against the full spectrum of Node.js security vulnerabilities, it caught 4 out of 40.

| Metric                  | @microsoft/eslint-plugin-sdl | Interlace Ecosystem |
| :---------------------- | :--------------------------- | :------------------ |
| **Rules**               | 17                           | 201                 |
| **Security Detections** | 4/40 (10%)                   | **40/40 (100%)**    |
| **Missed**              | 36 vulnerabilities           | **0**               |
| **False Alarms**        | 1                            | **0**               |
| **Precision**           | 80.0%                        | **100.0%**          |
| **F1 Score**            | 17.8%                        | **100.0%**          |

> 💡 **Key takeaway:** The SDL ESLint plugin is excellent at what it does — browser DOM security and code execution prevention. But if your app has a server-side backend, the plugin leaves 12 of 14 security categories uncovered. **Use it alongside Node.js-specific security plugins** for full coverage.

---

## What Is @microsoft/eslint-plugin-sdl?

Microsoft's SDL (Security Development Lifecycle) is the company's internal security standard that has governed product development since 2004. It's one of the most influential security frameworks in the industry — every Microsoft product goes through SDL review.

The `@microsoft/eslint-plugin-sdl` ESLint plugin packages a **subset** of SDL checks as static analysis rules. With ~100K weekly downloads and active maintenance, it brings Microsoft's security expertise to the ESLint ecosystem.

### What Makes SDL Valuable

- **Enterprise pedigree** — Built from the same methodology that secures Windows, Azure, and Office
- **High precision** — 80% precision means most warnings are real issues, not noise
- **Clear error messages** — Every rule produces actionable, well-written diagnostics
- **ESLint 9 compatible** — Actively maintained with flat config support
- **Smart rule re-exporting** — Bundles relevant ESLint core rules (`no-eval`, `no-new-func`) alongside custom SDL rules

This benchmark tests a specific question: _how far does the ESLint plugin go when your goal is comprehensive Node.js security coverage?_

---

## Test Setup

| Component         | Microsoft SDL           | Interlace                      |
| :---------------- | :---------------------- | :----------------------------- |
| **Version**       | 1.1.0                   | 3.0.2 (secure-coding lead)     |
| **Total Rules**   | 17                      | 201 (11 security plugins)      |
| **Configuration** | `recommended`           | `recommended` (all 11 plugins) |
| **ESLint**        | 9.39.2                  | 9.39.2                         |
| **Node.js**       | v20.19.5                | v20.19.5                       |
| **Platform**      | macOS (darwin/arm64)    | Same                           |
| **Fixtures**      | 40 vulnerable + 38 safe | Same fixtures                  |

Both plugins tested with their recommended presets — the out-of-box experience a developer gets after `npm install`.

---

## The Results

### Detection Summary

```
Vulnerable Code Detections (out of 40 patterns):

Interlace:       ████████████████████████████████████████  40/40 (100%)
Microsoft SDL:   ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   4/40 (10%)
```

### Category-by-Category Summary

| Category              | Cases  | MS SDL     | Interlace | MS SDL Rules Triggered                                         |
| :-------------------- | :----- | :--------- | :-------- | :------------------------------------------------------------- |
| SQL Injection         | 4      | ❌ **0/4** | ✅ 4/4    | —                                                              |
| Command Injection     | 4      | ❌ **0/4** | ✅ 4/4    | —                                                              |
| Path Traversal        | 4      | ❌ **0/4** | ✅ 4/4    | —                                                              |
| Hardcoded Credentials | 4      | ❌ **0/4** | ✅ 4/4    | —                                                              |
| JWT Vulnerabilities   | 3      | ❌ **0/3** | ✅ 3/3    | —                                                              |
| XSS / Code Execution  | 4      | ✅ **4/4** | ✅ 4/4    | `no-inner-html`, `no-document-write`, `no-eval`, `no-new-func` |
| Prototype Pollution   | 3      | ❌ **0/3** | ✅ 3/3    | —                                                              |
| Insecure Randomness   | 2      | ❌ **0/2** | ✅ 2/2    | —                                                              |
| Weak Cryptography     | 3      | ❌ **0/3** | ✅ 3/3    | —                                                              |
| Timing Attacks        | 2      | ❌ **0/2** | ✅ 2/2    | —                                                              |
| NoSQL Injection       | 2      | ❌ **0/2** | ✅ 2/2    | —                                                              |
| SSRF                  | 2      | ❌ **0/2** | ✅ 2/2    | —                                                              |
| Open Redirect         | 1      | ❌ **0/1** | ✅ 1/1    | —                                                              |
| ReDoS                 | 2      | ❌ **0/2** | ✅ 2/2    | —                                                              |
| **TOTAL**             | **40** | **4/40**   | **40/40** | **4 unique rules**                                             |

**Microsoft SDL achieved a perfect 4/4 in its focus area** (XSS / code execution). It was designed for browser DOM security, and that's exactly what it delivers.

---

## Every Test Case: Detailed Results

Below is every vulnerable pattern in the benchmark, organized by what SDL detected and what it didn't.

### XSS / Code Execution (CWE-79, CWE-94) — MS SDL: 4/4 ✅

This is SDL's strength. It caught every XSS and code execution pattern:

```javascript
// Test 1: innerHTML — MS SDL ✅ @microsoft/sdl/no-inner-html | Interlace ✅
export function vuln_xss_innerhtml(userContent) {
  document.getElementById("output").innerHTML = userContent;
}
// MS SDL: "Do not write to DOM directly using innerHTML/outerHTML property"

// Test 2: document.write — MS SDL ✅ @microsoft/sdl/no-document-write | Interlace ✅
export function vuln_xss_document_write(userInput) {
  document.write("<div>" + userInput + "</div>");
}
// MS SDL: "Do not write to DOM directly using document.write or document.writeln methods"

// Test 3: eval() — MS SDL ✅ no-eval (re-exported) | Interlace ✅
export function vuln_xss_eval(userCode) {
  return eval(userCode);
}
// MS SDL: "eval can be harmful."

// Test 4: new Function() — MS SDL ✅ no-new-func (re-exported) | Interlace ✅
export function vuln_xss_new_function(userCode) {
  const fn = new Function(userCode);
  return fn();
}
// MS SDL: "The Function constructor is eval."
```

> **Full marks for Microsoft SDL here.** The `no-inner-html` and `no-document-write` rules are custom SDL rules with clear, actionable messages. The plugin also smartly re-exports ESLint's core `no-eval` and `no-new-func` rules, ensuring XSS/code execution is fully covered from one `recommended` config.

### SQL Injection (CWE-89) — MS SDL: 0/4

```javascript
// Test 1: String concatenation — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_sql_string_concat(userId) {
  const query = "SELECT * FROM users WHERE id = '" + userId + "'";
  return db.query(query);
}

// Test 2: Template literal — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_sql_template_literal(email) {
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  return db.query(query);
}

// Test 3: Dynamic column name — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_sql_dynamic_column(sortColumn) {
  const query = `SELECT * FROM users ORDER BY ${sortColumn}`;
  return db.query(query);
}

// Test 4: Conditional query building — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_sql_conditional(filters) {
  let query = "SELECT * FROM products WHERE 1=1";
  if (filters.name) {
    query += ` AND name = '${filters.name}'`;
  }
  return db.query(query);
}
```

> SQL injection is a server-side concern. SDL's ESLint plugin focuses on browser-side code, so it doesn't include database query rules. Interlace covers this with `pg/no-sql-injection` and `secure-coding/database-injection`.

### Command Injection (CWE-78) — MS SDL: 0/4

```javascript
// Test 1: exec() with concatenation — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_cmd_exec_concat(filename) {
  const { exec } = require("child_process");
  exec("ls -la " + filename, callback);
}

// Test 2: exec() with template literal — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_cmd_exec_template(filename) {
  const { exec } = require("child_process");
  exec(`convert ${filename} output.png`, callback);
}

// Test 3: execSync() — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_cmd_execsync(command) {
  const { execSync } = require("child_process");
  return execSync(command).toString();
}

// Test 4: spawn() with shell: true — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_cmd_spawn_shell(userCommand) {
  const { spawn } = require("child_process");
  return spawn(userCommand, { shell: true });
}
```

> `child_process` is a Node.js API — outside SDL's browser-focused scope. Interlace covers this with `node-security/detect-child-process`.

### Path Traversal (CWE-22) — MS SDL: 0/4

```javascript
// Test 1: path.join with user input — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_path_join(filename) {
  const filepath = path.join("./uploads", filename);
  return fs.readFileSync(filepath);
}

// Test 2: String concatenation — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_path_concat(userId) {
  return fs.readFileSync("./data/" + userId + "/profile.json");
}

// Test 3: No validation — MISSED by MS SDL ❌ | Interlace ✅
export async function vuln_path_no_validation(userDir) {
  return fs.readdir(`./storage/${userDir}`);
}

// Test 4: URL pathname — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_path_url_pathname(url) {
  const parsedUrl = new URL(url);
  return fs.readFileSync(`./static${parsedUrl.pathname}`);
}
```

### Hardcoded Credentials (CWE-798) — MS SDL: 0/4

```javascript
// Test 1: Database password — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_creds_db_password() {
  return new Pool({
    password: "secretPassword123",
  });
}

// Test 2: API key — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_creds_api_key() {
  const apiKey = "sk-prod-abc123def456ghi789jkl012mno345pqr678";
  return fetch("https://api.example.com", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

// Test 3: AWS credentials — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_creds_aws() {
  AWS.config.update({
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  });
}

// Test 4: JWT secret — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_creds_jwt_secret(user) {
  return jwt.sign(user, "my-super-secret-jwt-key-12345");
}
```

### JWT Vulnerabilities (CWE-757, CWE-347) — MS SDL: 0/3

```javascript
// Test 1: Algorithm "none" — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_jwt_alg_none(token) {
  return jwt.verify(token, "secret", { algorithms: ["none", "HS256"] });
}

// Test 2: No algorithm restriction — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_jwt_no_algorithm(token, secret) {
  return jwt.verify(token, secret);
}

// Test 3: No expiration — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_jwt_no_expiry(user) {
  return jwt.sign(user, process.env.JWT_SECRET);
}
```

### Prototype Pollution (CWE-1321) — MS SDL: 0/3

```javascript
// Test 1: Bracket notation — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_proto_bracket(obj, key, value) {
  obj[key] = value;
  return obj;
}

// Test 2: Deep nested manipulation — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_proto_nested(obj, path, value) {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

// Test 3: Object.assign with parsed JSON — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_proto_assign(userInput) {
  const config = {};
  Object.assign(config, JSON.parse(userInput));
  return config;
}
```

### Insecure Randomness (CWE-330) — MS SDL: 0/2

```javascript
// Test 1: Math.random() for token — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_random_token() {
  return Math.random().toString(36).substring(2);
}

// Test 2: Math.random() for session — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_random_session() {
  return "session_" + Math.floor(Math.random() * 1000000);
}
```

### Weak Cryptography (CWE-327, CWE-328) — MS SDL: 0/3

```javascript
// Test 1: MD5 hash — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_crypto_md5(password) {
  return crypto.createHash("md5").update(password).digest("hex");
}

// Test 2: SHA1 hash — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_crypto_sha1(sensitiveData) {
  return crypto.createHash("sha1").update(sensitiveData).digest("hex");
}

// Test 3: DES encryption — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_crypto_des(plaintext) {
  const cipher = crypto.createCipher("des", "password");
  return cipher.update(plaintext, "utf8", "hex") + cipher.final("hex");
}
```

### Timing Attacks (CWE-208) — MS SDL: 0/2

```javascript
// Test 1: Direct comparison — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_timing_direct(input, secret) {
  return input === secret;
}

// Test 2: Token comparison — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_timing_token(userToken, storedToken) {
  if (userToken === storedToken) {
    return { authenticated: true };
  }
}
```

### NoSQL Injection (CWE-943) — MS SDL: 0/2

```javascript
// Test 1: MongoDB findOne — MISSED by MS SDL ❌ | Interlace ✅
export async function vuln_nosql_mongo(username) {
  return db.collection("users").findOne({ username });
}

// Test 2: $where operator — MISSED by MS SDL ❌ | Interlace ✅
export async function vuln_nosql_where(userInput) {
  return db.collection("users").find({ $where: userInput });
}
```

### SSRF (CWE-918) — MS SDL: 0/2

```javascript
// Test 1: fetch with user URL — MISSED by MS SDL ❌ | Interlace ✅
export async function vuln_ssrf_fetch(userUrl) {
  const response = await fetch(userUrl);
  return response.json();
}

// Test 2: axios with user URL — MISSED by MS SDL ❌ | Interlace ✅
export async function vuln_ssrf_axios(endpoint) {
  return axios.get(endpoint);
}
```

### Open Redirect (CWE-601) — MS SDL: 0/1

```javascript
// Test 1: Express redirect — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_redirect(req, res) {
  const returnUrl = req.query.returnTo;
  res.redirect(returnUrl);
}
```

### ReDoS (CWE-1333) — MS SDL: 0/2

```javascript
// Test 1: Evil regex — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_redos_evil(input) {
  const evilRegex = /^(a+)+$/;
  return evilRegex.test(input);
}

// Test 2: User-controlled regex — MISSED by MS SDL ❌ | Interlace ✅
export function vuln_redos_user(pattern, input) {
  const regex = new RegExp(pattern);
  return regex.test(input);
}
```

---

## The False Positive Analysis

Microsoft SDL produced **1 false positive** — impressively low. Here's what happened:

### FP 1: DOMPurify-Sanitized innerHTML

```javascript
// ✅ SAFE: innerHTML with DOMPurify sanitization — MS SDL flags ❌
export function safe_xss_dompurify(userContent) {
  const DOMPurify = require("dompurify");
  const sanitized = DOMPurify.sanitize(userContent);
  document.getElementById("output").innerHTML = sanitized;
}
// MS SDL @microsoft/sdl/no-inner-html:
// "Do not write to DOM directly using innerHTML/outerHTML property"
```

> **Why it's a false positive:** DOMPurify is the industry-standard sanitization library. Content passed through `DOMPurify.sanitize()` is safe for `innerHTML` assignment. SDL's rule flags all `innerHTML` usage regardless of sanitization — a pragmatic design choice that prioritizes safety over precision. Interlace correctly passes this pattern because it recognizes DOMPurify as a trusted sanitizer.

**To be fair:** Only 1 false positive out of 38 safe patterns is a **2.6% false positive rate** — one of the lowest in the entire benchmark. SDL's rules are clearly well-calibrated.

---

## The Verdict

| Dimension               | Microsoft SDL | Interlace | Winner           |
| :---------------------- | :------------ | :-------- | :--------------- |
| **Total Rules**         | 17            | 201       | 🟢 Interlace     |
| **Security Detection**  | 10%           | 100%      | 🟢 **Interlace** |
| **Precision**           | 80%           | 100%      | 🟢 **Interlace** |
| **False Positive Rate** | 2.6%          | 0%        | 🟢 **Interlace** |
| **Category Coverage**   | 1/14          | 14/14     | 🟢 **Interlace** |
| **ESLint 9 Support**    | ✅            | ✅        | Tie              |
| **Active Maintenance**  | ✅            | ✅        | Tie              |

### Where Microsoft SDL Excels

Let's give credit where it's due. **Microsoft SDL does its job well:**

**Browser DOM security (its focus area):**

- ✅ **XSS Prevention**: 4/4 — Perfect score. Catches `innerHTML`, `document.write`, `eval`, and `new Function()`
- ✅ **Precision**: 80% — Most warnings are real issues, not noise
- ✅ **Error Messages**: Clear, actionable diagnostics that tell developers what's wrong
- ✅ **Smart Bundling**: Re-exports relevant ESLint core rules so one config covers the full XSS attack surface

**Additional browser rules not covered in this benchmark:**

- 🛡️ `no-document-domain` — Prevents frame security bypass
- 🛡️ `no-cookies` — Flags direct `document.cookie` access
- 🛡️ `no-postmessage-star-origin` — Prevents cross-origin data leaks via `postMessage("*")`
- 🛡️ `no-msapp-exec-unsafe` — Windows UWP security
- 🛡️ `no-winjs-html-unsafe` — WinJS security

For teams building **browser-only JavaScript** (no Node.js backend), SDL provides a solid, enterprise-grade foundation.

### Where SDL Needs Complementary Tools

SDL's ESLint plugin was built for browser JavaScript. For a modern Node.js application, these server-side categories aren't covered:

- SQL Injection (0/4) — No database query rules
- Command Injection (0/4) — No `child_process` rules
- Path Traversal (0/4) — No `fs` module rules
- Hardcoded Credentials (0/4) — No secret detection
- JWT (0/3) — No authentication rules
- Prototype Pollution (0/3) — No object injection rules
- Weak Crypto (0/3) — No `crypto` module rules
- Insecure Randomness (0/2) — No `Math.random()` detection
- Timing Attacks (0/2) — No timing-safe rules
- NoSQL Injection (0/2) — No MongoDB rules
- SSRF (0/2) — No outbound request rules
- Open Redirect (0/1) — No Express rules
- ReDoS (0/2) — No regex complexity rules

This isn't a flaw in SDL — it's a **scope boundary**. The SDL methodology itself covers all of these categories. The ESLint plugin implements only the browser-relevant subset. For the rest, you need Node.js-specific tools.

### Recommendation: Use Both

**The best enterprise config combines SDL's browser security with Node.js-specific security plugins:**

```javascript
// eslint.config.js — Enterprise security: SDL + Interlace
import sdl from "@microsoft/eslint-plugin-sdl";
import secureCoding from "eslint-plugin-secure-coding";
import nodeSecurity from "eslint-plugin-node-security";
import pg from "eslint-plugin-pg";
import jwt from "eslint-plugin-jwt";

export default [
  ...sdl.configs.recommended, // Browser DOM security ✅
  secureCoding.configs.recommended, // Core OWASP patterns ✅
  nodeSecurity.configs.recommended, // Node.js runtime ✅
  pg.configs.recommended, // Database layer ✅
  jwt.configs.recommended, // Auth layer ✅
];
```

SDL gives you enterprise compliance and browser security. Interlace gives you full-stack Node.js coverage. Together, they cover the entire attack surface.

---

## Methodology

### Fixture Design

All 40 vulnerable patterns are real-world code from production codebases, annotated with CWE identifiers and severity ratings. The 38 safe patterns are correctly-implemented secure alternatives that should NOT trigger warnings.

### Reproducibility

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite
cd eslint-benchmark-suite
npm install
npm run benchmark:fn-fp
```

Every claim in this article comes from the [published benchmark results](https://github.com/ofri-peretz/eslint-benchmark-suite/tree/main/results/fn-fp-comparison) and can be independently verified.

---

## Part of the Benchmark Series

This article is part of the [ESLint Security Benchmark Series](/articles/benchmark-17-eslint-security-plugins-compared):

- **📊 [17 Plugins Benchmarked: The Full Ecosystem Report](/articles/benchmark-17-eslint-security-plugins-compared)**
- [SonarJS vs Interlace: 269 Rules, 65% Missed](/articles/benchmark-sonarjs-vs-interlace)
- **📖 You are here: Microsoft SDL vs Interlace**
- [eslint-plugin-security Is Abandoned](/articles/eslint-plugin-security-abandoned)

---

## Explore the Full Ecosystem

> **201 security rules. 11 specialized plugins. 100% detection. 0 false positives.**
>
> [📖 Documentation](https://eslint.interlace.tools) | [⭐ GitHub](https://github.com/ofri-peretz/eslint) | [📦 NPM](https://npmjs.com/~ofriperetz)

---

**Next in the ESLint Security Benchmark Series:**

- 17 ESLint Security Plugins Benchmarked: The Full Ecosystem Report
- Quality Linters Benchmarked: Unicorn vs SonarJS vs Interlace

**Follow [@ofri-peretz](https://dev.to/ofri-peretz) to get notified.**

---

**Build Securely.**

I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=microsoft-sdl-benchmark) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
