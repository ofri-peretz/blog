---
title: "NestJS Hands You Guards, Pipes, and Throttlers. You — and Your AI — Ship Controllers Without Them. 6 ESLint Rules Catch It."
description: "A NestJS controller with no @UseGuards is wide open; a handler with no ValidationPipe takes raw input; an entity returned directly leaks the password hash. The decorator you forgot is invisible — and the AI you paste from forgets it every time. 6 CWE-mapped ESLint rules that catch it in CI."
slug: "getting-started-eslint-plugin-nestjs-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-nestjs-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-nestjs-security-32ic"
devto_id: 3144090
published_at: "2026-01-02T19:28:48Z"
edited_at: "2026-01-11T10:21:35Z"
cover_image: "https://ofriperetz.dev/og/cover/getting-started-eslint-plugin-nestjs-security"
social_image: "https://ofriperetz.dev/og/article/getting-started-eslint-plugin-nestjs-security"
reading_time_minutes: 9
tags:
  - "eslint"
  - "nestjs"
  - "security"
  - "ai"
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

Here's the part that turned this from a nice-to-have into a CI gate for me: the
decorator you forget is also the decorator your **AI assistant** forgets. Ask
Claude or Gemini to "build a NestJS users service" and you get typed DTOs,
wired dependency injection, the right route decorators — and no `@UseGuards` on
the admin route, no `@Throttle` on login, the entity returned straight from the
handler. Not because the model is bad at NestJS, but because authorization and
rate limiting are _constraints the prompt didn't mention_, and a model
optimizes for the behavior you described, not the restrictions you didn't.
TypeScript stays green. The code runs. It looks like a senior wrote it. I've
[watched Claude do exactly this](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes)
and [run the same prompt through Gemini](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors)
— the missing-guard and leaked-`password` patterns survive both.

`eslint-plugin-nestjs-security` is **6 rules** that read your decorators and
fail CI when the protection you have available isn't wired up — each pinned to
a CWE. It doesn't care whether a human or a model left the decorator off; it
checks the AST either way. If you want to point it at your own AI-generated
controllers before reading further, it's one install — [config is below](#install).

This guide covers how the guard rule walks the controller AST, the validation
pair, the things you accidentally expose, the full 6-rule map, and exact
install/engine support — and, for each rule, why the gap survives both an AI
and the human reviewing its output.

---

## TL;DR

- **6 rules**, each carrying a `CWE` id and CVSS.
- **4 presets**: `recommended` (all 6, sensible severities), `strict` (all 6 as
  errors), `guards` (just `require-guards`), and `validation` (the two
  input-validation rules).
- **Flat-config**, CommonJS, ESLint `8 || 9 || 10`, Node `>= 18`. AST-based — it
  reads your `@Controller`/`@Get`/`@UseGuards` decorators; no Nest runtime
  required.
- **Built for the AI-generated-controller case too.** The rules check the AST,
  not the author — so they fire on a handler Claude or Gemini produced exactly
  the same way they fire on one you wrote at 2am. The decorators AI omits
  (`@UseGuards`, `@Throttle`, a `ValidationPipe`) are precisely the ones these
  rules require.

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

**Why this survives review.** Reviewers know the team _has_ a `JwtAuthGuard`
registered somewhere — or think they do. The guard is off the mental stack
while reading route logic. Nobody scans a controller and asks "is there a guard
on this handler?"; they ask "does the logic look right?" The handler body is
correct, the DTO is typed, the service call is named well — approve. An AI
generates the same gap for the mirror-image reason: "list all users" is a valid
feature, "only admins can list users" is a _negation_ of default behavior that
requires intent the prompt never supplied. So the human waves through what the
model omitted, both reasoning about behavior while the constraint sits in a
blind spot. (The longer version, with a 2-year-old codebase where every PR
approved it, is in
[I Inherited a NestJS Codebase](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities).)

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

**Why this survives review.** TypeScript types disappear at runtime; the
`ValidationPipe` is what re-enforces them on the way in. A reviewer reading
`@Body() dto: CreateUserDto` sees a typed parameter and pattern-matches "this is
validated" — the compiler agreed, after all. The gap between compile-time shape
and runtime enforcement isn't visible in the diff. When the DTO _does_ carry
decorators, the failure mode shifts: a reviewer sees `@IsEmail()` on `email`,
reads "this DTO is validated," and never audits field-by-field for the one bare
`role: string` that lets a request body promote itself to admin. AI output lands
in the same two traps — it generates correct TypeScript but doesn't model the
runtime gap, and it validates fields with an obvious semantic type (`email`)
while leaving domain enums like `role` bare, because it can't infer the allowed
values from a domain the prompt never described.

---

## The things you accidentally expose

- **`no-exposed-private-fields` (CWE-200)** — returning a TypeORM/Prisma entity
  straight from a handler ships every column, including `passwordHash` /
  `resetToken`. Map to a DTO or use a serialization interceptor.
- **`no-exposed-debug-endpoints` (CWE-489)** — debug/health routes that leak
  internals left reachable in production.
- **`require-throttler` (CWE-770)** — a public mutation with no `@Throttle` /
  `ThrottlerGuard` is a brute-force and cost-amplification target.

**Why these survive review.** The exposed-entity one is the gap I've never seen
miss on AI-generated NestJS. The entity type is `User`, the controller returns
`User`, TypeScript shows no errors — the reviewer sees typed, structured data
and approves. What they don't see is the JSON shape at runtime, because they're
reading code, not running `curl` against staging; `@Exclude()` from
`class-transformer` only means anything inside Nest's HTTP response lifecycle,
which is invisible in the diff. I would have approved it too. Rate limiting
survives for a different human reason: it reads as an infra concern — "nginx
handles it" — so nobody flags its absence in application code, and the model
never adds a rate cap because "build a login endpoint" describes a function, not
a limit on how fast it can be called.

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
([`eslint-plugin-express-security`](https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-express-security),
[`eslint-plugin-jwt`](https://ofriperetz.dev/articles/getting-started-eslint-plugin-jwt), …).

> Part of **The Hardened Stack** series. The companion pieces put these same 6
> rules under load: what they catch on
> [a service Claude wrote from one prompt](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes),
> [the same prompt run through Gemini](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors),
> and [a 2-year-old inherited codebase](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities)
> where every PR approved the gap. The pattern that AI reintroduces faster than
> you can review it is the broader thesis in
> [The AI Hydra Problem](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more).

---

## Links

- 📦 [npm: eslint-plugin-nestjs-security](https://www.npmjs.com/package/eslint-plugin-nestjs-security)
- 📖 [Full rule docs (per-rule CWE + examples)](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules)
- 💻 [Source on GitHub](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-nestjs-security)

Run `configs.recommended` against one NestJS service today — yours or the last
one an AI generated for you. **Which of the six fired first?** I'd bet on
`require-guards` or the leaked-entity rule, and I'd like to be proven wrong in
the comments — tell me the one that caught a controller you'd already shipped.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if any of the six would fire on a controller you have in prod
right now.
::

---

I'm **Ofri Peretz**, a security engineering leader and the author of the
Interlace ESLint ecosystem — domain-specific static analysis for security,
reliability, and performance on the Node.js stack. `eslint-plugin-nestjs-security`
is its NestJS layer.

[ofriperetz.dev](https://ofriperetz.dev) · [LinkedIn](https://linkedin.com/in/ofri-peretz) · [GitHub](https://github.com/ofri-peretz)
