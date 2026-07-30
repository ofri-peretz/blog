---
title: "search_path Hijacking: the PostgreSQL Attack That Turns SELECT * FROM users Into the Attacker's Table"
description: "Control a connection's search_path and every unqualified query silently resolves to your schema. The obscure-but-lethal PostgreSQL attack, why SET can't be parameterized, the real fixes, and the CWE-426 ESLint rule that catches it."
slug: "searchpath-hijacking-postgresql-attack"
canonical_url: "https://ofriperetz.dev/articles/searchpath-hijacking-postgresql-attack"
tier: "TOPIC"
devto_url: "https://dev.to/ofri-peretz/searchpath-hijacking-the-postgresql-attack-youve-never-heard-of-10co"
devto_id: 3144104
published_at: "2026-01-02T19:49:31Z"
edited_at: "2026-07-20T00:00:00Z"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/searchpath-hijacking-postgresql-attack.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/searchpath-hijacking-postgresql-attack-og.jpg?v=b2"
reading_time_minutes: 9
tags:
  - "security"
  - "database"
  - "node"
  - "devsecops"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "Postgres Security Protocol"
---

`SELECT * FROM users` is the most boring line in your codebase. In the wrong
PostgreSQL setup it's also the one an attacker turns against you — without
changing a single character of it. Control a connection's `search_path` and
every unqualified table reference silently resolves to a schema _they_ picked;
in a multi-tenant database, that means tenant A reads tenant B's data.

There is no `'; DROP TABLE` here. No quotes to escape, no payload to spot in a
diff. The query that gets exploited never changes — which is exactly why it
survives review.

This is not a new bug. The writable-`public`-schema half of it is
[CVE-2018-1058](https://nvd.nist.gov/vuln/detail/CVE-2018-1058) — the 2018
disclosure that pushed PostgreSQL to rewrite its docs around schema-qualified
names and, in PG15, finally revoke the permissive `public` grant by default.
What's fresh is where it lands now: schema-per-tenant SaaS, and AI assistants
generating the exact vulnerable line at scale.

> **The vulnerability is in the PostgreSQL session setup — 2 lines in a connection pool initializer that no application developer thinks to audit.** Search path attacks are invisible to application-level code review because the dangerous line and the exploited line are in completely different places: one in your connection middleware, one deep in your query layer.

The numbers: **2 lines of config** enable the attack, **3 lines** fix it. In a multi-tenant app, every tenant sharing a compromised connection pool is exposed — which in most SaaS architectures means **all tenants** per session.

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

Nobody attacks `search_path` directly — they attack the fact that you never
have to name a schema for PostgreSQL to pick one for you. Control the list,
and every unqualified query downstream binds to whatever table you put first.

## The exact attack — step by step

Here is the complete exploit. You can reproduce this in any local `psql` in under two minutes.

**Step 1: Attacker points `search_path` at a schema that already exists**

The low-privilege version needs no special rights at all — just a shared
connection role that can already read every tenant schema, which is exactly
how most schema-per-tenant apps are wired (one app role, many schemas, no
per-tenant grants):

```sql
-- victim setup — this already exists before the attacker does anything
CREATE SCHEMA tenant_a;
CREATE SCHEMA tenant_b;
CREATE TABLE tenant_a.users AS SELECT 'alice_a' AS who;
CREATE TABLE tenant_b.users AS SELECT 'alice_b' AS who;

-- the attacker's only two moves, using the shared app role's existing
-- USAGE + SELECT on both schemas — that's what "one connection pool,
-- many tenants" usually means in practice
SET search_path TO tenant_b, public;
SELECT * FROM users;  -- 'alice_b' — tenant A's session just read tenant B's row
```

This precondition is the fragile part: if your roles are genuinely
least-privileged — a distinct role per tenant, no cross-schema `SELECT` —
this exact move fails with `permission denied`, not a leak. It's the shared,
over-broad app role (the common case) that turns a `search_path` flip into
a cross-tenant read.

If the attacker's role happens to have `CREATE` on the database (an
over-privileged app role, or any pre-15 cluster that hasn't revoked the
PG15 default — see below), the attack gets worse: they can plant their own
shadow table instead of just reading a sibling tenant's:

