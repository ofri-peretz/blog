---
title: "SonarJS Has 269 Rules. It Still Misses 65% of Security Vulnerabilities."
description: "A head-to-head benchmark between eslint-plugin-sonarjs and the Interlace security fleet. More rules isn't more security — SonarJS caught 14 of 40 vulnerabilities, so 65% slipped through. Every number is reproducible."
slug: "sonarjs-has-269-rules-it-still-misses-65-of-security-vulnerabilities-3jh"
canonical_url: "https://ofriperetz.dev/articles/sonarjs-has-269-rules-it-still-misses-65-of-security-vulnerabilities-3jh"
devto_url: "https://dev.to/ofri-peretz/sonarjs-has-269-rules-it-still-misses-65-of-security-vulnerabilities-3jh"
devto_id: 3240739
published_at: "2026-02-08T03:31:07Z"
edited_at: "2026-05-29T00:00:00Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/sonarjs-has-269-rules-it-still-misses-65-of-security-vulnerabilities-3jh.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/sonarjs-has-269-rules-it-still-misses-65-of-security-vulnerabilities-3jh.png"
reading_time_minutes: 12
tags:
  - "security"
  - "eslint"
  - "javascript"
  - "benchmark"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: null
---

**Skip to:** [Results](#the-results) | [Every Test Case](#every-test-case-detailed-results) | [False Positives](#the-false-positive-analysis) | [Compatibility](#compatibility) | [Reproduce It](#methodology) | [Verdict](#the-verdict)

## TL;DR

SonarJS is an excellent code-quality tool — one of the best in the ESLint ecosystem. But on a 40-pattern security benchmark it caught **14 out of 40** vulnerabilities; a focused security fleet caught all 40. That's not a flaw in SonarJS — it's a **scope difference**. SonarJS was built for quality. Security depth is where dedicated tools earn their place.

| Metric                  | eslint-plugin-sonarjs | Interlace security fleet |
| :---------------------- | :-------------------- | :----------------------- |
| **Rules**               | 269                   | ~200 (10 plugins)        |
| **Security detections** | 14/40 (35%)           | **40/40 (100%)**         |
| **Missed**              | 26 vulnerabilities    | **0**                    |
| **False positives**     | 5                     | **0**                    |
| **F1 score**            | 47.5%                 | **100.0%**               |
| **Category coverage**   | 7/14 categories       | **14/14 categories**     |

> 💡 **Key takeaway:** SonarJS excels at code quality, cognitive complexity, and code-smell detection. But relying on it _alone_ for security leaves gaps in 7 OWASP attack categories. The best setup? **Use both** — SonarJS for quality, a dedicated fleet for security.

Every number below is reproducible — versions pinned, fixtures public, one command. [Jump to the method](#methodology).

---

## Why SonarJS?

`eslint-plugin-sonarjs` is SonarSource's official ESLint plugin, extracted from their SonarQube/SonarCloud analysis engine. With roughly **3M weekly downloads** ([npm, May 2026](https://www.npmjs.com/package/eslint-plugin-sonarjs)) and **269 rules**, it's one of the most popular and well-maintained plugins in the ecosystem — and for good reason.

SonarJS brings enterprise-grade quality rules to ESLint: cognitive-complexity analysis, dead-code detection, code-smell identification, and a handful of strong security rules for categories like command injection and weak cryptography. Many teams adopt it as part of their SonarQube/SonarCloud pipeline, and it delivers real value.

But SonarJS was designed as a **general-purpose quality tool** — not a dedicated security scanner. This benchmark tests one specific question: _how far does SonarJS go when your goal is comprehensive Node.js security coverage?_

---

## Test Setup

The "Interlace security fleet" is 10 specialized plugins run together under their `recommended` presets. Exact versions tested:

| Component         | SonarJS                 | Interlace fleet                 |
| :---------------- | :---------------------- | :------------------------------ |
| **Version**       | 3.0.6                   | see plugin list below           |
| **Rules**         | 269                     | ~200 across 10 security plugins |
| **Configuration** | `recommended`           | `recommended` (all 10 plugins)  |
| **ESLint**        | 9.39.2                  | 9.39.2                          |
| **Node.js**       | v24.12.0                | v24.12.0                        |
| **Platform**      | macOS (darwin/arm64)    | Same                            |
| **Fixtures**      | 40 vulnerable + 38 safe | Same fixtures                   |

**The 10-plugin fleet** (npm package · version):

`eslint-plugin-secure-coding` 3.0.2 · `eslint-plugin-node-security` 4.2.0 · `eslint-plugin-pg` 1.4.3 · `eslint-plugin-jwt` 2.2.3 · `eslint-plugin-browser-security` 1.2.3 · `eslint-plugin-mongodb-security` 8.2.3 · `eslint-plugin-express-security` 1.2.3 · `eslint-plugin-nestjs-security` 1.2.3 · `eslint-plugin-lambda-security` 1.2.3 · `eslint-plugin-vercel-ai-security` 1.3.3

> **Note on `eslint-plugin-crypto`:** earlier versions of this benchmark used a separate `crypto` plugin. It has since been **consolidated into `node-security`** — including the `Math.random()`-for-crypto rule used below — so the modern fleet is 10 plugins, not 11. Don't install `eslint-plugin-crypto`; it's deprecated.

Both plugins were tested with their recommended presets — the out-of-box experience a developer gets after install.

---

## The Results

### Detection Summary

```text
Vulnerable code detections (out of 40 patterns):

Interlace:   ████████████████████████████████████████  40/40 (100%)
SonarJS:     ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  14/40 (35%)
```

### Category-by-Category Summary

| Category              | Cases  | SonarJS    | Interlace | Interlace rule that fires                      |
| :-------------------- | :----- | :--------- | :-------- | :--------------------------------------------- |
| SQL Injection         | 4      | ❌ **0/4** | ✅ 4/4    | `pg/no-unsafe-query`                           |
| Command Injection     | 4      | ✅ **4/4** | ✅ 4/4    | `node-security/detect-child-process`           |
| Path Traversal        | 4      | ❌ **0/4** | ✅ 4/4    | `node-security/detect-non-literal-fs-filename` |
| Hardcoded Credentials | 4      | ⚠️ **2/4** | ✅ 4/4    | `secure-coding/no-hardcoded-credentials`       |
| JWT Vulnerabilities   | 3      | ⚠️ **1/3** | ✅ 3/3    | `jwt/*` (none, whitelist, expiration)          |
| XSS / Code Execution  | 4      | ⚠️ **2/4** | ✅ 4/4    | `browser-security/no-innerhtml`, `no-eval`     |
| Prototype Pollution   | 3      | ❌ **0/3** | ✅ 3/3    | `secure-coding/detect-object-injection`        |
| Insecure Randomness   | 2      | ✅ **2/2** | ✅ 2/2    | `node-security/no-math-random-crypto`          |
| Weak Cryptography     | 3      | ⚠️ **2/3** | ✅ 3/3    | `node-security/no-weak-*-algorithm`            |
| Timing Attacks        | 2      | ❌ **0/2** | ✅ 2/2    | `secure-coding/no-insecure-comparison`         |
| NoSQL Injection       | 2      | ❌ **0/2** | ✅ 2/2    | `mongodb-security/no-unsafe-query`             |
| SSRF                  | 2      | ❌ **0/2** | ✅ 2/2    | `node-security/no-ssrf`                        |
| Open Redirect         | 1      | ❌ **0/1** | ✅ 1/1    | `browser-security/no-insecure-redirects`       |
| ReDoS                 | 2      | ⚠️ **1/2** | ✅ 2/2    | `secure-coding/detect-non-literal-regexp`      |
| **TOTAL**             | **40** | **14/40**  | **40/40** | —                                              |

**SonarJS has zero coverage for 7 of 14 categories**: SQL injection, path traversal, prototype pollution, timing attacks, NoSQL injection, SSRF, and open redirect.

---

## Every Test Case: Detailed Results

Below is every vulnerable pattern in the benchmark, the exact code tested, and the rule each plugin fired. The Interlace rule IDs are the **actual rules that triggered** in the run — copy any of them into your config and they'll match the same code.

### SQL Injection (CWE-89) — SonarJS: 0/4

```javascript
// Test 1: String concatenation — MISSED by SonarJS ❌ | Interlace ✅ pg/no-unsafe-query
export function vuln_sql_string_concat(userId) {
  const query = "SELECT * FROM users WHERE id = '" + userId + "'";
  return db.query(query);
}

// Test 2: Template literal — MISSED by SonarJS ❌ | Interlace ✅ pg/no-unsafe-query
export function vuln_sql_template_literal(email) {
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  return db.query(query);
}

// Test 3: Dynamic column name — MISSED by SonarJS ❌ | Interlace ✅ pg/no-unsafe-query
export function vuln_sql_dynamic_column(sortColumn) {
  const query = `SELECT * FROM users ORDER BY ${sortColumn}`;
  return db.query(query);
}

// Test 4: Conditional query building — MISSED by SonarJS ❌ | Interlace ✅ pg/no-unsafe-query
export function vuln_sql_conditional(filters) {
  let query = "SELECT * FROM products WHERE 1=1";
  if (filters.name) {
    query += ` AND name = '${filters.name}'`;
  }
  return db.query(query);
}
```

> **Why SonarJS misses these:** SonarJS has no SQL-specific taint analysis — it doesn't track user input flowing into `db.query()`. `pg/no-unsafe-query` understands the node-postgres client API and flags interpolated SQL on all four.

### Command Injection (CWE-78) — SonarJS: 4/4 ✅

```javascript
// Test 1: exec() with concatenation — SonarJS ✅ sonarjs/os-command | Interlace ✅ node-security/detect-child-process
export function vuln_cmd_exec_concat(filename) {
  const { exec } = require("child_process");
  exec("ls -la " + filename, callback);
}
// SonarJS: "Make sure that executing this OS command is safe here."

// Test 2: exec() with template literal — SonarJS ✅ | Interlace ✅ node-security/detect-child-process
export function vuln_cmd_exec_template(filename) {
  const { exec } = require("child_process");
  exec(`convert ${filename} output.png`, callback);
}

// Test 3: execSync() — SonarJS ✅ | Interlace ✅ node-security/detect-child-process
export function vuln_cmd_execsync(command) {
  const { execSync } = require("child_process");
  return execSync(command).toString();
}

// Test 4: spawn() with shell: true — SonarJS ✅ | Interlace ✅ node-security/detect-child-process
export function vuln_cmd_spawn_shell(userCommand) {
  const { spawn } = require("child_process");
  return spawn(userCommand, { shell: true });
}
```

> **Credit to SonarJS:** this is its strongest category — `sonarjs/os-command` catches all 4, including the subtle `spawn({ shell: true })` case. So does `node-security/detect-child-process`. A genuine tie.

### Path Traversal (CWE-22) — SonarJS: 0/4

```javascript
// Test 1: path.join with user input — MISSED by SonarJS ❌ | Interlace ✅ node-security/detect-non-literal-fs-filename
export function vuln_path_join(filename) {
  const filepath = path.join("./uploads", filename);
  return fs.readFileSync(filepath);
}

// Test 2: String concatenation — MISSED by SonarJS ❌ | Interlace ✅ node-security/detect-non-literal-fs-filename
export function vuln_path_concat(userId) {
  return fs.readFileSync("./data/" + userId + "/profile.json");
}

// Test 3: No validation — MISSED by SonarJS ❌ | Interlace ✅ node-security/detect-non-literal-fs-filename
export async function vuln_path_no_validation(userDir) {
  return fs.readdir(`./storage/${userDir}`);
}

// Test 4: URL pathname — MISSED by SonarJS ❌ | Interlace ✅ node-security/detect-non-literal-fs-filename
export function vuln_path_url_pathname(url) {
  const parsedUrl = new URL(url);
  return fs.readFileSync(`./static${parsedUrl.pathname}`);
}
```

> **Why SonarJS misses these:** SonarJS has no `fs`-aware rules. `node-security/detect-non-literal-fs-filename` flags non-literal paths flowing into `fs.readFileSync()` / `fs.readdir()` (with `node-security/no-arbitrary-file-access` backing it up).

### Hardcoded Credentials (CWE-798) — SonarJS: 2/4

```javascript
// Test 1: Database password — SonarJS ✅ sonarjs/no-hardcoded-passwords | Interlace ✅ secure-coding/no-hardcoded-credentials
export function vuln_creds_db_password() {
  return new Pool({
    password: "secretPassword123",
  });
}

// Test 2: API key — MISSED by SonarJS ❌ | Interlace ✅ secure-coding/no-hardcoded-credentials
export function vuln_creds_api_key() {
  const apiKey = "sk-prod-abc123def456ghi789jkl012mno345pqr678";
  return fetch("https://api.example.com", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

// Test 3: AWS credentials — MISSED by SonarJS ❌ | Interlace ✅ secure-coding/no-hardcoded-credentials
export function vuln_creds_aws() {
  AWS.config.update({
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  });
}

// Test 4: JWT secret — SonarJS ✅ sonarjs/hardcoded-secret-signatures | Interlace ✅ jwt/no-hardcoded-secret
export function vuln_creds_jwt_secret(user) {
  return jwt.sign(user, "my-super-secret-jwt-key-12345");
}
```

> **What SonarJS misses:** it detects `password:` properties and JWT-signing secrets but misses API-key strings and AWS credential objects. `secure-coding/no-hardcoded-credentials` catches all four credential shapes.

### JWT Vulnerabilities (CWE-757, CWE-347) — SonarJS: 1/3

```javascript
// Test 1: Algorithm "none" — SonarJS ✅ sonarjs/insecure-jwt-token | Interlace ✅ jwt/no-algorithm-none
export function vuln_jwt_alg_none(token) {
  return jwt.verify(token, "secret", { algorithms: ["none", "HS256"] });
}

// Test 2: No algorithm restriction — MISSED by SonarJS ❌ | Interlace ✅ jwt/require-algorithm-whitelist
export function vuln_jwt_no_algorithm(token, secret) {
  return jwt.verify(token, secret); // accepts any algorithm
}

// Test 3: No expiration — MISSED by SonarJS ❌ | Interlace ✅ jwt/require-expiration
export function vuln_jwt_no_expiry(user) {
  return jwt.sign(user, process.env.JWT_SECRET); // token never expires
}
```

> **What SonarJS misses:** it catches the obvious `"none"` algorithm but not a missing algorithm allowlist or a missing expiration — both equally dangerous. `jwt/require-algorithm-whitelist` and `jwt/require-expiration` encode JWT best practice, not just pattern matching.

### XSS / Code Execution (CWE-79, CWE-94) — SonarJS: 2/4

```javascript
// Test 1: innerHTML — MISSED by SonarJS ❌ | Interlace ✅ browser-security/no-innerhtml
export function vuln_xss_innerhtml(userContent) {
  document.getElementById("output").innerHTML = userContent;
}

// Test 2: document.write — MISSED by SonarJS ❌ | Interlace ✅ secure-coding/no-improper-sanitization
export function vuln_xss_document_write(userInput) {
  document.write("<div>" + userInput + "</div>");
}

// Test 3: eval() — SonarJS ✅ sonarjs/code-eval | Interlace ✅ browser-security/no-eval
export function vuln_xss_eval(userCode) {
  return eval(userCode);
}

// Test 4: new Function() — SonarJS ✅ sonarjs/code-eval | Interlace ✅ browser-security/no-eval
export function vuln_xss_new_function(userCode) {
  const fn = new Function(userCode);
  return fn();
}
```

> **What SonarJS misses:** `innerHTML` and `document.write` are classic DOM-XSS sinks, but SonarJS has no browser DOM-sink rules. `browser-security/no-innerhtml` and `secure-coding/no-improper-sanitization` cover them; both plugins catch `eval`/`new Function`.

### Prototype Pollution (CWE-1321) — SonarJS: 0/3

```javascript
// Test 1: Bracket notation — MISSED by SonarJS ❌ | Interlace ✅ secure-coding/detect-object-injection
export function vuln_proto_bracket(obj, key, value) {
  obj[key] = value; // key could be "__proto__"
  return obj;
}

// Test 2: Deep nested manipulation — MISSED by SonarJS ❌ | Interlace ✅ secure-coding/detect-object-injection
export function vuln_proto_nested(obj, path, value) {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

// Test 3: Object.assign with parsed JSON — MISSED by SonarJS ❌ | Interlace ✅ secure-coding/no-unsafe-deserialization
export function vuln_proto_assign(userInput) {
  const config = {};
  Object.assign(config, JSON.parse(userInput));
  return config;
}
```

> **Why SonarJS misses these:** prototype pollution requires understanding that user-controlled keys can poison `Object.prototype`. SonarJS has no rule for this class; `secure-coding/detect-object-injection` catches the bracket-write cases and `no-unsafe-deserialization` catches the merge.

### Insecure Randomness (CWE-330/338) — SonarJS: 2/2 ✅

```javascript
// Test 1: Math.random() for token — SonarJS ✅ sonarjs/pseudo-random | Interlace ✅ node-security/no-math-random-crypto
export function vuln_random_token() {
  return Math.random().toString(36).substring(2);
}

// Test 2: Math.random() for session — SonarJS ✅ sonarjs/pseudo-random | Interlace ✅ node-security/no-math-random-crypto
export function vuln_random_session() {
  return "session_" + Math.floor(Math.random() * 1000000);
}
```

> **A tie — and a good one.** Both flag `Math.random()` in a crypto context. `node-security/no-math-random-crypto` is context-aware: it stays silent on a `Math.random()` used for a shuffle or UI jitter (see the [false-positive analysis](#the-false-positive-analysis)).

### Weak Cryptography (CWE-327, CWE-328) — SonarJS: 2/3

```javascript
// Test 1: MD5 hash — SonarJS ✅ sonarjs/hashing | Interlace ✅ node-security/no-weak-hash-algorithm
export function vuln_crypto_md5(password) {
  return crypto.createHash("md5").update(password).digest("hex");
}

// Test 2: SHA1 hash — SonarJS ✅ sonarjs/hashing | Interlace ✅ node-security/no-weak-hash-algorithm
export function vuln_crypto_sha1(sensitiveData) {
  return crypto.createHash("sha1").update(sensitiveData).digest("hex");
}

// Test 3: DES encryption — MISSED by SonarJS ❌ | Interlace ✅ node-security/no-weak-cipher-algorithm
export function vuln_crypto_des(plaintext) {
  const cipher = crypto.createCipher("des", "password");
  return cipher.update(plaintext, "utf8", "hex") + cipher.final("hex");
}
```

> **What SonarJS misses here:** SonarJS's `sonarjs/no-weak-cipher` _does_ flag weak ciphers passed to `crypto.createCipheriv` (e.g. `'des'`) — but it doesn't recognise the **deprecated single-key `crypto.createCipher` API** this fixture uses, so it misses this specific case. `node-security/no-weak-cipher-algorithm` catches the weak algorithm either way, and `node-security/no-deprecated-cipher-method` additionally flags the legacy `createCipher` call.

### Timing Attacks (CWE-208) — SonarJS: 0/2

```javascript
// Test 1: Direct comparison — MISSED by SonarJS ❌ | Interlace ✅ secure-coding/no-insecure-comparison
export function vuln_timing_direct(input, secret) {
  return input === secret;
}

// Test 2: Token comparison — MISSED by SonarJS ❌ | Interlace ✅ secure-coding/no-insecure-comparison
export function vuln_timing_token(userToken, storedToken) {
  if (userToken === storedToken) {
    return { authenticated: true };
  }
}
```

> **Why SonarJS misses these:** detecting timing attacks means knowing that `===` on a secret leaks information through timing. `secure-coding/no-insecure-comparison` steers you to `crypto.timingSafeEqual()`.

### NoSQL Injection (CWE-943) — SonarJS: 0/2

```javascript
// Test 1: MongoDB findOne with user input — MISSED by SonarJS ❌ | Interlace ✅ mongodb-security/no-unsafe-query
export async function vuln_nosql_mongo(username) {
  return db.collection("users").findOne({ username });
}

// Test 2: $where operator — MISSED by SonarJS ❌ | Interlace ✅ mongodb-security/no-unsafe-query
export async function vuln_nosql_where(userInput) {
  return db.collection("users").find({ $where: userInput });
}
```

### SSRF (CWE-918) — SonarJS: 0/2

```javascript
// Test 1: fetch with user URL — MISSED by SonarJS ❌ | Interlace ✅ node-security/no-ssrf
export async function vuln_ssrf_fetch(userUrl) {
  const response = await fetch(userUrl);
  return response.json();
}

// Test 2: axios with user URL — MISSED by SonarJS ❌ | Interlace ✅ node-security/no-ssrf
export async function vuln_ssrf_axios(endpoint) {
  return axios.get(endpoint);
}
```

### Open Redirect (CWE-601) — SonarJS: 0/1

```javascript
// Test 1: Express redirect — MISSED by SonarJS ❌ | Interlace ✅ browser-security/no-insecure-redirects
export function vuln_redirect(req, res) {
  const returnUrl = req.query.returnTo;
  res.redirect(returnUrl);
}
```

### ReDoS (CWE-1333) — SonarJS: 1/2

```javascript
// Test 1: Evil regex — SonarJS ✅ sonarjs/slow-regex | Interlace ✅ secure-coding/detect-non-literal-regexp
export function vuln_redos_evil(input) {
  const evilRegex = /^(a+)+$/;
  return evilRegex.test(input);
}

// Test 2: User-controlled regex — MISSED by SonarJS ❌ | Interlace ✅ secure-coding/detect-non-literal-regexp
export function vuln_redos_user(pattern, input) {
  const regex = new RegExp(pattern); // user controls the pattern
  return regex.test(input);
}
```

---

## The False Positive Analysis

SonarJS produced **5 false positives** — safe code patterns incorrectly flagged. Here's every one. The Interlace fleet flagged **none** of them.

### FP 1–3: Safe Command Execution Flagged as Unsafe

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

// ✅ SAFE: execFile with validated input — SonarJS flags ❌
export function safe_cmd_validated(format) {
  if (!["png", "jpg", "gif"].includes(format)) {
    throw new Error("Invalid format");
  }
  return execFile("convert", ["input.img", `output.${format}`]);
}
```

> **The problem:** `sonarjs/no-os-command-from-path` flags **every** `execFile`/`spawn` call regardless of whether user input is involved. It can't distinguish `execFile("ls", ["-la", "/tmp"])` (safe, literal args) from `exec(userInput)` (dangerous). `node-security/detect-child-process` passes all three — `execFile` with literal args and `spawn` with `shell: false` are the **recommended safe alternatives**, and it's allowlist-aware enough to recognise the validated case.

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
```

> **The problem:** `Math.random()` for a Fisher-Yates shuffle is fine — it's not seeding a token or session ID. SonarJS can't tell security-sensitive randomness from benign randomness. `node-security/no-math-random-crypto` is context-aware — it only fires when the value flows into a **security-sensitive name** (`token`, `key`, `secret`, `password`, `salt`, `iv`, `nonce`, `session`, `csrf`, `otp`, …) or a generator-style function — so the `shuffled`/`j` shuffle variables here pass clean.

### FP 5: Safe Regex Flagged as ReDoS

```javascript
// ✅ SAFE: Simple email regex — SonarJS flags ❌
export function safe_regex_simple(input) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(input);
}
```

> **The problem:** this email regex uses negated character classes with no nested quantifiers — no super-linear backtracking. SonarJS flags it anyway; the Interlace fleet passes it.

### False Positive Summary

| FP  | Safe Pattern                              | SonarJS Rule              | Why It's Wrong              |
| :-- | :---------------------------------------- | :------------------------ | :-------------------------- |
| 1   | `execFile("ls", ["-la"])`                 | `no-os-command-from-path` | Literal args, no user input |
| 2   | `spawn("convert", [...], {shell: false})` | `no-os-command-from-path` | Shell disabled explicitly   |
| 3   | `execFile` with allowlist validation      | `no-os-command-from-path` | Input validated before use  |
| 4   | `Math.random()` for array shuffle         | `pseudo-random`           | Non-security use case       |
| 5   | Simple email regex                        | `slow-regex`              | No nested quantifiers       |

**Interlace: 0 false positives.** Every warning is actionable.

---

## Compatibility

The fleet is built to drop into any modern JavaScript toolchain.

**Install** (pick your package manager):

```bash
# npm
npm install -D eslint-plugin-node-security eslint-plugin-secure-coding eslint-plugin-pg eslint-plugin-jwt eslint-plugin-browser-security eslint-plugin-mongodb-security eslint-plugin-express-security eslint-plugin-nestjs-security eslint-plugin-lambda-security eslint-plugin-vercel-ai-security

# yarn
yarn add -D eslint-plugin-node-security eslint-plugin-secure-coding eslint-plugin-pg eslint-plugin-jwt eslint-plugin-browser-security eslint-plugin-mongodb-security eslint-plugin-express-security eslint-plugin-nestjs-security eslint-plugin-lambda-security eslint-plugin-vercel-ai-security

# pnpm
pnpm add -D eslint-plugin-node-security eslint-plugin-secure-coding eslint-plugin-pg eslint-plugin-jwt eslint-plugin-browser-security eslint-plugin-mongodb-security eslint-plugin-express-security eslint-plugin-nestjs-security eslint-plugin-lambda-security eslint-plugin-vercel-ai-security
```

**Runtime & engine support:**

| Requirement       | Supported                                                                                                                                                 |
| :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js**       | ≥ 18 (tested on 18, 20, 22, 24)                                                                                                                           |
| **ESLint**        | 8, 9, and 10 (flat config) — `peerDependencies: ^8 \|\| ^9 \|\| ^10`                                                                                      |
| **Module format** | ESM + CommonJS (dual published)                                                                                                                           |
| **Oxlint**        | ✅ Yes — every plugin ships an `/oxlint` entry                                                                                                            |
| **Browser code**  | These are **lint-time** rules (run in Node during CI/editor); they analyse browser-targeted source like `innerHTML` sinks but require no browser runtime. |

**Oxlint** is the fast-tier story. Oxlint loads JS plugins via its loader, and each plugin exposes a dedicated sub-export, so the _same rules_ run under the Rust engine:

```jsonc
// .oxlintrc.json
{
  "jsPlugins": [
    "eslint-plugin-node-security/oxlint",
    "eslint-plugin-secure-coding/oxlint",
  ],
}
```

The rule library is the product; the engine is a commodity. Run the deep tier in CI under ESLint and the fast tier in your editor under Oxlint — same findings, no rewrite.

---

## The Verdict

| Dimension              | SonarJS | Interlace fleet | Stronger for      |
| :--------------------- | :------ | :-------------- | :---------------- |
| **Total rules**        | 269     | ~200            | SonarJS (breadth) |
| **Security detection** | 35%     | 100%            | **Interlace**     |
| **False positives**    | 5       | 0               | **Interlace**     |
| **Category coverage**  | 7/14    | 14/14           | **Interlace**     |
| **ESLint 9 support**   | ✅      | ✅ (8/9/10)     | Tie               |
| **Oxlint support**     | ➖      | ✅              | **Interlace**     |
| **Active maintenance** | ✅      | ✅              | Tie               |

### Where SonarJS Excels

Let's be clear: **SonarJS is an excellent tool.** Where it genuinely shines:

**Security categories with strong coverage:**

- ✅ **Command Injection**: 4/4 — `sonarjs/os-command` is best-in-class, catching `exec`, `execSync`, and the subtle `spawn({ shell: true })`.
- ✅ **Insecure Randomness**: 2/2 — `sonarjs/pseudo-random` correctly flags `Math.random()` in security contexts.
- ✅ **Weak Hashing**: 2/2 — `sonarjs/hashing` reliably flags MD5 and SHA1.
- ✅ **JWT `none` Algorithm**: caught via `sonarjs/insecure-jwt-token`.
- ✅ **Code Eval**: 2/2 — `sonarjs/code-eval` catches both `eval()` and `new Function()`.
- ✅ **ReDoS**: catches catastrophic backtracking via `sonarjs/slow-regex`.

**Code quality (not covered in this benchmark):**

- 🏆 **Cognitive Complexity** — one of the best implementations available.
- 🏆 **Dead-Code Detection** — unreachable code, unused assignments, redundant booleans.
- 🏆 **Code-Smell Detection** — duplicate branches, collapsible `if`s, identical expressions.
- 🏆 **Bug Detection** — all-identical comparisons, useless intersections, empty collections.

Both plugins have quality rules — this benchmark focused exclusively on security.

### Where SonarJS Needs Help

For a Node.js backend, these gaps matter:

- SQL Injection (0/4) — no database-aware analysis
- Path Traversal (0/4) — no `fs`-aware rules
- Prototype Pollution (0/3) — no object-injection detection
- Timing Attacks (0/2) — no constant-time comparison rule
- NoSQL Injection (0/2) — no MongoDB-specific rules
- SSRF (0/2) — no outbound-request validation
- Open Redirect (0/1) — no redirect rule

These aren't flaws — they're scope gaps. SonarJS was built for the breadth of JavaScript quality, not the depth of Node.js security. That's where specialized plugins fill in.

### Recommendation: Use Both

**The strongest config runs SonarJS _and_ dedicated security plugins.** They complement each other — SonarJS for quality, the fleet for security. This is the exact config that produced 40/40 above:

```javascript
// eslint.config.js — quality + security, side by side
import sonarjs from "eslint-plugin-sonarjs";
import secureCoding from "eslint-plugin-secure-coding";
import nodeSecurity from "eslint-plugin-node-security";
import pg from "eslint-plugin-pg";
import jwt from "eslint-plugin-jwt";
import browserSecurity from "eslint-plugin-browser-security";
import mongodbSecurity from "eslint-plugin-mongodb-security";
import expressSecurity from "eslint-plugin-express-security";
import nestjsSecurity from "eslint-plugin-nestjs-security";
import lambdaSecurity from "eslint-plugin-lambda-security";
import vercelAiSecurity from "eslint-plugin-vercel-ai-security";

export default [
  sonarjs.configs.recommended, // quality ✅
  secureCoding.configs.recommended, // injection, secrets, deserialization, timing ✅
  nodeSecurity.configs.recommended, // fs, child_process, crypto, SSRF ✅
  pg.configs.recommended, // SQL / node-postgres ✅
  jwt.configs.recommended, // auth ✅
  browserSecurity.configs.recommended, // DOM XSS, redirects ✅
  mongodbSecurity.configs.recommended, // NoSQL ✅
  expressSecurity.configs.recommended, // middleware ✅
  nestjsSecurity.configs.recommended, // NestJS ✅
  lambdaSecurity.configs.recommended, // serverless ✅
  vercelAiSecurity.configs.recommended, // AI SDK ✅
];
```

> Only need a subset? Pick the plugins for your stack — a pure Postgres + Express API needs `pg`, `express-security`, `node-security`, `secure-coding`, and `jwt`. The full fleet is what reproduces the 40/40.

---

## Methodology

### Fixture Design

All 40 vulnerable patterns are real-world code shapes, annotated with CWE identifiers and severity. The 38 safe patterns are correctly-implemented secure alternatives that should **not** trigger warnings — that's how false positives get measured, not just detections.

### Reproducibility

```bash
git clone https://github.com/ofri-peretz/eslint-benchmark-suite
cd eslint-benchmark-suite
npm install
npm run benchmark:fn-fp -- --plugin=interlace   # 40/40, 0 FP
npm run benchmark:fn-fp -- --plugin=sonarjs     # 14/40, 5 FP
```

Every claim here comes from that run. Verified **2026-05-29** on Node.js v24.12.0 / ESLint 9.39.2 with the plugin versions listed in [Test Setup](#test-setup). Results land in `results/fn-fp-comparison/` as JSON — the raw per-rule detections are in there if you want to audit any single case.

> **Honest footnote:** an earlier cut of this benchmark ran before the security fixes shipped to npm and before the randomness rule was consolidated into `node-security`. The numbers above are from the current published packages; if you reproduce on older versions you may see a lower score. That's the point of pinning versions.

---

## Part of the Benchmark Series

This article is part of the [ESLint Security Benchmark Series](/articles/benchmark-17-eslint-security-plugins-compared):

- **📊 [17 Plugins Benchmarked: The Full Ecosystem Report](/articles/benchmark-17-eslint-security-plugins-compared)**
- **📖 You are here: SonarJS vs the Interlace fleet**
- [Microsoft SDL vs Interlace: Enterprise Security Benchmark](/articles/benchmark-microsoft-sdl-vs-interlace)
- [eslint-plugin-security Is Unmaintained — Here's What Nobody Tells You](/articles/eslint-plugin-security-is-unmaintained-heres-what-nobody-tells-you-96h)

---

## Explore the Full Fleet

> **~200 security rules. 10 specialized plugins. 40/40 detection. 0 false positives. ESLint + Oxlint.**
>
> [📖 Documentation](https://eslint.interlace.tools) | [⭐ GitHub](https://github.com/ofri-peretz/eslint) | [📦 npm](https://npmjs.com/~ofriperetz)

---

**Build securely.**

I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace ecosystem. I build static-analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev?utm_source=devto&utm_medium=article&utm_campaign=sonarjs-benchmark) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
