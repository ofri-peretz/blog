---
devto_url: "https://dev.to/ofri-peretz/sonarjs-has-269-rules-it-still-misses-65-of-security-vulnerabilities-3jh"
devto_id: 3240739
title: "SonarJS Has 269 Rules. It Still Misses 65% of Security Vulnerabilities."
description: "A head-to-head benchmark between eslint-plugin-sonarjs and the Interlace security ecosystem. 269 rules vs 201 rules — more isn't better when 65% of vulnerabilities slip through."
slug: "benchmark-sonarjs-vs-interlace"
published: true
date: 2026-02-08
cover_image: https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&h=630&fit=crop
tags:
  - security
  - eslint
  - javascript
  - benchmark
series: "ESLint Security Benchmark Series"
canonical_url: https://ofriperetz.dev/articles/benchmark-sonarjs-vs-interlace
reading_time_minutes: 12
author:
  name: Ofri Peretz
  avatar: https://avatars.githubusercontent.com/u/46347627
  title: Security Engineering Leader
---

**Skip to:** [Results](#the-results) | [Every Test Case](#every-test-case-detailed-results) | [False Positives](#the-false-positive-analysis) | [Verdict](#the-verdict)

## TL;DR

SonarJS is an excellent code quality tool — one of the best in the ESLint ecosystem. But when we tested it specifically for **security detection**, it caught 14 out of 40 vulnerabilities while Interlace caught all 40. That's not a flaw in SonarJS — it's a scope difference. SonarJS was built for quality. Security is where dedicated tools shine.

| Metric                  | eslint-plugin-sonarjs | Interlace Ecosystem  |
| :---------------------- | :-------------------- | :------------------- |
| **Rules**               | 269                   | 201                  |
| **Security Detections** | 14/40 (35%)           | **40/40 (100%)**     |
| **Missed**              | 26 vulnerabilities    | **0**                |
| **False Alarms**        | 5                     | **0**                |
| **F1 Score**            | 47.5%                 | **100.0%**           |
| **Category Coverage**   | 7/14 categories       | **14/14 categories** |

> 💡 **Key takeaway:** SonarJS excels at code quality, cognitive complexity, and code smell detection. But relying on it _alone_ for security leaves gaps in 7 OWASP attack categories. The best setup? **Use both** — SonarJS for quality, Interlace for security.

---

## Why SonarJS?

`eslint-plugin-sonarjs` is SonarSource's official ESLint plugin, extracted from their SonarQube/SonarCloud analysis engine. With **3M+ weekly downloads** and **269 rules**, it's one of the most popular and well-maintained ESLint plugins in the ecosystem — and for good reason.

SonarJS brings enterprise-grade code quality rules to ESLint: cognitive complexity analysis, dead code detection, code smell identification, and strong security rules for categories like command injection and weak cryptography. Many teams adopt it as part of their SonarQube/SonarCloud pipeline, and it delivers real value.

But SonarJS was designed as a **general-purpose quality tool** — not a dedicated security scanner. This benchmark tests a specific question: _how far does SonarJS go when your goal is comprehensive Node.js security coverage?_

---

## Test Setup

| Component         | SonarJS                 | Interlace                      |
| :---------------- | :---------------------- | :----------------------------- |
| **Version**       | 3.0.6                   | 3.0.2 (secure-coding lead)     |
| **Total Rules**   | 269                     | 201 (11 security plugins)      |
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

Interlace:   ████████████████████████████████████████  40/40 (100%)
SonarJS:     ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  14/40 (35%)
```

### Category-by-Category Summary

| Category              | Cases  | SonarJS    | Interlace | SonarJS Rules Triggered                                 |
| :-------------------- | :----- | :--------- | :-------- | :------------------------------------------------------ |
| SQL Injection         | 4      | ❌ **0/4** | ✅ 4/4    | —                                                       |
| Command Injection     | 4      | ✅ **4/4** | ✅ 4/4    | `sonarjs/os-command`                                    |
| Path Traversal        | 4      | ❌ **0/4** | ✅ 4/4    | —                                                       |
| Hardcoded Credentials | 4      | ⚠️ **2/4** | ✅ 4/4    | `no-hardcoded-passwords`, `hardcoded-secret-signatures` |
| JWT Vulnerabilities   | 3      | ⚠️ **1/3** | ✅ 3/3    | `insecure-jwt-token`                                    |
| XSS / Code Execution  | 4      | ⚠️ **2/4** | ✅ 4/4    | `sonarjs/code-eval`                                     |
| Prototype Pollution   | 3      | ❌ **0/3** | ✅ 3/3    | —                                                       |
| Insecure Randomness   | 2      | ✅ **2/2** | ✅ 2/2    | `sonarjs/pseudo-random`                                 |
| Weak Cryptography     | 3      | ⚠️ **2/3** | ✅ 3/3    | `sonarjs/hashing`                                       |
| Timing Attacks        | 2      | ❌ **0/2** | ✅ 2/2    | —                                                       |
| NoSQL Injection       | 2      | ❌ **0/2** | ✅ 2/2    | —                                                       |
| SSRF                  | 2      | ❌ **0/2** | ✅ 2/2    | —                                                       |
| Open Redirect         | 1      | ❌ **0/1** | ✅ 1/1    | —                                                       |
| ReDoS                 | 2      | ⚠️ **1/2** | ✅ 2/2    | `sonarjs/slow-regex`                                    |
| **TOTAL**             | **40** | **14/40**  | **40/40** | **8 unique rules**                                      |

**SonarJS has zero coverage for 7 of 14 categories**: SQL injection, path traversal, prototype pollution, timing attacks, NoSQL injection, SSRF, and open redirect.

---

## Every Test Case: Detailed Results

Below is every vulnerable pattern in the benchmark, the exact code tested, and what each plugin detected.

### SQL Injection (CWE-89) — SonarJS: 0/4

```javascript
// Test 1: String concatenation — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_sql_string_concat(userId) {
  const query = "SELECT * FROM users WHERE id = '" + userId + "'";
  return db.query(query);
}
// Interlace: pg/no-sql-injection, secure-coding/database-injection