```sql
-- escalation case: attacker also has CREATE — plants a fake table
CREATE SCHEMA evil;
CREATE TABLE evil.users AS SELECT 'pwned' AS who, 'attacker@evil.com' AS email;
```

**Step 2: The vulnerable connection setup (2 lines)**

```js
// ❌ connection pool initializer — the 2 vulnerable lines
const schema = req.query.tenant; // line 1: attacker controls this
await client.query(`SET search_path TO ${schema}`); // line 2: raw interpolation
```

**Step 3: Your app's perfectly normal query now reads the wrong table**

```js
// This query is blameless. It never changed.
const result = await client.query("SELECT * FROM users");
// result.rows[0] => { who: 'pwned', email: 'attacker@evil.com' }  (escalation case)
// result.rows[0] => { who: 'alice_b' }                             (no-privilege case: reads tenant B's real row)
```

Both cases hinge on the same 2-line bug. The no-privilege case is the one
that matters most in practice, precisely because it needs no elevated
permissions — only the interpolation flaw and a connection role broad enough
to read more than one tenant's schema, which is the default shape of a
shared connection pool.

**Verify it yourself in psql (30 seconds) — the escalation case**

The Step 1 block above already reproduces the no-privilege read. Here's the
`CREATE`-privileged escalation, for when the role is over-broad enough to
also plant objects:

```sql
CREATE SCHEMA evil;
CREATE TABLE public.users AS SELECT 'real'  AS who;
CREATE TABLE evil.users   AS SELECT 'pwned' AS who;

SET search_path TO evil, public;
SELECT * FROM users;  -- 'pwned' — same query, attacker's table
```

That is the whole vulnerability, in either case: nothing was injected,
nothing was malformed. The string `SELECT * FROM users` never changed —
only the schema it resolved to did.

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

There is one genuinely parameterizable form — `set_config('search_path', $1,
false)` is a regular function call, so the value _can_ go through a bind
parameter:

```js
await client.query("SELECT set_config('search_path', $1, false)", [schema]);
```

Don't mistake this for a fix, though. Bind parameters stop SQL from being
injected into the _statement_ — they say nothing about which schema the
_value_ is allowed to name. `set_config` will happily bind-parameterize a
value of `evil, public` exactly as willingly as `tenant_2, public`; you've
solved the syntax-error problem, not the trust problem. It's a genuine
answer to "isn't there a parameterizable form?" — and a non-answer to
"is this safe with an attacker-controlled value?" You still need `%I` or an
allow-list on what the parameter is allowed to contain.

## Why it survived review

> **search_path hijacking is a 2-line config mistake that gives attacker-controlled schemas precedence over your application schemas. Every unqualified table reference becomes a potential exploit.**

Here is the honest reason it gets waved through, even by people who would block a string-concatenated `WHERE` clause on sight:

- **The dangerous line and the exploited line are different lines.** The
  reviewer's injection radar fires on `client.query("SELECT ... " + x)`. It
  does **not** fire on `client.query("SELECT * FROM users")` — that line is
  unimpeachable. The [taint](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) lives in a `SET` statement that often sits in
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

## The real fixes (3 lines)

**Fix 1: Don't use a dynamic `search_path` at all — fully-qualify names.** This
sidesteps the whole class:

```js
// ✅ resolution is explicit — search_path is irrelevant
await client.query("SELECT * FROM public.users");
```

**Fix 2: If the schema must be dynamic, escape it as an identifier** with
`pg-format`'s `%I` (the client-side equivalent of `quote_ident()`):

