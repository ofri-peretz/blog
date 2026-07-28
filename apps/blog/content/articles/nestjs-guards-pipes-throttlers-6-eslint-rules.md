---
title: "You Can't Review a Decorator That Isn't There — 6 ESLint Rules for NestJS Security"
description: "Missing @UseGuards, unvalidated @Body(), entities leaking passwordHash — NestJS security lives in decorators, and an absent decorator produces no diff. 6 CWE-mapped ESLint rules that catch all of it in CI: vulnerable code, why review missed it, the fix, and the real lint output."
slug: "nestjs-guards-pipes-throttlers-6-eslint-rules"
canonical_url: "https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules"
tier: "TOPIC"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-nestjs-security-32ic"
devto_id: 3144090
published_at: "2026-01-02T19:28:48Z"
edited_at: "2026-07-28T00:00:00Z"
cover_image: "https://ofriperetz.dev/og/cover/nestjs-guards-pipes-throttlers-6-eslint-rules"
social_image: "https://ofriperetz.dev/og/article/nestjs-guards-pipes-throttlers-6-eslint-rules"
reading_time_minutes: 12
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

> **NestJS hands you every security primitive you need. The bugs hide in the decorators nobody added — and an absent decorator produces no diff.**

I approved a NestJS controller with `@Delete(":id")` on an `admin` route and no `@UseGuards` anywhere above it. The handler was five lines and all five were correct. It deleted users perfectly — for anyone who could reach the URL.

The same file had a `@Body()` with no `ValidationPipe`, and a `findAll()` returning the TypeORM entity — `passwordHash` column included — straight to the client. Three access-control and data-exposure bugs in one controller, and I read every line of it. The code compiled, the tests passed, and it looked like a senior wrote it, because a senior did.

I also wrote the ESLint rules that catch this exact shape, and I still approved the PR. Which is the whole point: in NestJS, authorization, validation, serialization and rate limiting are all decorators, review is a diff-reading activity, and a decorator nobody wrote never shows up in a diff. A linter doesn't read diffs — it walks the tree, asks "where is the guard on this handler", and gets an answer either way.