// Test 2: Template literal — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_sql_template_literal(email) {
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  return db.query(query);
}

// Test 3: Dynamic column name — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_sql_dynamic_column(sortColumn) {
  const query = `SELECT * FROM users ORDER BY ${sortColumn}`;
  return db.query(query);
}

// Test 4: Conditional query building — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_sql_conditional(filters) {
  let query = "SELECT * FROM products WHERE 1=1";
  if (filters.name) {
    query += ` AND name = '${filters.name}'`;
  }
  return db.query(query);
}
```

> **Why SonarJS misses these:** SonarJS has no SQL-specific taint analysis. It doesn't track user input flowing into `db.query()` calls. Interlace uses context-aware rules that understand database client APIs.

### Command Injection (CWE-78) — SonarJS: 4/4 ✅

```javascript
// Test 1: exec() with concatenation — SonarJS ✅ sonarjs/os-command | Interlace ✅
export function vuln_cmd_exec_concat(filename) {
  const { exec } = require("child_process");
  exec("ls -la " + filename, callback);
}
// SonarJS: "Make sure that executing this OS command is safe here."

// Test 2: exec() with template literal — SonarJS ✅ sonarjs/os-command | Interlace ✅
export function vuln_cmd_exec_template(filename) {
  const { exec } = require("child_process");
  exec(`convert ${filename} output.png`, callback);
}

// Test 3: execSync() — SonarJS ✅ sonarjs/os-command | Interlace ✅
export function vuln_cmd_execsync(command) {
  const { execSync } = require("child_process");
  return execSync(command).toString();
}

// Test 4: spawn() with shell: true — SonarJS ✅ sonarjs/os-command | Interlace ✅
export function vuln_cmd_spawn_shell(userCommand) {
  const { spawn } = require("child_process");
  return spawn(userCommand, { shell: true });
}
```

> **Credit to SonarJS:** This is its strongest category — `sonarjs/os-command` catches all 4 patterns, including the subtle `spawn({shell: true})` case.

### Path Traversal (CWE-22) — SonarJS: 0/4

```javascript
// Test 1: path.join with user input — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_path_join(filename) {
  const filepath = path.join("./uploads", filename);
  return fs.readFileSync(filepath);
}

// Test 2: String concatenation — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_path_concat(userId) {
  return fs.readFileSync("./data/" + userId + "/profile.json");
}

// Test 3: No validation — MISSED by SonarJS ❌ | Interlace ✅
export async function vuln_path_no_validation(userDir) {
  return fs.readdir(`./storage/${userDir}`);
}