```js
import format from "pg-format";
// ✅ %I quotes + escapes the value as an identifier — schema injection is impossible
await client.query(format("SET search_path TO %I", tenantSchema));
```

**Fix 3: Constrain the value so it _can't_ carry injection** — an allow-list of
known schemas, or an integer-only tenant id:

```js
const ALLOWED = new Set(["tenant_1", "tenant_2", "tenant_3"]);
if (!ALLOWED.has(schema)) throw new Error("unknown schema");
await client.query(format("SET search_path TO %I", schema));
```

The disable comment below is only safe because `Number.isInteger` guarantees
the interpolated value can't be anything _but_ digits — a validated integer
literally cannot carry SQL syntax. That guarantee is what earns the
exception; swap the guard for a string check and the same line becomes the
vulnerability again:

```js
// a numeric id literally cannot contain SQL — the guard IS the safety, not the interpolation
if (!Number.isInteger(tenantId)) throw new Error("bad tenant id");
// eslint-disable-next-line pg/no-unsafe-search-path -- integer-suffixed literal, validated above
await client.query(`SET search_path TO ${"tenant_" + tenantId}`);
```

What is **never** safe — no matter how "trusted" the source feels — is raw
interpolation of a _string_ identifier: `SET search_path TO ${schema}` is the
vulnerability, not the fix. The only reason the integer case above is
different is that a validated integer isn't a string in the way that matters —
it can't contain a quote, a semicolon, or a schema name that isn't yours.

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