Four vulnerability patterns below, five of the six rules firing on them (the sixth waits for a debug route). For each: the vulnerable code, why it survived review, and the rule that catches it in the lint pass you already run. The [CWE](https://ofriperetz.dev/articles/cwe-taxonomy-explained) class and [CVSS](https://ofriperetz.dev/articles/cvss-scores-explained) score in each heading aren't editorial — they're the rule's own metadata, the same strings it prints in CI.

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
Nobody scans a controller and asks "is there a guard on this handler?" — they ask "does the logic look right?" The handler body is correct, the service call is named well, TypeScript is green. The team has a `JwtAuthGuard` registered _somewhere_, and reviewers assume it covers this route. It doesn't. `@UseGuards` is opt-in per controller and per handler, which means the decorator you didn't write is the one that left `DELETE /admin/:id` open to the internet.

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

Two escape hatches, both first-class so nobody reaches for `eslint-disable`: `assumeGlobalGuards: true` when you register a guard globally (`APP_GUARD` provider or `app.useGlobalGuards(...)`), and `@Public()` on a handler you meant to leave open (`@SkipAuth()`, `@AllowAnonymous()` and `@NoAuth()` count too). A deliberately public route stays one honest decorator instead of a suppression comment nobody revisits.

---

## Finding 2: Unvalidated `@Body()` — `no-missing-validation-pipe` + `require-class-validator` (CWE-20, CVSS 7.5–8.6)

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
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
create(@Body() dto: CreateUserDto) {
  return this.users.create(dto);
}
```

`whitelist: true` strips properties that have no decorator; `forbidNonWhitelisted: true` rejects the request with a 400 instead of silently dropping them. Silent stripping is the setting that makes a privilege-escalation attempt look like a successful request in your logs.

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

The rule matches field names case-insensitively against a built-in list — `password`, `secret`, `token`, `apiKey`, `privateKey`, plus snake_case variants. Your domain has its own (`ssn`, `iban`, `internalNotes`): add them via `sensitivePatterns` so the rule speaks your vocabulary, not only mine.

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
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
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

Once `APP_GUARD` is wired as above, every route is throttled and the rule's job changes from "find the gap" to "stay out of the way": `assumeGlobalThrottler: true` silences it globally, `skipRoutes` exempts the handful of endpoints (health checks, webhooks) where a limit is the wrong control.

---

## Wiring the six rules into CI — one install, one config block

Install:

```bash
npm install --save-dev eslint-plugin-nestjs-security
# yarn add --dev / pnpm add --save-dev / bun add --dev
```

Flat config (`eslint.config.mjs`) — spread the preset into the TypeScript block so the rules only run where decorators can exist:

```js
import { configs } from "eslint-plugin-nestjs-security";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: "module" },
    },
    ...configs.recommended, // all 6 rules, sensible severities
    // ...configs.strict,     // all 6 as errors
    // ...configs.guards,     // just require-guards
    // ...configs.validation, // the two input-validation rules
  },
];
```

Four presets: `recommended`, `strict`, `guards`, `validation`. All rules are AST-based — they read your decorators, no Nest runtime and no type information required. ESLint `8 || 9 || 10`, Node `>= 18`, and no config beyond the block above.

Run `npx eslint "src/**/*.ts"` against the four vulnerable patterns above and this is what you get (plugin **v1.2.4** on ESLint **10**; every finding also prints a `Fix:` line, and the CWE-20 ones carry their compliance tags — both trimmed here for width):

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

14 findings, 4 of them [CWE-284](https://ofriperetz.dev/articles/cwe-taxonomy-explained) errors. Five of the six rules fired on code that passed `tsc`. The sixth (`no-exposed-debug-endpoints`, CWE-489) stays quiet unless the controller exposes a debug or health-check route that leaks internals in production — add one and it fires too.

The `OWASP:` tags are worth a second look, because that one block shows all three paths at once. A rule declares its CWE and the formatter derives the [OWASP Top 10](https://ofriperetz.dev/articles/owasp-top-10-explained) category from it — that's `require-guards`, CWE-284 becoming `A01`. But a rule can also hand-type its own `owasp`, and an explicit value wins over the derived one: `require-class-validator` carries a hand-typed `A03`, which is why it and `no-missing-validation-pipe` print two different categories off the same CWE-20. Then `require-throttler` prints no OWASP tag at all — CWE-770 has no entry in the mapping table and the rule doesn't hand-type one. Derivation is a fallback, not a guarantee, which is exactly the drift I went looking for when I [audited 203 of our own rules](https://ofriperetz.dev/articles/i-audited-203-of-our-own-eslint-security-rules-16-mislabel-their-own-cvss-score). Route your tickets on the CWE: it's the one field every rule declares for itself.

---

## The full 6-rule map

| Rule                         | Catches                                     | CWE     | In `recommended` |
| ---------------------------- | ------------------------------------------- | ------- | ---------------- |
| `require-guards`             | Controller/handler with no `@UseGuards`     | CWE-284 | error            |
| `no-exposed-debug-endpoints` | Debug endpoint reachable in prod            | CWE-489 | error            |
| `no-missing-validation-pipe` | `@Body()` consumed with no `ValidationPipe` | CWE-20  | warn             |
| `require-class-validator`    | DTO property with no validation decorator   | CWE-20  | warn             |
| `no-exposed-private-fields`  | Entity/private field returned to the client | CWE-200 | warn             |
| `require-throttler`          | Public route with no rate limiting          | CWE-770 | warn             |

Two errors, four warnings — deliberate. An unguarded route and a live debug endpoint are "stop the build" facts; the other four have legitimate architectures behind them (global pipes, a mapped response layer, a gateway that already throttles). `configs.strict` promotes all six once your codebase is clean enough to hold the line.

---

## What the rules see — and don't

- **Decorator presence, not policy correctness.** `require-guards` proves a `@UseGuards` exists; it can't prove your `RolesGuard` checks the right role. A guard that returns `true` unconditionally passes — a [false negative](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) I accept, because the alternative is a rule that pretends to understand your authorization model. `requiredGuards: ["AuthGuard"]` narrows the gap: a stray `@UseGuards(LoggingGuard)` then stops counting as auth.
- **No data-flow analysis.** The rules never follow a request body into your service layer and into a query — there's no [taint tracking](https://ofriperetz.dev/articles/taint-vs-heuristic-detection) here. This is [linting, not SAST](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting): a decorator-surface check inside the lint pass you already run, which is why it's fast enough for a pre-commit hook.
- **Tell it about global wiring.** A global `APP_GUARD` or `ValidationPipe` lives in a module the per-file analysis never opens, so every controller becomes a [false positive](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn). `assumeGlobalGuards`, `assumeGlobalPipes` and `assumeGlobalThrottler` buy the [precision](https://ofriperetz.dev/articles/precision-recall-f1-for-static-analysis) back. Just know what you bought: switching one on tells the linter to trust your wiring, so that global registration now needs a human on it — nothing else is checking.

---

## Where this goes next

The same six rules, pointed at real codebases instead of a demo file:

- **Read next:** [I inherited a NestJS codebase. The first lint run found 6 vulnerability classes.](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities) — 47 violations on a two-year-old service, broken down class by class. Start here if the four patterns above felt familiar.
- [Claude wrote a NestJS service. ESLint found 6 security holes.](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes) — the AI-generated controller case, verbatim
- [The 30-minute security audit: a static-analysis protocol for onboarding](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) — the scan-first approach applied to a whole codebase

---

None of these four bugs is hard. They're all absences — and an absence is the one thing a diff cannot show you. Move that check off the reviewer and onto the tree, and the whole class stops depending on how carefully anyone read the PR:

```bash
npm i -D eslint-plugin-nestjs-security
# add the eslint.config.mjs block above — spreading the preset is what registers the rules
npx eslint "src/**/*.ts"
```

Point it at one controller you own. With the preset actually spread into your config, a clean result is worth knowing; a finding arrives with its CWE and its fix on the same line. **Which of the six fired first for you?** I read every comment.

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub if any of the six would fire on a controller you have in prod right now.
::

---

_[eslint-plugin-nestjs-security](https://www.npmjs.com/package/eslint-plugin-nestjs-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
