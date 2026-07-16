---
title: "NestJS Security Bugs Your Decorators Hide From Code Review — 6 Rules That Catch Them in CI"
description: "Missing @UseGuards, unvalidated @Body(), entities leaking passwordHash — NestJS's decorator pattern makes these invisible in review. 6 CWE-mapped ESLint rules that catch every one of them in CI, with vulnerable code, why it survived review, and the fix."
slug: "nestjs-guards-pipes-throttlers-6-eslint-rules"
canonical_url: "https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-nestjs-security-32ic"
devto_id: 3144090
published_at: "2026-01-02T19:28:48Z"
edited_at: "2026-06-21T10:21:35Z"
cover_image: "https://ofriperetz.dev/og/cover/nestjs-guards-pipes-throttlers-6-eslint-rules"
social_image: "https://ofriperetz.dev/og/article/nestjs-guards-pipes-throttlers-6-eslint-rules"
reading_time_minutes: 9
tags:
  - "security"
  - "nestjs"
  - "node"
  - "eslint"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Hardened Stack"
---

> **NestJS hands you every security primitive you need. The bugs hide in the decorators you didn't add — and they're invisible in review.**

I approved a NestJS controller that had no `@UseGuards` on an admin delete route, no `ValidationPipe` on a `@Body()`, and an entity returning `passwordHash` straight to the client. The code compiled, the tests passed, and it looked like a senior wrote it. Six ESLint rules would have caught all three — in under a second, before the PR was opened.

Here are the four vulnerability patterns, why each one survives code review, and the CI rule that catches it.

---

## Finding 1: Unprotected routes — `require-guards` (CWE-284, CVSS 9.8)

**Vulnerable code:**

```ts
@Controller("admin")
export class AdminController {
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.users.remove(id);
  }
}
```

**Why it survived review.**
Nobody scans a controller and asks "is there a guard on this handler?" — they ask "does the logic look right?" The handler body is correct, the service call is named well, TypeScript is green. The team has a `JwtAuthGuard` registered *somewhere*, and reviewers assume it covers this route. It doesn't. `@UseGuards` is opt-in per controller and per handler, which means the decorator you didn't write is the one that left `DELETE /admin/:id` open to the internet.

**ESLint rule:** `nestjs-security/require-guards`

**Fix:**

```ts
@UseGuards(AuthGuard, RolesGuard)
@Controller("admin")
export class AdminController {
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.users.remove(id);
  }
}
```

Config option: `assumeGlobalGuards: true` if you register a guard globally (`APP_GUARD` provider or `app.useGlobalGuards(...)`) so the rule stops flagging every controller.

---

## Finding 2: Unvalidated `@Body()` — `no-missing-validation-pipe` + `require-class-validator` (CWE-20, CVSS 8.6)

**Vulnerable code:**

```ts
export class CreateUserDto {
  email: string;         // no @IsEmail()
  role: string;          // no @IsIn(['user','admin']) — privilege escalation via body
}

@Post()
create(@Body() dto: CreateUserDto) {
  return this.users.create(dto);
}
```

**Why it survived review.**
TypeScript types disappear at runtime. A reviewer reading `@Body() dto: CreateUserDto` sees a typed parameter and pattern-matches "this is validated" — but compile-time shape and runtime enforcement are different claims. The subtler miss: even when the DTO carries `@IsEmail()` on `email`, nobody audits field-by-field for the bare `role: string` that lets a request body promote itself to admin. The TypeScript type is `string`; the allowed values are `['user', 'admin']` — and that constraint lives nowhere in the code.

**ESLint rules:** `nestjs-security/require-class-validator` + `nestjs-security/no-missing-validation-pipe`

**Fix:**

```ts
export class CreateUserDto {
  @IsEmail() email: string;
  @IsIn(["user", "admin"]) role: string;
}

@Post()
@UsePipes(new ValidationPipe({ whitelist: true }))
create(@Body() dto: CreateUserDto) {
  return this.users.create(dto);
}
```

---

## Finding 3: Entity returned directly — `no-exposed-private-fields` (CWE-200, CVSS 7.5)