// Test 4: URL pathname — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_path_url_pathname(url) {
  const parsedUrl = new URL(url);
  return fs.readFileSync(`./static${parsedUrl.pathname}`);
}
```

> **Why SonarJS misses these:** SonarJS has no `fs`-aware rules. It doesn't understand that user input flowing into `fs.readFileSync()` or `fs.readdir()` is a path traversal vector. Interlace catches these with `node-security/detect-non-literal-fs-filename` and `secure-coding/path-traversal`.

### Hardcoded Credentials (CWE-798) — SonarJS: 2/4

```javascript
// Test 1: Database password — SonarJS ✅ sonarjs/no-hardcoded-passwords | Interlace ✅
export function vuln_creds_db_password() {
  return new Pool({
    password: "secretPassword123", // ← SonarJS: "Review this potentially hard-coded password."
  });
}

// Test 2: API key — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_creds_api_key() {
  const apiKey = "sk-prod-abc123def456ghi789jkl012mno345pqr678";
  return fetch("https://api.example.com", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

// Test 3: AWS credentials — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_creds_aws() {
  AWS.config.update({
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  });
}

// Test 4: JWT secret — SonarJS ✅ sonarjs/hardcoded-secret-signatures | Interlace ✅
export function vuln_creds_jwt_secret(user) {
  return jwt.sign(user, "my-super-secret-jwt-key-12345");
}
// SonarJS: "Revoke and change this password, as it is compromised."
```

> **What SonarJS misses:** It detects `password:` property patterns and JWT-signing secrets, but misses API key strings assigned to variables and AWS credential objects. It doesn't understand cloud SDK credential patterns.

### JWT Vulnerabilities (CWE-757, CWE-347) — SonarJS: 1/3

```javascript
// Test 1: Algorithm "none" — SonarJS ✅ sonarjs/insecure-jwt-token | Interlace ✅
export function vuln_jwt_alg_none(token) {
  return jwt.verify(token, "secret", { algorithms: ["none", "HS256"] });
}
// SonarJS: "Use only strong cipher algorithms when verifying the signature of this JWT."

// Test 2: No algorithm restriction — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_jwt_no_algorithm(token, secret) {
  return jwt.verify(token, secret); // No algorithms specified - accepts any
}
// Interlace: jwt/require-algorithm-restriction

// Test 3: No expiration — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_jwt_no_expiry(user) {
  return jwt.sign(user, process.env.JWT_SECRET); // Token never expires
}
// Interlace: jwt/require-expiration
```

> **What SonarJS misses:** It only catches the obvious `"none"` algorithm in the array. Missing algorithm restriction and missing expiration are equally dangerous but require understanding JWT best practices — not just pattern matching.

### XSS / Code Execution (CWE-79, CWE-94) — SonarJS: 2/4

```javascript
// Test 1: innerHTML — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_xss_innerhtml(userContent) {
  document.getElementById("output").innerHTML = userContent;
}
// Interlace: browser-security/no-inner-html

// Test 2: document.write — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_xss_document_write(userInput) {
  document.write("<div>" + userInput + "</div>");
}
// Interlace: browser-security/no-document-write

// Test 3: eval() — SonarJS ✅ sonarjs/code-eval | Interlace ✅
export function vuln_xss_eval(userCode) {
  return eval(userCode);
}
// SonarJS: "Make sure that this dynamic injection or execution of code is safe."

// Test 4: new Function() — SonarJS ✅ sonarjs/code-eval | Interlace ✅
export function vuln_xss_new_function(userCode) {
  const fn = new Function(userCode);
  return fn();
}
```

> **What SonarJS misses:** `innerHTML` and `document.write` are classic DOM XSS vectors, but SonarJS doesn't have browser-specific DOM sink rules. Interlace's `browser-security` plugin provides dedicated DOM XSS detection.

### Prototype Pollution (CWE-1321) — SonarJS: 0/3

```javascript
// Test 1: Bracket notation — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_proto_bracket(obj, key, value) {
  obj[key] = value; // key could be "__proto__"
  return obj;
}

// Test 2: Deep nested manipulation — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_proto_nested(obj, path, value) {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

