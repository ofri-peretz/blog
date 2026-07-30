---
title: "MongoDB Injection Bugs Your Code Review Misses: 4 Shapes, 16 ESLint Rules, 1 Honest Gap"
description: '{ "$ne": null } as a password bypasses MongoDB auth — no SQL string, no injection your generic linter understands. One install command, four lines of config, and the first run on a 19-line Express login route returns 7 real findings. NoSQL operator injection, the $where RCE behind CVE-2025-23061, and the 16 CWE-mapped ESLint rules built specifically for MongoDB/Mongoose — catching 3 of the 4 bugs below in CI, with the fourth named as the gap it is.'
slug: "getting-started-eslint-plugin-mongodb-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-mongodb-security"
tier: "TUTORIAL"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-mongodb-security-ol6"
devto_id: 3790107
published_at: "2026-05-31"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-mongodb-security.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-mongodb-security-og.jpg?v=b2"
reading_time_minutes: 11
tags:
  - "security"
  - "node"
  - "devsecops"
  - "eslint"
series: "The Hardened Stack"
reactions: 0
comments: 0
views: 0
author:
---

> In production, MongoDB injection doesn't look like `; DROP TABLE` — it looks like `{ "$ne": null }` in a JSON body that Express parses silently, bypassing your entire authentication layer with zero SQL and zero error messages.