**Vulnerable code:**

```ts
@Get()
findAll(): Promise<User[]> {
  return this.users.findAll(); // returns the TypeORM entity directly
}
```

The `User` entity has a `passwordHash` column. That column is now in every `GET /users` response.

**Why it survived review.**
The return type is `User[]`. TypeScript shows no errors. The reviewer sees typed, structured data and approves. What they never see is the JSON shape at runtime — they're reading code, not running `curl` against staging. `@Exclude()` only means anything inside Nest's response lifecycle, which the diff doesn't show, and the TypeORM entity is never a safe response shape unless you've consciously mapped it.

**ESLint rule:** `nestjs-security/no-exposed-private-fields`

**Fix:** Map to a response DTO, or apply `ClassSerializerInterceptor` with `@Exclude()` on sensitive fields:

```ts
@Get()
findAll(): Promise<UserResponseDto[]> {
  return this.users.findAll().then(users => users.map(u => plainToInstance(UserResponseDto, u)));
}
```

---

## Finding 4: Unthrottled login — `require-throttler` (CWE-770, CVSS 7.5)

**Vulnerable code:**

```ts
@Post("login")
login(@Body() dto: LoginDto) {
  return this.auth.login(dto.email, dto.password);
}
```

No `@Throttle`. No rate limiting. A brute-force loop can hit this indefinitely.

**Why it survived review.**
Rate limiting reads as an infra concern — "nginx handles it," or "the load balancer has WAF rules." Its absence in application code never gets flagged, because reviewers don't expect to see it here. In practice, application-layer throttling and infra-layer throttling are separate controls; NestJS gives you `ThrottlerGuard` precisely because you can't assume the infra layer is configured for every route.

**ESLint rule:** `nestjs-security/require-throttler`

**Prerequisite — `ThrottlerModule` setup:**

```ts
// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

**Fix with per-route override:**

```ts
@Throttle({ default: { limit: 5, ttl: 60000 } })
@Post("login")
login(@Body() dto: LoginDto) {
  return this.auth.login(dto.email, dto.password);
}
```

---

## Here's the guard that catches all of this in CI

Install:

```bash
npm install --save-dev eslint-plugin-nestjs-security
# yarn add --dev / pnpm add --save-dev / bun add --dev
```

Flat config (`eslint.config.mjs`):

```js
import { configs } from "eslint-plugin-nestjs-security";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts"],
    languageOptions: { parser: tsParser, parserOptions: { sourceType: "module" } },
  },
  configs.recommended, // all 6 rules, sensible severities
  // configs.strict,      // all 6 as errors
  // configs.guards,      // just require-guards
  // configs.validation,  // the two input-validation rules
];
```

Four presets: `recommended`, `strict`, `guards`, `validation`. All rules are AST-based — they read your decorators, no Nest runtime required. ESLint `8 || 9 || 10`, Node `>= 18`.

Run `npx eslint "src/**/*.ts"` against the four vulnerable patterns above and this is what you get:

```text
src/users.controller.ts
   2:3   warning  🔒 CWE-20 OWASP:A03-Injection CVSS:7.5 | DTO property "email" lacks class-validator decorators | MEDIUM      nestjs-security/require-class-validator
   3:3   warning  🔒 CWE-20 OWASP:A03-Injection CVSS:7.5 | DTO property "password" lacks class-validator decorators | MEDIUM   nestjs-security/require-class-validator
   3:3   warning  🔒 CWE-200 OWASP:A01-Broken CVSS:7.5 | Sensitive field "password" may be exposed in API responses | HIGH     nestjs-security/no-exposed-private-fields
   4:3   warning  🔒 CWE-20 OWASP:A03-Injection CVSS:7.5 | DTO property "role" lacks class-validator decorators | MEDIUM       nestjs-security/require-class-validator
  11:3   error    🔒 CWE-284 OWASP:A01-Broken CVSS:9.8 | Controller/route handler findAll lacks @UseGuards for access control | CRITICAL    nestjs-security/require-guards
  11:3   warning  🔒 CWE-770 CVSS:7.5 | Controller findAll lacks rate limiting protection (Throttler) | HIGH                   nestjs-security/require-throttler
  12:3   error    🔒 CWE-284 OWASP:A01-Broken CVSS:9.8 | Controller/route handler create lacks @UseGuards for access control | CRITICAL     nestjs-security/require-guards
  12:3   warning  🔒 CWE-770 CVSS:7.5 | Controller create lacks rate limiting protection (Throttler) | HIGH                    nestjs-security/require-throttler
  12:26  warning  🔒 CWE-20 OWASP:A06-Insecure CVSS:8.6 | Parameter @Body() dto receives user input without ValidationPipe | HIGH    nestjs-security/no-missing-validation-pipe
  13:3   error    🔒 CWE-284 OWASP:A01-Broken CVSS:9.8 | Controller/route handler login lacks @UseGuards for access control | CRITICAL      nestjs-security/require-guards
  13:3   warning  🔒 CWE-770 CVSS:7.5 | Controller login lacks rate limiting protection (Throttler) | HIGH                     nestjs-security/require-throttler
  13:32  warning  🔒 CWE-20 OWASP:A06-Insecure CVSS:8.6 | Parameter @Body() dto receives user input without ValidationPipe | HIGH    nestjs-security/no-missing-validation-pipe
  14:3   error    🔒 CWE-284 OWASP:A01-Broken CVSS:9.8 | Controller/route handler remove lacks @UseGuards for access control | CRITICAL     nestjs-security/require-guards
  14:3   warning  🔒 CWE-770 CVSS:7.5 | Controller remove lacks rate limiting protection (Throttler) | HIGH                    nestjs-security/require-throttler