// Test 3: Object.assign with parsed JSON — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_proto_assign(userInput) {
  const config = {};
  Object.assign(config, JSON.parse(userInput));
  return config;
}
```

> **Why SonarJS misses these:** Prototype pollution requires understanding that user-controlled keys can poison `Object.prototype`. SonarJS has no rules for this attack class. Interlace catches all 3 with `secure-coding/detect-object-injection`.

### Insecure Randomness (CWE-330) — SonarJS: 2/2 ✅

```javascript
// Test 1: Math.random() for token — SonarJS ✅ sonarjs/pseudo-random | Interlace ✅
export function vuln_random_token() {
  return Math.random().toString(36).substring(2);
}
// SonarJS: "Make sure that using this pseudorandom number generator is safe here."

// Test 2: Math.random() for session — SonarJS ✅ sonarjs/pseudo-random | Interlace ✅
export function vuln_random_session() {
  return "session_" + Math.floor(Math.random() * 1000000);
}
```

> **Full marks for SonarJS here** — `sonarjs/pseudo-random` correctly flags both `Math.random()` usages.

### Weak Cryptography (CWE-327, CWE-328) — SonarJS: 2/3

```javascript
// Test 1: MD5 hash — SonarJS ✅ sonarjs/hashing | Interlace ✅
export function vuln_crypto_md5(password) {
  return crypto.createHash("md5").update(password).digest("hex");
}
// SonarJS: "Make sure this weak hash algorithm is not used in a sensitive context here."

// Test 2: SHA1 hash — SonarJS ✅ sonarjs/hashing | Interlace ✅
export function vuln_crypto_sha1(sensitiveData) {
  return crypto.createHash("sha1").update(sensitiveData).digest("hex");
}

// Test 3: DES encryption — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_crypto_des(plaintext) {
  const cipher = crypto.createCipher("des", "password");
  return cipher.update(plaintext, "utf8", "hex") + cipher.final("hex");
}
// Interlace: crypto/no-weak-cipher
```

> **What SonarJS misses:** It detects weak hash algorithms (MD5, SHA1) but not weak encryption algorithms (DES). The deprecated `createCipher` API is also a red flag that goes undetected.

### Timing Attacks (CWE-208) — SonarJS: 0/2

```javascript
// Test 1: Direct comparison — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_timing_direct(input, secret) {
  return input === secret;
}
// Interlace: crypto/no-timing-unsafe-compare

// Test 2: Token comparison — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_timing_token(userToken, storedToken) {
  if (userToken === storedToken) {
    return { authenticated: true };
  }
}
```

> **Why SonarJS misses these:** Timing attack detection requires understanding that `===` comparison on secrets leaks information through timing differences. The safe alternative is `crypto.timingSafeEqual()`.

### NoSQL Injection (CWE-943) — SonarJS: 0/2

```javascript
// Test 1: MongoDB findOne with user input — MISSED by SonarJS ❌ | Interlace ✅
export async function vuln_nosql_mongo(username) {
  return db.collection("users").findOne({ username });
}
// Interlace: mongodb-security/no-raw-query

// Test 2: $where operator — MISSED by SonarJS ❌ | Interlace ✅
export async function vuln_nosql_where(userInput) {
  return db.collection("users").find({ $where: userInput });
}
// Interlace: mongodb-security/no-where-string
```

### SSRF (CWE-918) — SonarJS: 0/2

```javascript
// Test 1: fetch with user URL — MISSED by SonarJS ❌ | Interlace ✅
export async function vuln_ssrf_fetch(userUrl) {
  const response = await fetch(userUrl);
  return response.json();
}
// Interlace: browser-security/no-unvalidated-fetch

// Test 2: axios with user URL — MISSED by SonarJS ❌ | Interlace ✅
export async function vuln_ssrf_axios(endpoint) {
  return axios.get(endpoint);
}
```

### Open Redirect (CWE-601) — SonarJS: 0/1

```javascript
// Test 1: Express redirect — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_redirect(req, res) {
  const returnUrl = req.query.returnTo;
  res.redirect(returnUrl);
}
// Interlace: express-security/no-open-redirect
```

### ReDoS (CWE-1333) — SonarJS: 1/2

```javascript
// Test 1: Evil regex — SonarJS ✅ sonarjs/slow-regex | Interlace ✅
export function vuln_redos_evil(input) {
  const evilRegex = /^(a+)+$/;
  return evilRegex.test(input);
}
// SonarJS: "Make sure the regex used here, which is vulnerable to super-linear runtime
//           due to backtracking, cannot lead to denial of service."