A nineteen-line Express login route — the shape every Node.js codebase has three of — returns **seven findings on the first `npx eslint` run**: four errors, three warnings, all real, [full output below](#what-you-get-on-a-typical-vulnerable-file). That is the concrete outcome of this guide, and getting there costs one install command plus four lines of config.

`{ "$ne": null }` is not a typo or a missing `await`. It's user-controlled request data flowing directly into a MongoDB query with no sanitization — operator injection, [A03 Injection](https://ofriperetz.dev/articles/owasp-top-10-explained) in OWASP's numbering, and a class generic linters can't see and code review consistently misses, because the type is `any`, the test posts a string, and the build stays green.

If you'd rather see findings on your own repo before reading the explanations, [jump to setup](#how-to-catch-mongodb-injection-in-ci) — it's this, and then a config block:

```bash
npm install eslint-plugin-mongodb-security --save-dev
```

Otherwise: here are four specific bugs your team has almost certainly shipped — three the linter blocks outright, and one gap in the ruleset that review discipline still has to cover. I name the gap in Bug 4 rather than let you discover it in production.

---

## Bug 1: Authentication Bypass via Operator Injection

`{ "$ne": null }` in a password field bypasses MongoDB authentication via operator injection ([CWE-943](https://ofriperetz.dev/articles/cwe-taxonomy-explained), [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) 9.8) — no SQL string, no error, full auth bypass with a known username and zero correct credentials.

**Vulnerable:**

```javascript
// POST body: { "username": "admin", "password": { "$ne": null } }
await db.collection("users").findOne({
  username: req.body.username,
  password: req.body.password, // ← { "$ne": null } bypasses this one named user
});
```

**Why it survived review:** `password: req.body.password` is the obvious, correct-looking thing to write. Your tests posted a string, everything passed, and nothing in the diff signals that the value could stop being a string. Send `{ "username": "admin", "password": { "$ne": null } }` instead and Express parses the body into a real JavaScript object; `findOne` then matches the named user whose password field is not null — true for every real account. Any known username logs in, no brute force required.

**ESLint rule:** [`no-unsafe-query`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-unsafe-query), catching a CWE-943 injection (CVSS 9.8) on both `username` and `password` — one finding per tainted property. [`no-operator-injection`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-operator-injection) is the sibling rule for the _inverse_ shape: code that writes the dangerous operator explicitly in source, like `password: { $ne: req.body.exclude }`. Here the operator only exists in the attacker's JSON, not in your source, so `no-unsafe-query`'s broader "tainted value reaches a query sink" check is the one that fires — confirmed by running both rules against this exact snippet. One scope caveat, and it's a real one: the check is direct-expression, not full inter-procedural [taint tracking](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) — `const pwd = req.body.password; findOne({ password: pwd })` one hop removed can still slip past today. That is a [false negative](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) by design, not by accident: the rule trades that hop for near-zero noise on the direct shape, which is the shape that actually ships.

**Fix:**

```javascript
// ✅ Hash and compare separately — never query by raw password
const user = await db.collection("users").findOne({
  username: { $eq: req.body.username },
});
if (!user) return res.status(401).json({ error: "Invalid credentials" });
const valid = await bcrypt.compare(req.body.password, user.passwordHash);
if (!valid) return res.status(401).json({ error: "Invalid credentials" });
```

One correction worth being explicit about, because it's a common misconception: switching to Mongoose (`User.findOne` instead of the raw driver) does **not** fix this on its own. I checked — Mongoose's schema-level casting only coerces an operator's _operand_, not the operator itself; `findOne({ username: { $ne: null } })` against a `String`-typed field passes straight through as `{ username: { $ne: null } }` on current Mongoose (verified on 9.7.3, `strictQuery` on or off), because `$ne` is a valid query operator and `null` needs no casting. The ODM layer is not a NoSQL-injection boundary. What actually closes the hole is the explicit `$eq` wrap `no-unsafe-query`'s own suggested fix uses, plus never gating auth on anything but `bcrypt.compare` against the hash — the query only has to find the account, not verify the password.

---

## Bug 2: `$where` RCE via Aggregation Injection

`$where` runs arbitrary server-side JavaScript inside the MongoDB process — reaching it with any user-controlled string, hand-written or smuggled through `populate()`, is remote code execution (CWE-943, CVSS 9.0 as the rule ships it), not a filter bug.

**Vulnerable:**

```javascript
db.collection("orders").find({
  $where: `this.total > ${req.query.minTotal}`,
});
```

**Why it survived review:** Template literal interpolation looks like ordinary string formatting. Reviewers see it as building a filter, not executing user-supplied JavaScript on the database server. But `$where` runs server-side JS — this is a direct code execution primitive, whether a developer types it by hand (as here) or an attacker smuggles it in through a filter the app never meant to expose. That second path is exactly what [CVE-2024-53900](https://nvd.nist.gov/vuln/detail/CVE-2024-53900) and its bypass [CVE-2025-23061](https://nvd.nist.gov/vuln/detail/CVE-2025-23061) are: Mongoose's `populate({ match: req.body.filter })` forwarded attacker-controlled filters into its internal `sift()` evaluator, which honors `$where` (and, after the first patch, a `$or`-nested `$where`) and executes it in the app process. Different entry point, same lesson — `$where` reaching user input in any form is the vulnerability, not just the hand-written version shown here.

The `populate()` path is exactly what [`no-unsafe-populate`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-unsafe-populate) exists for — it fires the same way `no-unsafe-where` does here, just on the `match` option instead of a direct query:

```javascript
// Vulnerable: req.body.filter reaches populate()'s match option
Order.find({ userId: req.user.id }).populate({
  path: "items",
  match: req.body.filter, // ← forwarded into sift(), which honors $where
});
```

```text
4:3  error  CWE-943  no-unsafe-populate   (req.body.filter reaches populate().match, line 4 of this snippet)
```

One patch closed the original `$where` path; the bypass reopened it through a `$or`-nested variant — which is why the rule flags the `match` option itself rather than trying to enumerate every operator shape that reaches `sift()`.

**ESLint rule:** [`no-unsafe-where`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-unsafe-where) + [`no-unsafe-query`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-unsafe-query) — both CWE-943, but they print different scores on the same line of code: `no-unsafe-where` emits **9.0**, `no-unsafe-query` emits **9.8** (rule metadata read at v8.2.5, 2026-07-27). Take the higher one as the triage number; the two rules are scoring different things — a sink that should never exist versus tainted data reaching it.

**Fix:**

```javascript
// ✅ Use typed query operators instead of $where
db.collection("orders").find({
  total: { $gt: Number(req.query.minTotal) },
});
```

If your cluster runs with `security.javascriptEnabled: false` (the default on MongoDB Atlas; opt-in on self-managed deployments), this exact payload fails loudly with a server-side error instead of executing silently — but the linter still catches it at author time, before you find out which setting your production cluster actually has.

---

## Bug 3: Missing Field Projection Leaks Sensitive Data

An unprojected `.find()` returns every field in the document — not just the ones the caller asked for — which means a schema change six months from now can turn a "clean, simple query" into a data leak (CWE-200) without anyone touching this line again.

**Vulnerable:**

```javascript
// Returns every field including passwordHash, ssn, tokens
const users = await User.find({ role: "member" });
```

**Why it survived review:** No projection looks like a clean, simple query. Reviewers rarely think about what fields the document contains — they're focused on the filter logic. This is the one bug in the article that isn't injection at all: nobody sent a malicious payload, the query is exactly what the developer intended, and it's still a leak. That's also why it's the easiest to miss twice. A schema evolves the way schemas do: `ssn` gets added for a KYC feature, `passwordResetToken` gets added six sprints later for a "forgot password" flow, both land on the same `User` model this `.find({ role: "member" })` already queries — and the unprojected call three files away starts returning both fields to whatever serializer or API response touches `users` next, with no diff on this line to review. The bug isn't in the code that changed; it's in the code that didn't.

**ESLint rule:** [`no-select-sensitive-fields`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-select-sensitive-fields) + [`no-unbounded-find`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-unbounded-find) (CWE-200, CWE-400)

**Fix:**

```javascript
// ✅ Mongoose: explicit projection + a bound — clears both rules
const users = await User.find({ role: "member" })
  .select("name email -_id")
  .limit(100);
```

Or, on the native driver, where the projection lives under a `projection` key:

```javascript
// ✅ Same two guarantees, driver syntax
const users = await db
  .collection("users")
  .find(
    { role: "member" },
    { projection: { name: 1, email: 1, _id: 0 }, limit: 100 },
  )
  .toArray();
```

The `-_id` isn't decoration — MongoDB includes `_id` in the result by default even with an otherwise-selective projection, so it's the one field you have to exclude explicitly if the caller shouldn't see it.

The shape matters more than it should, and this is a rough edge in my own rule rather than in MongoDB: `no-select-sensitive-fields` recognizes a `.select()` chain, and it recognizes the native driver's `{ projection: { … } }` options object — but it does **not** recognize Mongoose's bare second-argument form, `User.find(filter, { name: 1, email: 1 })`. That form is a perfectly valid projection at runtime and closes the leak; the rule still warns on it. A false positive on safe code, in other words, and the reason the Mongoose example above uses `.select()`. If you hit that warning on a query you know is projected, that's why — and it's on my list, not on yours.

---

## Bug 4: Aggregation Pipeline Injection

Passing `req.body` straight into an `.aggregate()` pipeline stage lets an attacker reshape the filter itself — erasing scoping, abusing operators, or triggering regex backtracking (CWE-400) — and it's the one bug in this article the plugin doesn't catch yet.

**Vulnerable:**

```javascript
const pipeline = [
  { $match: { category: req.query.category } },
  { $group: { _id: "$userId", total: { $sum: "$amount" } } },
  { $match: req.body.additionalFilter }, // ← attacker controls pipeline stage
];
await db.collection("transactions").aggregate(pipeline);
```

**Why it survived review:** The first `$match` looks safe (it's a string field). The second one — accepting the entire filter body of a `$match` stage from the request body — looks like "flexible filtering" in a code review. It isn't. `req.body.additionalFilter` becomes the filter document passed to `$match`, not a new pipeline stage — so an attacker can't smuggle in a `$lookup` this way (`$match` only accepts query operators, not stage names), but they can send `{}` to erase the intended category scoping and match every transaction, `{ "$expr": { "$gt": ["$total", 0] } }`-style operator abuse to reshape the filter arbitrarily, or an unbounded `{ "field": { "$regex": "^(a+)+$" } }` to trigger catastrophic regex backtracking (CWE-400) on every document in the collection. The blast radius is the same as any unconstrained filter object: the attacker controls what "matches," not what MongoDB executes.

**ESLint rule:** none of the 16, honestly. `no-unsafe-query` (CWE-943) checks the first argument to `.find()`/`.aggregate()`/etc. for an inline object literal with a tainted property — `.aggregate(pipeline)` passes an array built earlier, so the rule's `ObjectExpression`-only check never runs on it, and it wouldn't fire even inlined, since `aggregate()`'s first argument is always an array, never the object the rule expects. I checked this against the shipped rule source (v8.2.5) rather than assume: it's a known false negative with a named cause, not a "should be obvious to the linter" claim. Writing the plugin and writing the article that grades it is a conflict of interest, so the useful thing I can do is tell you where my own tool loses — this is the one bug in four the plugin doesn't catch, which is exactly why review discipline on `.aggregate()` calls still matters after you install it.

**Fix:**

```javascript
// ✅ Allowlist the fields you accept; reject rather than silently fall through
const allowedCategories = ["food", "travel", "tech"];
if (!allowedCategories.includes(req.query.category)) {
  return res.status(400).json({ error: "Invalid category" });
}
const pipeline = [
  { $match: { category: req.query.category } },
  { $group: { _id: "$userId", total: { $sum: "$amount" } } },
];
```

The allowlist check has to be a guard, not a ternary with a `null` fallback — `category: null` still matches every document where `category` is null or missing, which quietly widens the query to "everyone's transactions" instead of rejecting the request. Reject early; don't substitute a default that's also a valid filter value.

This allowlist closes the immediate injection, but it also removes dynamic filtering entirely. If the product actually needs caller-supplied filters at this API boundary, the upgrade path is a structured schema (Joi or Zod) that validates the allowed operators and fields explicitly — that's still defense-in-depth alongside the linter, not a replacement for either the allowlist or the rule coverage this bug is missing.

---

## How to catch MongoDB injection in CI

`eslint-plugin-mongodb-security` is the only ESLint plugin built specifically for MongoDB/Mongoose codebases — 16 rules at v8.2.5 (published 2026-07-19), each mapped to a CWE and the relevant CVE. One config block catches Bugs 1 through 3 above:

```bash
npm install eslint-plugin-mongodb-security --save-dev
```

```javascript
// eslint.config.mjs
import mongodbSecurity from "eslint-plugin-mongodb-security";

export default [mongodbSecurity.configs.recommended];
```

That's the whole setup. The preset registers the plugin under the `mongodb-security` namespace and sets all 16 severities itself, so there's no `plugins:` block to write and no rule list to maintain by hand. It ships as flat config, so you want ESLint 9 or newer — on a legacy `.eslintrc` project, migrate the config file first; that's the only prerequisite here.

Run `npx eslint .` and findings appear at the exact vulnerable line, tagged with CWE number and a fix suggestion. The `recommended` preset fires the NoSQL-injection rules as errors (CI-blocking) and the data-exposure rules as warnings. Use `configs.strict` to promote all 16 to errors. `configs.mongoose` is the ODM-focused preset: it promotes `require-schema-validation`, `no-bypass-middleware`, and `no-select-sensitive-fields` from warnings to errors — but it enables **9 rules, not 16**, dropping the credential and connection rules on the assumption that a Mongoose app configures its connection elsewhere. Compose it _alongside_ `recommended` rather than instead of it, unless you've checked that assumption holds in your repo.

### What you get on a typical vulnerable file

Ran the `recommended` preset over this 19-line Express login route. Paste it into a file and [reproduce](https://ofriperetz.dev/articles/reproducibility-vs-replicability) the output below rather than take my word for it — that's the fastest way to confirm the install actually works:

```javascript
const { MongoClient } = require("mongodb");
const client = new MongoClient(
  "mongodb://admin:supersecret@prod-cluster.example.com:27017/app",
);

async function login(req, res) {
  const db = client.db("app");
  const user = await db.collection("users").findOne({
    username: req.body.username,
    password: req.body.password,
  });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const orders = await db
    .collection("orders")
    .find({
      $where: `this.userId == '${user._id}'`,
    })
    .toArray();
  return res.json({ user, orders });
}

module.exports = { login };
```

Running `npx eslint login-route.js` against that exact file gives 7 real findings, line and column numbers included. One unedited line, exactly as ESLint prints it:

```text
7:5  error  Tainted value reaches MongoDB query sink (CWE-943)  mongodb-security/no-unsafe-query
```

The table below is the same 7 findings reformatted for scan-ability — real output prefixes every rule ID with `mongodb-security/` and puts the CWE inside the message string, not in its own column. The parentheticals are my annotations, added after the run, not tool output:

```text
  2:32  error    CWE-798  no-hardcoded-connection-string
  6:22  warning  CWE-200  no-select-sensitive-fields   (the users.findOne — no projection, could return passwordHash)
  7:5   error    CWE-943  no-unsafe-query               (req.body.username)
  8:5   error    CWE-943  no-unsafe-query               (req.body.password)
 13:24  warning  CWE-200  no-select-sensitive-fields   (the orders.find — no projection)
 13:24  warning  CWE-400  no-unbounded-find             (the same orders.find — no .limit())
 14:5   error    CWE-943  no-unsafe-where                ($where — fires on the key alone, see below)

✖ 7 problems (4 errors, 3 warnings)
```

Seven findings, three call sites: the `users.findOne` (lines 6-8) produces one warning and two errors, one per tainted property; the `orders.find()` (lines 13-14) produces two warnings — `no-select-sensitive-fields` and `no-unbounded-find` are independent rules firing on one unguarded call, not double-counting — plus the `$where` error; and the line 2 connection string stands alone. The four errors are what a CI gate should block on merge; the three warnings are the data-exposure class `recommended` flags without blocking.

One honest caveat on that last error: in this snippet `user._id` came back from the database, not from `req.*`, so this specific finding isn't operator-injection in the way Bug 2's `req.query.minTotal` version is — `no-unsafe-where` is still right to fire on it unconditionally, for the reason covered in the rule table below (any `$where` key, tainted or not, is a code-execution primitive).

---

## All 16 eslint-plugin-mongodb-security rules

The 8 injection and credential rules below run at near-zero [false-positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) rate in practice — high [precision](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis), deliberately bought with the recall gap Bug 1 and Bug 4 describe. They get there for two different reasons: `no-unsafe-query` and `no-operator-injection` trace the flagged value back to a `req.*`-shaped source before firing (direct-expression only — see the scope caveat in Bug 1), while `no-unsafe-where` and the credential rules fire on the sink pattern itself (any `$where` key, any literal connection string) regardless of where the interpolated value came from — because there's no safe use of either pattern to begin with, tainted or not.

| Rule                                                                                                                                          | Severity | CWE     | CVSS |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ---: |
| [`no-unsafe-query`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-unsafe-query)                               | error    | CWE-943 |  9.8 |
| [`no-operator-injection`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-operator-injection)                   | error    | CWE-943 |  9.1 |
| [`no-unsafe-where`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-unsafe-where)                               | error    | CWE-943 |  9.0 |
| [`no-hardcoded-connection-string`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-hardcoded-connection-string) | error    | CWE-798 |  7.5 |
| [`no-hardcoded-credentials`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-hardcoded-credentials)             | error    | CWE-798 |  7.5 |
| [`no-unsafe-regex-query`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-unsafe-regex-query)                   | error    | CWE-400 |  7.5 |
| [`no-unsafe-populate`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-unsafe-populate)                         | error    | CWE-943 |  6.5 |
| [`no-debug-mode-production`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-debug-mode-production)             | error    | CWE-489 |  3.1 |
| [`require-tls-connection`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/require-tls-connection)                 | warn     | CWE-295 |  7.4 |
| [`require-auth-mechanism`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/require-auth-mechanism)                 | warn     | CWE-287 |  6.5 |
| [`require-schema-validation`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/require-schema-validation)           | warn     | CWE-20  |  6.1 |
| [`no-select-sensitive-fields`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-select-sensitive-fields)         | warn     | CWE-200 |  5.3 |
| [`no-bypass-middleware`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-bypass-middleware)                     | warn     | CWE-284 |  5.3 |
| [`no-unbounded-find`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/no-unbounded-find)                           | warn     | CWE-400 |  4.3 |
| [`require-projection`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/require-projection)                         | off      | CWE-200 |  3.7 |
| [`require-lean-queries`](https://eslint.interlace.tools/docs/security/plugin-mongodb-security/rules/require-lean-queries)                     | off      | CWE-400 |  4.3 |

Severity, CWE, and CVSS columns are read straight out of the shipped rule metadata at **v8.2.5, checked 2026-07-27** — not from the docs site, which is a separate artifact and can drift. `strict` promotes all 16 to `error`. `require-projection` and `require-lean-queries` are `off` by default (perf hygiene, not security) — turn them on explicitly. `no-select-sensitive-fields` and `require-projection` both carry CWE-200 but check different things: `no-select-sensitive-fields` fires on any `.find()`/`.findOne()`/`.findById()` that lacks a projection provably excluding a default sensitive-field list (`password`, `refreshToken`, `apiKey`, `secret`) — an unprojected call is unsafe by default, since it can't prove those fields are excluded — while `require-projection` (off by default) is the blunter rule that flags _any_ missing projection at all, regardless of field sensitivity. That's why Bug 3's `User.find({ role: "member" })` triggers the former as a warning even though `role` itself isn't sensitive — the query has no projection, so the rule can't rule out `passwordHash` coming back too.

One row in that table is wrong, and it's mine. `require-tls-connection` ships tagged **CWE-295** (Improper Certificate Validation), but the rule flags the absence of TLS entirely, not a misconfigured certificate check on a connection that already has one — the behavior it describes is CWE-319, Cleartext Transmission of Sensitive Information. I wrote that rule, I published an audit of exactly this failure mode ([33 of our 203 rules mislabel their own severity](https://ofriperetz.dev/articles/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score)), and then I shipped one more. The table above prints what the plugin actually emits rather than what I wish it emitted, because a rules table you can't diff against `npx eslint` output is decoration.

The two credential rows (`no-hardcoded-connection-string`, `no-hardcoded-credentials`) are the same CWE-798 class covered in depth in [My credential rule reported 842 secrets in vercel/ai. The real count was 0.](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough) — including why naive secret-detection regexes fire on TypeScript union types. The two `off`-by-default rules are also the noisiest: they flag missing performance hygiene on every query, not a specific exploit, so they're opt-in rather than shipped as warnings.

**"We already run `express-mongo-sanitize`."** That's the first objection any senior MongoDB dev will raise, and it's a fair one — so it's worth being specific about where that middleware stops. `express-mongo-sanitize` strips `$`-prefixed keys from `req.body`/`req.query`/`req.params` on routes where it's mounted. It does nothing for Bug 2's `$where` template literal (the payload isn't a `$`-prefixed key, it's a string interpolated into one), nothing for Bug 4's raw `.aggregate()` pipeline (many teams only mount sanitizer middleware on top-level route bodies, not on every field that eventually reaches an aggregation stage), and nothing for Bug 3's projection leak (there's no operator to strip — the bug is what you _didn't_ ask for, not what the attacker sent). Mongoose's schema-level query casting doesn't help here either — as Bug 1 shows, casting coerces an operator's operand, not the operator itself, so `$ne`/`$gt`/etc. sail through a typed field on the ODM exactly as they would on the raw driver. The linter beats both middleware and the ODM's non-existent injection boundary on Bugs 1 through 3 because it runs at author time, on every code path, including the one an AI assistant just pasted in — before either runtime defense is even in the request path. Bug 4 is the honest exception: neither the sanitizer, Mongoose, nor (currently) the linter catches it, which is the strongest argument for why `.aggregate()` calls still need a human in the loop.

---

## Why generic linters miss this

I ran `eslint-plugin-security` against Bug 1's vulnerable snippet directly: zero findings. Not a near-miss — nothing fires on `password: req.body.password` reaching `findOne()`, because the rule set has no concept of a MongoDB query sink. Generic security linters (`eslint-plugin-security`, `eslint-plugin-sonarjs`) don't know the MongoDB query API. They can't distinguish `db.collection("users").find({ $where: userInput })` from `console.log({ $where: "debug" })`. This is the gap that makes [linting a different tool class from a SAST scan](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting) rather than a cheaper version of one: the sink list is the product. I benchmarked 17 security-adjacent ESLint plugins head-to-head against a labelled [ground-truth corpus](https://ofriperetz.dev/articles/ground-truth-in-security-testing) in [The #1 ESLint Security Plugin Just Got Fixed. It Still Catches 0 of 6 SQL Injections.](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) — `eslint-plugin-security` misses every MongoDB-specific finding across the full corpus, not just this one.

The MongoDB-specific plugin knows which methods are query execution points (`.find()`, `.findOne()`, `.aggregate()`, `.updateMany()`), which operators are dangerous (`$where`, `$expr`, `$function`, `$accumulator`), and what constitutes user input in the MongoDB context.

---

## Why AI assistants generate MongoDB injection bugs at scale

MongoDB operator injection, `$where` RCE, projection leaks, and pipeline injection are not hypotheticals — they are the shapes AI assistants hand back when asked for "an Express login route with MongoDB." I benchmarked [700 AI-generated functions across 5 models](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong) (snapshot dated **2026-02-09**) — see [Aggregate Benchmarks Lie. Here's What 700 AI Functions Look Like by Security Domain.](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain) for the full per-domain breakdown — and sliced to the database layer, filtered to the functions that made a database call:

| Model (database tasks) | Vulnerability rate |
| ---------------------- | -----------------: |
| Claude Haiku 4.5       |                39% |
| Claude Opus 4.6        |                61% |
| Claude Sonnet 4.5      |                71% |
| Gemini 2.5 Flash       |                75% |
| Gemini 2.5 Pro         |            **96%** |

Two honest boundaries on that table before you quote it. First, it's the database-task slice only (the subset of the 700 that made a DB call), not the models' overall security scores — Opus 4.6's 61% here is database-layer specific and says nothing about its standing on auth or injection classes outside this slice. Second, and more relevant to a MongoDB article: **the database prompts in that run targeted PostgreSQL, not MongoDB.** What transfers is the class — a model that interpolates user input into a query sink does it the same way whether the sink is `$1` or `$where` — not the exact percentage. Treat 96% as the [base rate](https://ofriperetz.dev/articles/base-rate-problem-explained) for AI-written data-layer code in general, and run the linter to get your own.

Read as a slice, the ordering is still counterintuitive: Claude Haiku 4.5 at 39% beats both larger Claude models on this task class, which is the kind of inversion worth checking your own assumptions against before picking a model by parameter count alone.

The flagship Gemini model shipped a database-layer vulnerability in 96% of runs. The twist: that same model fixed 93% of its database bugs the moment it was handed the CWE-tagged violation from the linter — the same shape `no-unsafe-query` (CWE-943) emits. The model writes the bug; the linter names it in the model's own language; the model fixes it on the next turn. The SQL-side counterpart shows the same flagship model at the same failure rate: [Gemini 2.5 Pro Wrote Unsafe SQL 96% of the Time — 3 Node.js Injection Patterns](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint).

That's why the rule lives in the linter and not in a wiki page. A static rule is the only reviewer that runs on every save, every paste, every AI completion — and it doesn't get tired on the 40th login route.

For the onboarding workflow that pairs this with a broader static-analysis protocol, see [The 30-Minute Security Audit: 140 Gemini-Written Functions, 102 Shipped Vulnerable](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase).

---

**`{ "$ne": null }` is a valid password against every MongoDB auth handler above. The linter is the one reviewer that rejects it on every save, every paste, and every AI completion — including the three of four shapes above, and honestly excluding the fourth.**

Point it at your repo and find out which ones you have:

```bash
npm install eslint-plugin-mongodb-security --save-dev
npx eslint .
```

Three of the four bugs in this article stop at that command. The fourth — the `.aggregate()` pipeline — stops at a human reading the diff, until I close the gap. When I do, it'll be because someone ran the plugin on a real pipeline and told me what it missed: **which shape did it miss in your codebase?** Open an issue with the snippet, or leave it in the comments and I'll pick it up from there.

**Next in The Hardened Stack** — the credential rules in the table above are the same class that produced my worst false-positive result to date: [My credential rule reported 842 secrets in vercel/ai. The real count was 0.](https://ofriperetz.dev/articles/no-hardcoded-credentials-entropy-isnt-enough) — how entropy-based secret detection goes wrong, and what replaced it. The SQL-side counterpart, if you have both databases: [Your node-postgres Data Layer Fails 4 Ways in Production](https://ofriperetz.dev/articles/sql-injection-node-postgres-pattern).

Also relevant:

- [I Let Claude Write 80 Functions. 65-75% Had Security Vulnerabilities.](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
- [We Ranked 5 AI Models by Security. The Leaderboard Is Wrong.](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
- [I Asked Claude to Fix Its Own Security Bugs. 1 in 3 Fixes Added a NEW Vulnerability.](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more)

---

_[eslint-plugin-mongodb-security](https://www.npmjs.com/package/eslint-plugin-mongodb-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