> **On the CWE.** [CWE-426](https://ofriperetz.dev/articles/cwe-taxonomy-explained) ("Untrusted Search Path") is canonically an _OS_-path
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
>
> **On the severity label.** [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) 7.5 falls in the v3.1 **High** band (7.0–8.9);
> `Critical` starts at 9.0. The rule's fixed label runs ahead of the number —
> if you score the _cross-tenant confidentiality break_ specifically (C:H over
> a plausible network vector), it can land closer to 9.1 and earn `Critical`
> honestly, but as shipped the label and the score disagree —
> `no-unsafe-search-path` is itself one of the [16% of our own rules whose
> printed severity doesn't match its CVSS number](https://ofriperetz.dev/articles/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score),
> so a security-literate reader is right to notice. Treat the finding as
> **High** until the label catches up. Same honesty applies to `OWASP:A05` — in
> the [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained), a
> dynamically interpolated `SET` is arguably closer to **A03 (Injection)** than
> A05 (Misconfiguration); I framed `search_path` as a config surface for this
> rule, but the injection reading is defensible too.

## The multi-tenant pattern, done right

```js
import format from "pg-format";

// tenantId MUST come from the authenticated session (req.session.tenantId /
// the verified JWT claim) — never from a request field the caller can set,
// like req.query.tenant or req.body.tenantId.
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

**`%I` fixes injection, not authorization — they're different bugs.** This
matters most for exactly the no-privilege case from Step 1. `%I` guarantees
`tenant.schema` can't smuggle extra SQL (`evil, public` can't break out of
the identifier). It does **nothing** to stop `%I` from safely, correctly
setting `search_path` to a schema the _caller_ isn't authorized to see. If
`tenantId` is read from a request field instead of the authenticated
session, `queryTenant(attackerSuppliedTenantId, ...)` runs cleanly —
no injection, perfectly escaped, wrong tenant's data. That's not a
`search_path` bug at that point; it's a plain IDOR wearing the same
symptom. `%I` closes the injection axis; only deriving `tenantId` from
something the caller can't forge closes the authorization axis. You need
both.

**Stronger still: `SET LOCAL` instead of `SET`.** The pattern above is
correct — reset in `finally`, always released — but it depends on that reset
actually running. `SET LOCAL search_path TO %I` scopes the change to the
current transaction and auto-reverts at `COMMIT`/`ROLLBACK`, so a forgotten
`release()`, an early return before the `finally`, or a thrown error in a
code path that skips cleanup can't leak tenant A's schema onto the next
request that borrows the same pooled connection. Wrap the query in an
explicit transaction and `SET LOCAL` becomes the belt to the `finally`
block's suspenders.

One sharp edge: `SET LOCAL` **outside** a transaction block is a silent
no-op — PostgreSQL emits `WARNING: SET LOCAL can only be used in transaction
blocks` and the setting never takes effect. Drop it into an autocommit code
path by mistake and you get zero isolation, with only a warning (which most
apps never surface) to tell you. `BEGIN` first, or use plain `SET` with the
`finally` reset if you can't guarantee a transaction wraps the call.

**Schemas aren't the only isolation axis.** If you're choosing a multi-tenant
strategy from scratch, row-level security (`ALTER TABLE … ENABLE ROW LEVEL
SECURITY` plus a tenant-id policy) is the other lever, and it doesn't depend
on `search_path` at all. Schema-per-tenant and RLS aren't mutually
exclusive — plenty of production systems run both — but if you're on RLS
alone, this specific class of bug doesn't apply to you. If you're on
schemas, `search_path` hygiene is load-bearing either way.

## Why your AI assistant writes the vulnerable version

Ask an LLM to "make the schema configurable per tenant" and watch what comes
back. In my own runs against Claude and GPT-class models, the first draft is
almost always the interpolated form:

```js
// what the assistant reaches for first
await client.query(`SET search_path TO ${tenantSchema}`);
```

It's the statistically likely draft, for the same reasons a human reviewer
waves it through:

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

> **On Gemini specifically** — the 96% high-water mark above: that isn't a knock
> on its reasoning. When I asked it to _fix_ the flagged code, it patched the
> large majority of its own findings on request. The number is a write-time
> artifact, not a ceiling — it defaults to the insecure-but-popular form for the
> same statistical reason a human reaches for it, then cleans up once a linter
> points. The head-to-head against Claude on the same prompts is in
> [Claude vs Gemini Across 4 Security Domains: A Dead Heat](https://ofriperetz.dev/articles/claude-vs-gemini-4-security-domains-dead-heat).

The practical upshot: the same `no-unsafe-search-path` rule that catches a
human's slip is the cheapest guardrail you can put between an AI-generated
multi-tenant layer and production. Lint runs on machine-written code exactly
like it runs on yours — and it doesn't get talked out of a finding by "but the
value is trusted."

## Defense in depth (the database side)

Static analysis guards the source; pair it with the server:

- `REVOKE CREATE ON SCHEMA public FROM PUBLIC` so attackers can't create the
  shadowing schema/objects in the first place. This is the exact hardening
  PostgreSQL shipped in response to CVE-2018-1058; PostgreSQL 15 made it the
  default — but only for **newly created** databases on a fresh cluster.
  Upgrade a pre-15 cluster with `pg_upgrade`, or restore an old dump, and it
  keeps the permissive grant it always had. Run the `REVOKE` explicitly;
  don't assume your version number covers you.
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

Related attacks in this series:

- [PostgreSQL COPY FROM: Filesystem Access via SQL](https://ofriperetz.dev/articles/postgresql-copy-from-exploit-filesystem-access) — another vector that lives in a "trusted" server command
- [Three SQL Injection Patterns That Still Ship in Node.js](https://ofriperetz.dev/articles/three-sql-injection-patterns-node-postgres-eslint) — the patterns search_path hijacking deliberately evades

---

- 📦 [npm: eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg)
- 📖 [Rule docs: no-unsafe-search-path](https://eslint.interlace.tools/docs/security/plugin-pg/rules/no-unsafe-search-path)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-pg)
- 🔍 [Full plugin docs](https://eslint.interlace.tools)

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

_[eslint-plugin-pg](https://www.npmjs.com/package/eslint-plugin-pg) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-pg` is its
node-postgres layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