// Test 2: User-controlled regex — MISSED by SonarJS ❌ | Interlace ✅
export function vuln_redos_user(pattern, input) {
  const regex = new RegExp(pattern); // User controls the pattern
  return regex.test(input);
}
// Interlace: secure-coding/detect-non-literal-regexp
```

---

## The False Positive Analysis

SonarJS produced **5 false positives** — safe code patterns that were incorrectly flagged. Here's every one:

### FP 1-3: Safe Command Execution Flagged as Unsafe

```javascript
// ✅ SAFE: execFile with literal arguments — SonarJS flags ❌
export function safe_cmd_execfile_literal() {
  const { execFile } = require("child_process");
  return execFile("ls", ["-la", "/tmp"]);
}
// SonarJS sonarjs/no-os-command-from-path:
// "Make sure the \"PATH\" variable only contains fixed, unwriteable directories."

// ✅ SAFE: spawn with shell: false — SonarJS flags ❌
export function safe_cmd_spawn_noshell() {
  const { spawn } = require("child_process");
  return spawn("convert", ["input.png", "output.jpg"], { shell: false });
}
// SonarJS sonarjs/no-os-command-from-path (same rule, same false alarm)

// ✅ SAFE: execFile with validated input — SonarJS flags ❌
export function safe_cmd_validated(format) {
  if (!["png", "jpg", "gif"].includes(format)) {
    throw new Error("Invalid format");
  }
  return execFile("convert", ["input.img", `output.${format}`]);
}
// SonarJS sonarjs/no-os-command-from-path (same rule, same false alarm)
```

> **The problem:** `sonarjs/no-os-command-from-path` flags **every** `execFile` and `spawn` call regardless of whether user input is involved. It can't distinguish `execFile("ls", ["-la", "/tmp"])` (safe, literal arguments) from `exec(userInput)` (dangerous). Interlace correctly passes all 3 — it understands that `execFile` with literal arguments and `spawn` with `shell: false` are the **recommended safe alternatives**.

### FP 4: Safe Math.random() for Non-Security Use

```javascript
// ✅ SAFE: Math.random() for array shuffle — SonarJS flags ❌
export function safe_random_shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
// SonarJS sonarjs/pseudo-random:
// "Make sure that using this pseudorandom number generator is safe here."
```

> **The problem:** `Math.random()` for a Fisher-Yates shuffle is perfectly fine — it's not generating tokens or session IDs. SonarJS can't distinguish security-sensitive randomness from benign randomness. Interlace correctly passes this — it only flags `Math.random()` when it's assigned to variables named `token`, `secret`, `session`, etc.

### FP 5: Safe Regex Flagged as ReDoS

```javascript
// ✅ SAFE: Simple email regex — SonarJS flags ❌
export function safe_regex_simple(input) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(input);
}
// SonarJS sonarjs/slow-regex:
// "Make sure the regex used here, which is vulnerable to super-linear runtime
//  due to backtracking, cannot lead to denial of service."
```

> **The problem:** This email regex is efficient — it uses negated character classes with no nested quantifiers. SonarJS incorrectly identifies it as vulnerable to super-linear backtracking. Interlace correctly passes it.

### False Positive Summary

| FP  | Safe Pattern                              | SonarJS Rule              | Why It's Wrong              |
| :-- | :---------------------------------------- | :------------------------ | :-------------------------- |
| 1   | `execFile("ls", ["-la"])`                 | `no-os-command-from-path` | Literal args, no user input |
| 2   | `spawn("convert", [...], {shell: false})` | `no-os-command-from-path` | shell disabled explicitly   |
| 3   | `execFile` with allowlist validation      | `no-os-command-from-path` | Input validated before use  |
| 4   | `Math.random()` for array shuffle         | `pseudo-random`           | Non-security use case       |
| 5   | Simple email regex                        | `slow-regex`              | No nested quantifiers       |

**Interlace: 0 false positives.** Every warning is actionable.

---

## The Verdict

| Dimension              | SonarJS | Interlace | Winner           |
| :--------------------- | :------ | :-------- | :--------------- |
| **Total Rules**        | 269     | 201       | 🔵 SonarJS       |
| **Security Detection** | 35%     | 100%      | 🟢 **Interlace** |
| **False Positives**    | 5       | 0         | 🟢 **Interlace** |
| **Category Coverage**  | 7/14    | 14/14     | 🟢 **Interlace** |
| **ESLint 9 Support**   | ✅      | ✅        | Tie              |
| **Active Maintenance** | ✅      | ✅        | Tie              |

### Where SonarJS Excels

Let's be clear: **SonarJS is an excellent tool.** Here's where it genuinely shines:

**Security categories with strong coverage:**

- ✅ **Command Injection**: 4/4 — `sonarjs/os-command` is best-in-class. It catches `exec`, `execSync`, and even the subtle `spawn({shell: true})` pattern.
- ✅ **Insecure Randomness**: 2/2 — `sonarjs/pseudo-random` correctly identifies `Math.random()` in security contexts.
- ✅ **Weak Hashing**: 2/2 — `sonarjs/hashing` reliably flags MD5 and SHA1.
- ✅ **JWT Algorithm Confusion**: Catches the `"none"` algorithm attack via `sonarjs/insecure-jwt-token`.
- ✅ **Code Eval**: 2/2 — `sonarjs/code-eval` detects both `eval()` and `new Function()`.
- ✅ **ReDoS**: Catches catastrophic backtracking patterns via `sonarjs/slow-regex`.

**Code quality (not covered in this benchmark):**

- 🏆 **Cognitive Complexity** — One of the best implementations available.
- 🏆 **Dead Code Detection** — Unreachable code, unused assignments, redundant boolean comparisons.
- 🏆 **Code Smell Detection** — Duplicate branches, collapsible if-statements, identical expressions.
- 🏆 **Bug Detection** — All-identical comparisons, useless intersections, empty collections.

Both SonarJS and Interlace have quality rules — this benchmark focused exclusively on security. A head-to-head quality comparison is coming soon.

### Where SonarJS Needs Help

SonarJS's security coverage is focused on a few categories. For a Node.js backend, these gaps matter:

- SQL Injection (0/4) — No database-aware taint analysis
- Path Traversal (0/4) — No `fs`-aware rules
- Prototype Pollution (0/3) — No object injection detection
- Timing Attacks (0/2) — No constant-time comparison rules
- NoSQL Injection (0/2) — No MongoDB-specific rules
- SSRF (0/2) — No outbound request validation
- Open Redirect (0/1) — No Express redirect rules

These aren't flaws — they're scope gaps. SonarJS was built to cover the breadth of JavaScript quality, not the depth of Node.js security. That's where specialized plugins fill in.

### Recommendation: Use Both

**The best ESLint config uses SonarJS AND dedicated security plugins.** They complement each other perfectly — SonarJS handles quality, Interlace handles security:

```javascript
// eslint.config.js — Best of both worlds
import sonarjs from "eslint-plugin-sonarjs";
import secureCoding from "eslint-plugin-secure-coding";
import nodeSecurity from "eslint-plugin-node-security";
import pg from "eslint-plugin-pg";
import jwt from "eslint-plugin-jwt";