✖ 14 problems (4 errors, 10 warnings)
```

14 findings, 4 of them CWE-284 errors. Five of the six rules fired on code that passed `tsc`. The sixth (`no-exposed-debug-endpoints`, CWE-489) stays quiet unless the controller has a debug or health-check route that leaks internals in production — fire one up and it fires too.

---

## The full 6-rule map

| Rule                         | Catches                                     | CWE     |
| ---------------------------- | ------------------------------------------- | ------- |
| `require-guards`             | Controller/handler with no `@UseGuards`     | CWE-284 |
| `require-class-validator`    | DTO property with no validation decorator   | CWE-20  |
| `no-missing-validation-pipe` | `@Body()` consumed with no `ValidationPipe` | CWE-20  |
| `no-exposed-private-fields`  | Entity/private field returned to the client | CWE-200 |
| `require-throttler`          | Public route with no rate limiting          | CWE-770 |
| `no-exposed-debug-endpoints` | Debug endpoint reachable in prod            | CWE-489 |

---

## What the rules see — and don't

- **Decorator presence, not policy correctness.** `require-guards` proves a `@UseGuards` exists; it can't prove your `RolesGuard` checks the right role. `requiredGuards: ["AuthGuard"]` lets you insist on a named guard so a stray `@UseGuards(LoggingGuard)` doesn't count as auth.
- **Tell it about global wiring.** A global `APP_GUARD` or a global `ValidationPipe` is invisible to per-file analysis — set `assumeGlobalGuards: true` so the linter matches your architecture instead of flagging it.

---

## Related reading

These same six rules applied to real codebases, with full output:

- [Claude wrote a NestJS service. ESLint found 6 security holes.](https://dev.to/ofri-peretz/claude-wrote-a-nestjs-service-typescript-was-happy-eslint-found-6-security-holes-51nj) — the AI-generated controller case, verbatim
- [The 30-minute security audit: a static-analysis protocol for onboarding](https://dev.to/ofri-peretz/the-30-minute-security-audit-onboarding-a-new-codebase-4f91) — applying the same scan-first approach to a whole codebase

---

Run `configs.recommended` against a NestJS service today — yours, or the last one an AI generated for you. **Which NestJS security gap has surprised you most in a real codebase?** I'd like to know in the comments.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if any of the six would fire on a controller you have in prod right now.
::

---

*[eslint-plugin-nestjs-security](https://www.npmjs.com/package/eslint-plugin-nestjs-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)*
