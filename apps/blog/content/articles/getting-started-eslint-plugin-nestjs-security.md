---
title: "NestJS Hands You Guards, Pipes, and Throttlers. Your Controllers Ship Without Them. 6 ESLint Rules Catch What You Forgot."
description: "A NestJS controller with no @UseGuards is wide open; a handler with no ValidationPipe takes raw input; an entity returned directly leaks the password hash. 6 CWE-mapped ESLint rules that catch the decorators you forgot, in CI."
slug: "getting-started-eslint-plugin-nestjs-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-nestjs-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-nestjs-security-32ic"
devto_id: 3144090
published_at: "2026-01-02T19:28:48Z"
edited_at: "2026-01-11T10:21:35Z"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/nhu1ka6yvpqg0bpuypni.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-nestjs-security.png"
reading_time_minutes: 9
tags:
  - "eslint"
  - "nestjs"
  - "security"
  - "node"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Hardened Stack"
---

NestJS ships the security primitives most frameworks make you bolt on: Guards
for authorization, `ValidationPipe` + `class-validator` for input, the
`ThrottlerGuard` for rate limiting. The catch is that they're **opt-in per
controller and per handler** — and the decorator you forgot is invisible:

```ts
@Controller("admin")
export class AdminController {
  @Delete(":id") // no @UseGuards — anyone can call DELETE /admin/:id
  remove(@Param("id") id: string) {
    return this.users.remove(id);
  }
}
```

That compiles, passes tests, and is a missing-authorization vulnerability
(**CWE-284**). NestJS gave you `@UseGuards` — you just didn't apply it. Same
story for a DTO with no `class-validator` decorators (raw input,
**CWE-20**), or an entity returned straight from a handler (the `passwordHash`
column ships to the client, **CWE-200**).

`eslint-plugin-nestjs-security` is **6 rules** that read your decorators and
fail CI when the protection you have available isn't wired up — each pinned to
a CWE.

This guide covers how the guard rule walks the controller AST, the validation
pair, the things you accidentally expose, the full 6-rule map, and exact
install/engine support.

---

## TL;DR

- **6 rules**, each carrying a `CWE` id and CVSS.
- **4 presets**: `recommended` (all 6, sensible severities), `strict` (all 6 as
  errors), `guards` (just `require-guards`), and `validation` (the two
  input-validation rules).
- **Flat-config**, CommonJS, ESLint `8 || 9 || 10`, Node `>= 18`. AST-based — it
  reads your `@Controller`/`@Get`/`@UseGuards` decorators; no Nest runtime
  required.

---

## The deep one: `require-guards` (CWE-284)

NestJS authorization is a decorator. The rule walks each `@Controller` and its
route handlers (`@Get`/`@Post`/`@Delete`/…) and reports a handler that has no
`@UseGuards` protecting it — at either the method or the controller level:

```ts
// ❌ require-guards (CWE-284, CVSS 9.8)
@Controller("admin")
export class AdminController {
  @Delete(":id")
  remove(@Param("id") id: string) {
    /* unprotected */
  }
}
```

```ts
// ✅ guard at the controller (covers every handler) — or per-method
@UseGuards(AuthGuard, RolesGuard)
@Controller("admin")
export class AdminController {
  @Delete(":id")
  remove(@Param("id") id: string) {
    /* now gated */
  }
}
```

Two options make it match how real apps are built:

- `requiredGuards: ["AuthGuard"]` — don't just require _any_ guard, require a
  **specific** one (so a stray `@UseGuards(LoggingGuard)` doesn't count as auth).
- `assumeGlobalGuards: true` — if you registered a guard globally
  (`app.useGlobalGuards(...)` or an `APP_GUARD` provider), tell the rule so it
  stops flagging every controller. Without this, a global-guard codebase would
  drown in false positives — the option is why the rule is usable in CI.

---

## The validation pair (CWE-20)

A NestJS handler trusts its DTO. If the DTO has no `class-validator` decorators
**and** no `ValidationPipe` is applied, `req.body` flows in unchecked:

```ts
// ❌ require-class-validator + no-missing-validation-pipe (CWE-20)
export class CreateUserDto {
  email: string; // no @IsEmail()
  role: string; // no @IsIn(['user','admin']) — privilege escalation via body
}

@Post()
create(@Body() dto: CreateUserDto) {
  /* dto is whatever the client sent */
}
```

```ts
// ✅ decorate the DTO + apply the pipe
export class CreateUserDto {
  @IsEmail() email: string;
  @IsIn(["user", "admin"]) role: string;
}

@Post()
@UsePipes(new ValidationPipe({ whitelist: true }))
create(@Body() dto: CreateUserDto) {
  /* validated + stripped of unknown props */
}
```

`require-class-validator` flags DTO properties with no validation decorators;
`no-missing-validation-pipe` flags handlers consuming a `@Body()` with no pipe
guarding it. Together they close the "we trusted the request shape" hole.

---

## The things you accidentally expose

- **`no-exposed-private-fields` (CWE-200)** — returning a TypeORM/Prisma entity
  straight from a handler ships every column, including `passwordHash` /
  `resetToken`. Map to a DTO or use a serialization interceptor.
- **`no-exposed-debug-endpoints` (CWE-489)** — debug/health routes that leak
  internals left reachable in production.
- **`require-throttler` (CWE-770)** — a public mutation with no `@Throttle` /
  `ThrottlerGuard` is a brute-force and cost-amplification target.

---

## The full rule set

All 6, with each rule's declared CWE:

| Rule                         | Catches                                     | CWE     |
| ---------------------------- | ------------------------------------------- | ------- |
| `require-guards`             | Controller/handler with no `@UseGuards`     | CWE-284 |
| `require-class-validator`    | DTO property with no validation decorator   | CWE-20  |
| `no-missing-validation-pipe` | `@Body()` consumed with no `ValidationPipe` | CWE-20  |
| `no-exposed-private-fields`  | entity/private field returned to the client | CWE-200 |
| `require-throttler`          | public route with no rate limiting          | CWE-770 |
| `no-exposed-debug-endpoints` | debug endpoint reachable in prod            | CWE-489 |

---

## Install

```bash
# npm
npm install --save-dev eslint-plugin-nestjs-security
# yarn
yarn add --dev eslint-plugin-nestjs-security
# pnpm
pnpm add --save-dev eslint-plugin-nestjs-security
# bun
bun add --dev eslint-plugin-nestjs-security
```

Flat config (`eslint.config.js`):

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-nestjs-security";

export default [
  configs.recommended, // all 6, sensible severities
  // configs.strict,      // all 6 as errors
  // configs.guards,      // just require-guards
  // configs.validation,  // the two input-validation rules
];
```

Tune the guard rule for a global-guard setup:

```js
import { configs } from "eslint-plugin-nestjs-security";

export default [
  configs.recommended,
  {
    rules: {
      "nestjs-security/require-guards": [
        "error",
        { requiredGuards: ["AuthGuard"], assumeGlobalGuards: false },
      ],
    },
  },
];
```

Run it — findings carry the CWE, OWASP category, CVSS, and fix:

```text
src/admin/admin.controller.ts
  4:3  error  🔒 CWE-284 OWASP:A01-Broken CVSS:9.8 | Controller/route handler remove lacks @UseGuards for access control | CRITICAL
             Fix: Add @UseGuards(AuthGuard): @UseGuards(AuthGuard) before the handler
```

---

## Compatibility

| Surface              | Support                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Package managers** | npm, yarn, pnpm, bun — plain dev dependency                                                                                                                      |
| **Node**             | `>= 18.0.0`                                                                                                                                                      |
| **ESLint**           | `^8.0.0 \|\| ^9.0.0 \|\| ^10.0.0`, flat config                                                                                                                   |
| **NestJS**           | detects `@Controller`/route/`@UseGuards`/`@Body`/`class-validator` decorators — reads source, so no Nest version pin                                             |
| **Module system**    | CommonJS — loads from both `eslint.config.js` and `eslint.config.mjs`                                                                                            |
| **Runtime peers**    | None — it lints source AST                                                                                                                                       |
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the `interlace-nestjs-security` port, with ESLint↔Oxlint parity gated in CI. The full 6-rule set runs on ESLint today. |

---

## What it does — and doesn't — see

- **Decorator presence, not policy correctness.** `require-guards` proves a
  `@UseGuards` exists; it can't prove your `RolesGuard` checks the right role.
  `requiredGuards` lets you insist on a named guard, but the guard's logic is
  yours to get right.
- **Tell it about global wiring.** A global `APP_GUARD` or a global
  `ValidationPipe` is invisible to per-file analysis — set `assumeGlobalGuards`
  (and scope the validation rules) so the linter matches your architecture
  instead of flagging it.

---

## Where this sits in the ecosystem

Generic linters don't know what a `@Controller`, a Guard, or a `@Body()` DTO
_is_. `eslint-plugin-nestjs-security` is the dedicated NestJS layer — the
authorization, validation, exposure, and rate-limiting decorators you have
available but didn't apply — each finding tagged with a CWE and CVSS. It's the
NestJS member of the [Interlace](https://eslint.interlace.tools) family,
complementary to the generic set and to the other server-side plugins
(`eslint-plugin-express-security`, `eslint-plugin-jwt`, …).

---

## Links

- 📦 [npm: eslint-plugin-nestjs-security](https://www.npmjs.com/package/eslint-plugin-nestjs-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-nestjs-security)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if your controllers are missing any of the above.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-nestjs-security`
is its NestJS layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