export default [
  sonarjs.configs.recommended, // Quality ✅
  secureCoding.configs.recommended, // Security ✅
  nodeSecurity.configs.recommended, // Node.js security ✅
  pg.configs.recommended, // Database security ✅
  jwt.configs.recommended, // Auth security ✅
];
```

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
- **📖 You are here: SonarJS vs Interlace**
- [Microsoft SDL vs Interlace: Enterprise Security Benchmark](/articles/benchmark-microsoft-sdl-vs-interlace)
- [eslint-plugin-security Is Abandoned](/articles/eslint-plugin-security-abandoned)

---

## Explore the Full Ecosystem

> **201 security rules. 11 specialized plugins. 100% detection. 0 false positives.**
>
> [📖 Documentation](https://eslint.interlace.tools) | [⭐ GitHub](https://github.com/ofri-peretz/eslint) | [📦 NPM](https://npmjs.com/~ofriperetz)

---

**Next in the ESLint Security Benchmark Series:**

- 17 ESLint Security Plugins Benchmarked: The Full Ecosystem Report
- Microsoft SDL vs Interlace: The Enterprise Security Gap

**Follow [@ofri-peretz](https://dev.to/ofri-peretz) to get notified.**

---

**Build Securely.**

I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=sonarjs-benchmark) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
