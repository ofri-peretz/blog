---
title: "search_path Hijacking: the PostgreSQL Attack That Turns SELECT * FROM users Into the Attacker's Table"
description: "Control a connection's search_path and every unqualified query silently resolves to your schema. The obscure-but-lethal PostgreSQL attack, why SET can't be parameterized, the real fixes, and the CWE-426 ESLint rule that catches it."
slug: "searchpath-hijacking-postgresql-attack"
canonical_url: "https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack"
devto_url: "https://dev.to/ofri-peretz/searchpath-hijacking-the-postgresql-attack-youve-never-heard-of-10co"
devto_id: 3144104
published_at: "2026-01-02T19:49:31Z"
edited_at: "2026-01-11T10:21:32Z"
cover_image: "https://ofriperetz.dev/og/cover/searchpath-hijacking-postgresql-attack"
social_image: "https://ofriperetz.dev/og/article/searchpath-hijacking-postgresql-attack"
reading_time_minutes: 8
# Tag strategy (DEV.to hard cap = 4):
#   security + ai    → winner cluster (powers our highest-comment AI-security pieces)
#   node             → node-postgres discovery path; the code is all node-postgres
#   googleai         → Google AI / Gemini angle + the Build-with-Gemini-XPRIZE feed tag
# Dropped "devsecops": weakest discovery tag here; "googleai" unlocks the XPRIZE feed and
#   matches this piece's Gemini 2.5 Pro 96% datapoint (see the AI-assistant section).
# Build-with-Gemini-XPRIZE adaptation path (window May 19–Aug 17, 2026): one-step entry —
#   re-running eslint-plugin-pg against Gemini 2.5 Pro on Database Operations is already in
#   the body with #googleai present. To submit, free one slot (drop "node") and add
#   "geminichallenge". Not done here: an unsubmitted #geminichallenge tag is dead discovery.
tags:
  - "security"
  - "node"
  - "ai"
  - "googleai"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Postgres Security Protocol"
---

Everyone knows SQL injection. Almost nobody guards `search_path` hijacking —
and it turns a perfectly ordinary `SELECT * FROM users` into a read from an
**attacker-controlled table**, no injection string required.

There is no `'; DROP TABLE` here. No quotes to escape, no payload to spot in a
diff. The query that gets exploited is the most boring line in your codebase —
which is exactly why it survives review. I've watched this pattern slip past
engineers who would have caught a classic injection in their sleep.

And it's no longer just humans shipping it. When I benchmarked five AI models on
the same PostgreSQL data-access prompts, the `eslint-plugin-pg` ruleset flagged
**39%–96% of their generated functions** —
[the worst offenders were the models that wrote the most "senior-looking" code](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain).
A connection-hook `SET search_path` is precisely the kind of boring, trusted-feeling
line that both a tired reviewer and a code-generating model wave straight through.

> Part of the **Postgres Security Protocol** series. If you're hardening a
> node-postgres codebase, start with
> [Three SQL Injection Patterns That Still Ship in Node.js](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint),
> then come back here — `search_path` hijacking is the one those three patterns
> don't cover.

## What `search_path` is

When you reference a table _unqualified_, PostgreSQL resolves the name by
walking `search_path`, schema by schema, and uses the first match:

```sql
-- with search_path = public, these are equivalent:
SELECT * FROM users;
SELECT * FROM public.users;
```

`search_path` is therefore a **name-resolution control surface**: change it, and
the same query binds to a different table.

## The attack

```js
// ❌ search_path set from user input
const schema = req.query.tenant; // attacker controls this
await client.query(`SET search_path TO ${schema}`);
await client.query("SELECT * FROM users"); // now reads the attacker's table
```

The attacker creates a schema with a malicious `users` table (or a shadowing
`crypt()` function), points `search_path` at it, and your unqualified query
returns their data — or runs their function with your privileges.

You can watch the binding flip in ~30 seconds in any local `psql` — no app, no
exploit framework, just standard name resolution doing exactly what it's
documented to do:

```sql
CREATE SCHEMA evil;
CREATE TABLE public.users AS SELECT 'real'  AS who;
CREATE TABLE evil.users   AS SELECT 'pwned' AS who;

SET search_path TO evil, public;
SELECT * FROM users;  -- 'pwned' — same query, attacker's table
```

That is the whole vulnerability: nothing was injected, nothing was malformed.
The string `SELECT * FROM users` never changed — only the schema it resolved to
did.

| Vector               | Impact                                             |
| -------------------- | -------------------------------------------------- |
| Data redirection     | Read/return rows from a fake table; capture writes |
| Privilege escalation | Shadow a trusted `SECURITY DEFINER` function       |
| Code execution       | Malicious trigger/function invoked by your query   |

If you want to grep your own code for this before reading the fixes, it's one
install — the [rule and config are below](#the-rule-no-unsafe-search-path-cwe-426):

```bash
npm install --save-dev eslint-plugin-pg
```

## Why you can't just parameterize it

The reflex for SQL injection is "use a bind parameter." It **doesn't work
here**: `SET` does not accept parameters —

```js
await client.query("SET search_path TO $1", [schema]); // ❌ syntax error
```

— so people fall back to string interpolation, which _is_ the hole. A schema
name is an **identifier**, and identifiers need identifier-escaping, not value
binding.

## Why this survives code review

I've approved code that looked like this. Here's the honest reason it gets
waved through, even by people who would block a string-concatenated `WHERE`
clause on sight:

- **The dangerous line and the exploited line are different lines.** The
  reviewer's injection radar fires on `client.query("SELECT ... " + x)`. It
  does **not** fire on `client.query("SELECT * FROM users")` — that line is
  unimpeachable. The taint lives in a `SET` statement that often sits in
  different middleware, a connection hook, or a `BEFORE` block the reviewer
  scrolled past.
- **`SET` doesn't _look_ like a query.** Mentally, "running a query" is where
  injection lives. `SET search_path` reads like configuration, not data access,
  so it doesn't get the same scrutiny.
- **The value is "from a trusted source."** The schema comes from a tenant
  lookup, a JWT claim, a config row — things that feel authenticated. "Trusted"
  silently becomes "doesn't need escaping," which is a category error: trust is
  about _who_ supplied the value, escaping is about _what shape_ it has.
- **The bind-parameter reflex backfires.** A diligent reviewer asks "is this
  parameterized?" — sees `SET search_path TO $1` won't compile, accepts the
  interpolated fallback as "the only way," and moves on. The reflex that
  normally saves you actively walks you into the hole.

None of those are negligence. They're the failure mode of a control that lives
one indirection away from where the eye is trained to look.

The one that stuck with me: on a multi-tenant audit, the team had done everything
right — schemas behind a hard-coded allow-list, `%I` on the way in. Then a
tenant-rename migration shipped. It updated the tenants table but not the
allow-list constant, so the renamed tenant's `search_path` quietly fell through to
the reset default (`public`) instead of erroring. No exception, no alert — just a
tenant reading the wrong schema until someone noticed the row counts. The guard
was correct the day it was written and wrong two sprints later, because an
allow-list is a _copy_ of a fact that lives somewhere else. That's the half-life
of "trusted": it decays the moment the source of truth moves and the copy
doesn't.

## The real fixes

**1. Don't use a dynamic `search_path` at all — fully-qualify names.** This
sidesteps the whole class:

```js
await client.query("SELECT * FROM public.users"); // resolution is explicit
```

**2. If the schema must be dynamic, escape it as an identifier** with
`pg-format`'s `%I` (the client-side equivalent of `quote_ident()`):

```js
import format from "pg-format";
// %I quotes + escapes the value as an identifier — schema injection is impossible
await client.query(format("SET search_path TO %I", tenantSchema));
```

**3. Or constrain the value so it _can't_ carry injection** — an allow-list of
known schemas, or an integer-only tenant id:

```js
const ALLOWED = new Set(["tenant_1", "tenant_2", "tenant_3"]);
if (!ALLOWED.has(schema)) throw new Error("unknown schema");
await client.query(format("SET search_path TO %I", schema));

// or: a numeric id literally cannot contain SQL
if (!Number.isInteger(tenantId)) throw new Error("bad tenant id");
// yes, this is interpolation — but after the guard the value is a provably
// integer-suffixed literal (no attacker-controllable characters survive
// Number.isInteger), so the conservative rule's flag here is a false positive
// you silence with a documented disable, not a real hole:
// eslint-disable-next-line pg/no-unsafe-search-path -- integer-suffixed literal, validated above
await client.query(`SET search_path TO ${"tenant_" + tenantId}`); // integer-safe
```

What is **never** safe — no matter how "trusted" the source feels — is raw
interpolation of a string identifier: `SET search_path TO ${schema}` is the
vulnerability, not the fix.

## The rule: `no-unsafe-search-path` (CWE-426)

```text
src/tenants.ts
  8:15  error  🔒 CWE-426 OWASP:A05-Security CVSS:7.5 | Unsafe "SET search_path" detected. | CRITICAL [SOC2,PCI-DSS]
              Fix: Do not use dynamic values for search_path. Use static strings or strict validation.
```

```bash
npm install --save-dev eslint-plugin-pg
```

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-pg";
export default [configs.recommended];
```

> **On the CWE.** CWE-426 ("Untrusted Search Path") is canonically an _OS_-path
> weakness — a program resolving an executable or library via an attacker-influenced
> `PATH`/`LD_LIBRARY_PATH`. I map it here deliberately: PostgreSQL's `search_path`
> is the database's exact analog — an ordered resolution list where the first match
> wins, so a writable early entry silently shadows the intended object. The
> mechanism is identical, only the namespace differs. For the `SECURITY DEFINER`
> shadowing case (a malicious `crypt()` or trigger executing with elevated
> privilege) CWE-89 (SQL injection) and CWE-94 (code injection) are the closer fits;
> the rule keeps a single CWE for a clean finding, and CWE-426 is the one that names
> the _root cause_ — untrusted resolution order — rather than the payload.
>
> **Conservative by design.** The rule flags **any** dynamic `SET search_path` —
> it can't prove at lint time that your `%I`/allow-list/integer guard is
> correct. That's intentional: a dynamic search_path is a decision worth a human
> look. Prefer the static/qualified forms; where a validated dynamic value is
> genuinely required, apply `%I` or an allow-list and add a documented
> `// eslint-disable-next-line pg/no-unsafe-search-path` with the reason.

## The multi-tenant pattern, done right

```js
import format from "pg-format";

async function queryTenant(tenantId, sql, params) {
  const tenant = await getTenant(tenantId); // trusted lookup
  if (!tenant) throw new Error("unknown tenant");

  const client = await pool.connect();
  try {
    // identifier-escaped — even a trusted value goes through %I
    await client.query(format("SET search_path TO %I, public", tenant.schema));
    return await client.query(sql, params);
  } finally {
    await client.query("SET search_path TO public"); // reset
    client.release();
  }
}
```

The difference from the broken version: `tenant.schema` being "from a trusted
source" is **not** sufficient — a future refactor, a renamed tenant, or a
mis-seeded row makes "trusted" untrue. Routing it through `%I` makes the
identifier safe by construction, regardless of provenance.

## Why your AI assistant writes the vulnerable version

Ask an LLM to "make the schema configurable per tenant" and watch what comes
back. In my own runs against Claude and GPT-class models, the first draft is
almost always the interpolated form:

```js
// what the assistant reaches for first
await client.query(`SET search_path TO ${tenantSchema}`);
```

It's not a dumb mistake — it's the _statistically likely_ one, for the same
reasons a human reviewer waves it through:

- The model has seen `SET search_path TO <schema>` countless times in docs and
  Stack Overflow answers, almost always with a literal or a plain variable.
  Template-literal interpolation is its default tool for "put this value into a
  string."
- It treats `SET` as configuration, so it doesn't pattern-match to "injection
  sink" and doesn't reach for `%I` or an allow-list unless you explicitly ask
  for the secure multi-tenant version.
- It will confidently "parameterize" by writing `SET search_path TO $1` — which
  doesn't compile — and then "fix" it by falling back to interpolation. The
  same backfiring reflex, now automated.

This is the broader pattern I keep finding: AI doesn't invent novel
vulnerabilities, it **reproduces the common ones at scale** because its training
data is full of the insecure-but-popular form. It's not a hunch — I measured it.
When I ran `eslint-plugin-pg` over PostgreSQL data-access functions written by
five different models, the per-model vulnerability rate on the **Database
Operations** domain ranged from **39% (Haiku 4.5) to 96% (Gemini 2.5 Pro)** —
and counterintuitively, the model that wrote the most production-shaped code
(pooling, env-var config, error handling) tripped the _most_ rules, because that
polish is exactly what talks a reviewer out of looking closer
([the full per-domain breakdown is here](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain)).
I dig into the same effect with a controller a model wrote in
[Claude Wrote a NestJS Service. ESLint Found 6 Security Holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes),
and across the whole 700-function corpus in
[I Let Claude Write 80 Functions; 65–75% Had Security Vulnerabilities](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities).

> **I re-ran this pass against Gemini specifically.** Of the five models, **Gemini
> 2.5 Pro topped the Database Operations domain at 96%** — the same
> `eslint-plugin-pg` ruleset flagged 96% of its generated DB functions, the
> highest of any model in the corpus. That isn't a knock on Gemini's reasoning:
> when I asked it to _fix_ the flagged code, it patched the large majority of its
> own findings on request. The 96% is a write-time artifact — the model defaults
> to the insecure-but-popular `SET search_path TO ${schema}` form for the same
> statistical reason a human reaches for it, then cleans up once a linter points.
> The head-to-head against Claude on the same prompts is in
> [Claude vs Gemini Across 4 Security Domains: A Dead Heat](https://ofriperetz.dev/articles/claude-vs-gemini-across-4-security-domains-a-dead-heat-and-the-hardening-63-of-ai-code-skips).
> (This is also why the piece carries `#googleai` — it's a one-step
> [Build with Gemini](https://dev.to/challenges) submission: the Gemini benchmark
> is already here.)

The practical upshot: the same `no-unsafe-search-path` rule that catches a
human's slip is the cheapest guardrail you can put between an AI-generated
multi-tenant layer and production. Lint runs on machine-written code exactly
like it runs on yours — and it doesn't get talked out of a finding by "but the
value is trusted."

## Defense in depth (the database side)

Static analysis guards the source; pair it with the server:

- `REVOKE CREATE ON SCHEMA public FROM PUBLIC` so attackers can't create the
  shadowing schema/objects in the first place.
- Set a safe `search_path` on the role/function (`ALTER FUNCTION … SET search_path = pg_catalog, public`)
  for `SECURITY DEFINER` functions.
- Qualify names in security-sensitive code regardless.

---

## Compatibility

| Surface              | Support                                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun                                                                  |
| **Node**             | `>= 18.0.0`                                                                           |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                        |
| **`pg` driver**      | peer `^6 \|\| ^7 \|\| ^8`; AST-based, lints regardless of installed version           |
| **Module system**    | CommonJS — `eslint.config.js` or `.mjs`                                               |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-pg` port, parity-gated in CI |

`no-unsafe-search-path` is one of 13 rules in `eslint-plugin-pg`; the
[pg getting-started](https://ofriperetz.dev/articles/getting-started-eslint-plugin-pg)
covers the rest. Two of them dig into failure modes worth their own read:
the [connection leak that took down a production API](https://ofriperetz.dev/articles/database-connection-leak-production-outage)
and the [N+1 insert loop](https://ofriperetz.dev/articles/n-plus-1-insert-loop-api-performance)
that quietly turns one request into thousands of round-trips.

---

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Rule docs: no-unsafe-search-path](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-search-path)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)

**Now go check.** Grep your codebase for `SET search_path` — or just run the
rule. The interpolated ones love to hide in a connection hook or tenant
middleware, one indirection away from the query they actually compromise.

If you find one in a multi-tenant path, here's the one question I want answered
in the comments: **was it your _reviewer_ or your _model_ that the "it's from a
trusted source" line talked out of catching it?**

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if you found a `SET search_path` you didn't know was there.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-pg` is its
node-postgres layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
