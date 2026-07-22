---
title: "Claude Wrote a NestJS Service. TypeScript Was Happy. ESLint Found 6 Security Holes."
description: "I gave Claude one prompt and got 200 lines of correct NestJS. TypeScript compiled clean. Then I ran eslint-plugin-nestjs-security. 6 errors, 3 seconds. Here is what it found and why each one is an AI failure mode."
slug: "claude-wrote-nestjs-service-eslint-found-6-security-holes"
canonical_url: "https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes"
tier: "T3"
devto_url: "https://dev.to/ofri-peretz/claude-wrote-a-nestjs-service-typescript-was-happy-eslint-found-6-security-holes-51nj"
devto_id: 3775020
published_at: "2026-05-29"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/vy002e9l20wx9h7nutzq.png"
social_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/vy002e9l20wx9h7nutzq.png"
reading_time_minutes: 10
tags:
  - "ai"
  - "security"
  - "nestjs"
  - "eslint"
reactions: 0
comments: 0
views: 0
series: "AI Security Benchmark Series"
author:
---

TypeScript said this NestJS service was clean. ESLint found 6 security holes in 3 seconds.

I gave Claude Sonnet 4.6 one prompt — _"Build a NestJS users service. Authentication, registration, login, profile endpoint, admin panel."_ — and 90 seconds later I had 200 lines of NestJS. Decorators in the right places, DTOs typed correctly, dependency injection wired. It looked like code written by a developer who knew NestJS.

Then static analysis flagged six findings the compiler could not: an admin endpoint with no access-control guard ([CWE-284](https://ofriperetz.dev/articles/cwe-taxonomy-explained)), a login route with no rate limit (CWE-770), an entity shipping `password` in every response (CWE-200), a `@Body()` parameter with no runtime validation (CWE-20), a privilege-bearing DTO field with no constraint (CWE-915), and a debug route returning `DATABASE_URL` (CWE-489).

TypeScript: ✅ Clean. Runtime: ✅ Would work. One of the six was a debug route silently serializing the database connection string in plaintext — the kind of finding that looks like a toy example until Finding 6, below, where I've seen the exact same pattern outside a demo.

> Looking at this output with no context from the generation session: 6 of these findings would have passed my own code review. The linter caught all 6 in 3 seconds.

Every one of them is the _absence_ of something — a guard, a pipe, a decorator, an environment check. None of them is a thing the model got wrong; each is a constraint the prompt never stated. That is the failure class this article is about.

The tool that caught these is [`eslint-plugin-nestjs-security`](https://www.npmjs.com/package/eslint-plugin-nestjs-security), a plugin I built to flag exactly this negative space. Full rule reference at [eslint.interlace.tools/docs/security/plugin-nestjs-security →](https://eslint.interlace.tools/docs/security/plugin-nestjs-security). If you want to run it against your own AI-generated controllers before reading further, it's one install — [full config is below](#the-config):

[![npm](https://img.shields.io/npm/v/eslint-plugin-nestjs-security)](https://www.npmjs.com/package/eslint-plugin-nestjs-security)

```bash
npm install --save-dev eslint-plugin-nestjs-security
```

---

## What Claude generated

Claude generated a 200-line, TypeScript-clean NestJS users service from a single prompt — no security requirements included. Here is the output. The prompt was intentionally minimal: no security requirements, just functionality. This is how most developers prompt AI assistants — describe what the code should _do_, not what it should _prevent_.

```typescript
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post("register")
  async register(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Post("login")
  async login(@Body() dto: LoginDto) {
    return this.usersService.login(dto);
  }

  @Get("profile/:id")
  async getProfile(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Get("admin/users")
  async listAllUsers() {
    return this.usersService.findAll();
  }

  @Get("debug/config")
  async getConfig() {
    return { env: process.env.NODE_ENV, db: process.env.DATABASE_URL };
  }
}
```

Claude also generated the entity and DTOs referenced below — all from the same single prompt.

Each finding follows the same structure: what ESLint caught, why AI generates this pattern, and why it survives code review. The second question is the one worth sitting with.

---

## Finding 1: No auth guards (CWE-284)

[`nestjs-security/require-guards`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/require-guards)

```text
🔒 CWE-284 OWASP:A01-Broken CVSS:9.8 | Controller/route handler listAllUsers lacks @UseGuards for access control | CRITICAL
   Fix: Add @UseGuards(AuthGuard): @UseGuards(AuthGuard) before the handler | https://docs.nestjs.com/guards
  /src/users/users.controller.ts  nestjs-security/require-guards
```

`GET /users/admin/users` returns every user in the database. No authentication required. The rule walks each route handler in the controller and reports the unguarded method by name — here, `listAllUsers`.

**Why AI generates this:** Authorization is a _constraint_, not a feature. AI models optimize for completing described behavior, not for restrictions the prompt didn't mention. "List all users" is a valid feature. "Only admins can list users" is a negation of default behavior that requires explicit intent. Claude Sonnet 4.6 fulfilled exactly what it was asked.

**Why it survives review:** Reviewers know the team has `JwtAuthGuard` registered — or think they do. The guard is off the mental stack when reading route logic. Nobody scans a controller and asks "is there a guard here?" They ask "does the logic look right?" So would anyone on your team reviewing typed DTOs returning from a named service.

**On the [CVSS 9.8](https://ofriperetz.dev/articles/cvss-scores-explained):** that's `require-guards`'s fixed class severity, not a per-handler score — a missing guard could front a read, a write, or an admin action, and the rule can't tell which from the AST alone. This example is realistically closer to a 7.5 read-only exposure; don't cite the 9.8 to a security team as if it were per-handler.

**A note on scope:** the rule flags every handler lacking `@UseGuards` (or a `@Public()`/`@SkipAuth()`-style opt-out), with no built-in exception for auth entry points — `login` and `register` above are correctly unguarded (no prior session to check yet), so their fix is `@Public()`, not `@UseGuards()`. If your app relies on `app.useGlobalGuards()` in `main.ts` instead of per-route decorators, set `assumeGlobalGuards: true`.

> Blind spot: guards registered via `APP_GUARD` providers or inherited from a base controller aren't visible to the rule either — it can stay silent on a route that's actually protected, the mirror image of the [false positives](https://ofriperetz.dev/articles/confusion-matrix-tp-fp-fn-tn) above.

```typescript
// The rule reports the offending route handler, but is satisfied by @UseGuards at
// either class or method level. Method-level is correct here — this controller also
// handles unauthenticated routes (login, register). Class-level would 401 them.
@Controller("users")
export class UsersController {
  @Post("login") // intentionally unauthenticated
  async login(@Body() dto: LoginDto) {
    /* ... */
  }

  @Get("admin/users")
  @UseGuards(JwtAuthGuard, RolesGuard) // satisfies require-guards; RolesGuard reads @Roles metadata
  @Roles("admin") // your own decorator: export const Roles = (...roles: string[]) => SetMetadata('roles', roles)
  async listAllUsers() {
    return this.usersService.findAll();
  }
}
```

See also: [the same missing-guard pattern in a 2-year-old production codebase, and why every PR approved it](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities).

---

## Finding 2: No rate limiting on auth endpoints (CWE-770)

[`nestjs-security/require-throttler`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/require-throttler)

```text
🔒 CWE-770 CVSS:7.5 | Controller login lacks rate limiting protection (Throttler) | HIGH
   Fix: Add @UseGuards(ThrottlerGuard) or configure global ThrottlerModule | https://docs.nestjs.com/security/rate-limiting
  /src/users/users.controller.ts  nestjs-security/require-throttler
```

An attacker can enumerate passwords against the login endpoint at full network speed. The rule tags this **CWE-770** (Allocation of Resources Without Limits or Throttling) — the missing control is a rate limit, full stop.

**Why AI generates this:** Brute-force protection is a _rate-at-which_ constraint, not a _what-does-it-do_ constraint — those never appear in feature prompts. "Build a login endpoint" describes a function, not a limit on how fast it can be called. Claude Sonnet 4.6 knows `@Throttle` exists; it will add it if you ask. The prompt didn't ask.

**Why it survives review:** Reviewers look at handler logic (correct), DTO types (correct), error handling (present). Rate limiting reads as an infra concern — the assumption is nginx handles it. Two sprints later, someone updates the route prefix. The nginx rule stops matching. Nobody cross-references the two PRs.

The fix requires two steps: registering the module in `AppModule` **and** applying the guard to the route. Without the module registration, `NestFactory.create()` throws `UnknownDependenciesException` at bootstrap — the app never starts, rather than failing per-request — because `ThrottlerGuard` can't resolve its module options from the DI container. One more thing this fix doesn't cover: `ThrottlerModule.forRoot`'s default storage is in-memory, which means it's **per-instance**. Behind a load balancer with more than one replica, each instance counts requests independently, so the effective limit is `limit × replica count` — with the `limit: 10` configured below and 3 replicas, an attacker who rotates across instances gets 30 login attempts per window, not 10. For a real deployment, back the throttler with shared storage — `ThrottlerStorageRedisService` from the community `@nest-lab/throttler-storage-redis` package is the common choice.

```typescript
// app.module.ts — register ThrottlerModule FIRST or the app fails to boot
import { ThrottlerModule } from "@nestjs/throttler";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    // ... your other imports
  ],
})
export class AppModule {}
```

```typescript
// requires @nestjs/throttler@^5 — ttl is in milliseconds (v4 and earlier used seconds)
// route-level @Throttle overrides the module-level default (10) for this handler only —
// login gets the tighter limit (5), other routes keep the module's 10
@Post('login')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 5, ttl: 60000 } }) // 60 seconds
async login(@Body() dto: LoginDto) {
  return this.usersService.login(dto);
}
```

---

## Finding 3: Sensitive fields in API responses (CWE-200)

[`nestjs-security/no-exposed-private-fields`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/no-exposed-private-fields)

```text
nestjs-security/no-exposed-private-fields
Property 'password' in User entity not excluded from serialization
  /src/users/user.entity.ts:8:3
```

Every API response from this service included `password` in the JSON body. Not _could_ include under certain conditions. Every single response. This is the one finding I've never seen miss — I've yet to run this against an AI-generated NestJS service where it doesn't fire.

```typescript
@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() email: string;
  @Column() password: string; // hashed — still in every API response
}
```

**Why AI generates this:** AI models the entity as a data structure, not as a serialization contract. `@Exclude()` from `class-transformer` is only meaningful within NestJS's HTTP response lifecycle — invisible to a model focused on making the class definition correct.

**Why it survives review:** The entity type is `User`. The controller returns `User`. TypeScript shows no errors. Reviewers see typed, structured data. What they don't see is the JSON shape at runtime, because they're reading code, not running `curl` against staging. I would have approved this — the type system looked correct because it was.

```typescript
import { Exclude } from "class-transformer";

@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() email: string;

  @Column()
  @Exclude()
  password: string; // same rule catches any other secret-bearing column you add later
}
```

> **Two implementation approaches:** `@Exclude()` on entities (shown here) vs. dedicated response DTOs that only expose what you intend. The DTO approach is architecturally cleaner — returning entity classes from controllers is the smell; the decorator is the patch. Either way, register the interceptor or `@Exclude()` does nothing:
>
> ```typescript
> app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
> ```
>
> One scope note: `@Exclude()` only strips the field during `ClassSerializerInterceptor`'s HTTP serialization step. It does nothing to your repository reads — `usersService.login()` still needs the hashed `password` back from `findOne()` to compare against, and it gets it, because that read never goes through the interceptor. The decorator protects the response boundary, not the query.
>
> `@Exclude()` also has a durability problem: it's opt-out. Add a `stripeCustomerId` or `resetToken` column six months from now and it ships exposed by default until someone remembers to decorate it. Flip the default with `new ClassSerializerInterceptor(app.get(Reflector), { excludeExtraneousValues: true })` and switch to `@Expose()` on the fields you _do_ want returned — now new columns are hidden until named. More upfront annotation, but the failure mode moves from silent leak to broken response, which is the direction you want a mistake to fail in.

---

## Finding 4: No runtime input validation (CWE-20)

[`nestjs-security/no-missing-validation-pipe`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/no-missing-validation-pipe)

```text
nestjs-security/no-missing-validation-pipe
@Body() parameter 'dto' in 'register' lacks ValidationPipe — runtime types not enforced
  /src/users/users.controller.ts:6:20
```

Claude generated typed DTOs. TypeScript enforces the shape at compile time. At runtime — without a `ValidationPipe` — those types don't exist. Any JSON shape passes through.

**Why AI generates this:** TypeScript types are erased at compile time — there's no runtime trace of them at all, so the type-checker's guarantee ends the moment `tsc` finishes. NestJS closes that gap with `class-validator` decorators (`@IsEmail()`, `@IsString()`, etc.) evaluated by `ValidationPipe` at request time — a separate, decorator-driven check, not the TS type system somehow persisting. Claude generates correct TypeScript; it doesn't reach for the separate runtime-validation layer unless the prompt asks for it.

**Why it survives review:** The DTO is typed. The parameter is typed. TypeScript shows no errors. Nobody checks whether `app.useGlobalPipes(new ValidationPipe())` actually made it into `main.ts` — that's a one-line, easy-to-miss wiring step in a different file from the DTO the reviewer is looking at.

```typescript
// In main.ts — global is recommended over per-parameter
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // strip properties with no class-validator decorator
    forbidNonWhitelisted: true, // throw on unexpected properties
    transform: true, // coerce to class instances; without this, instanceof checks fail
  }),
);
```

> **The hole no linter catches — and the most important paragraph in this article:** Claude also omits `@ValidateNested()` + `@Type(() => NestedDto)` on nested DTO objects. Without them, nested objects skip validation entirely — the class-validator decorators on the nested class are ignored at runtime. This is the single most frequent `ValidationPipe` hole I see in AI-generated NestJS code, and it has **no ESLint error**: TypeScript compiles, the pipe is registered, validation _appears_ to run, and the nested object passes through unchecked. Static analysis can flag the missing pipe (Finding 4) and the missing decorator (Finding 5); it cannot yet prove that a present decorator actually recurses. The lint gate narrows the gap — it does not close it, and pretending otherwise is how the nested hole survives. If you read one fix in this piece twice, make it this one.
>
> Until a rule exists for this, the working mitigation is a test, not a lint pass: write one integration test per DTO with a nested object, submit garbage inside the nested field (`{ profile: { age: 'not-a-number' } }`), and assert on the 400. If it passes with a 200 instead, `@ValidateNested()` is missing. Grep for nested class properties without `@ValidateNested()` in the meantime — it's a five-minute manual audit that catches what the pipe can't yet prove.

---

## Finding 5: DTO fields without enum constraints (CWE-915)

[`nestjs-security/require-class-validator`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/require-class-validator)

The `role` field in `CreateUserDto` has no class-validator decorator, which means a caller can submit any string value — including `role: 'admin'` — and nothing at the validation layer rejects it.

```text
nestjs-security/require-class-validator
Property 'role' in CreateUserDto has no class-validator decorator
  /src/users/dto/create-user.dto.ts:5:3
```

```typescript
export class CreateUserDto {
  @IsEmail()
  email: string;

  role: string; // no validator
}
```

This is analogous to mass assignment — CWE-915 (Improperly Controlled Modification of Dynamically-Determined Object Attributes) is the classic Rails/Python framing, where attributes are resolved dynamically at runtime; a statically-typed TypeScript DTO isn't a perfect fit for "dynamically-determined," so treat this as the closest CWE, with CWE-269 (Improper Privilege Management) as the TypeScript-native alternative. Either way, a caller can pass `role: 'admin'` and, depending on how the service layer maps the DTO to the entity, escalate their own privilege. The distinction from Finding 4 matters: Finding 4 is about missing runtime enforcement; Finding 5 is about missing value constraints that survive runtime enforcement.

With `whitelist: true` alone, an undecorated `role` field is silently stripped. Add `forbidNonWhitelisted: true` (as the Finding 4 config above does) and it stops being silent — Nest throws a 400 on the unrecognized `role` key instead. Either way, this isn't the fix, for a specific reason: **developers add decorators later**. The day someone adds `@IsString()` to `role` so it clears the whitelist and stops 400ing (a natural, well-intentioned refactor), `role: 'admin'` becomes a valid, accepted payload. `@IsString()` satisfies the pipe; it doesn't constrain the value — only `@IsEnum(SelfAssignableRole)` does.

This is the one finding of the six I'd flag as hardest to catch by eye: Claude adds validation for fields where the constraint is obvious from the semantic type (`email` → `@IsEmail()`), but `role` has no tutorial default — valid values are a domain-specific enum the model can't infer from an unspecified domain. And it doesn't fail loud in review. Reviewers see `@IsEmail()` on `email` and pattern-match "this DTO is validated"; nobody audits field by field for the one bare property, especially when `role` arrives as a quick patch after the initial commit and nobody circles back.

**Findings 4 and 5 are coupled:** `whitelist`/`forbidNonWhitelisted` police unknown _keys_ — strip or reject them. Neither constrains _values_ on keys that are already known and decorated. You need both: the pipe (Finding 4) and enum decorators (Finding 5). Either without the other leaves a privilege escalation path — the pipe alone just changes whether that path fails loud (400) or silent (dropped field) today, and reopens the moment `role` gets any decorator that isn't `@IsEnum`.

```typescript
import { IsEmail, IsString, MaxLength, IsEnum } from "class-validator";

// Separate from UserRole — admin is not self-assignable at registration.
// Using UserRole here would allow role: 'admin' since it's a valid member.
enum SelfAssignableRole {
  user = "user",
  moderator = "moderator",
  // admin intentionally absent
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(SelfAssignableRole) // rejects 'admin' — not because it's unknown, but because it's not in this enum
  role: SelfAssignableRole;
}
```

---

## Finding 6: Debug endpoint exposing credentials (CWE-489)

[`nestjs-security/no-exposed-debug-endpoints`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/no-exposed-debug-endpoints)

The `debug/config` route returns `process.env.DATABASE_URL` directly in the response body — an unauthenticated request discloses the full database connection string, credentials included.

```text
nestjs-security/no-exposed-debug-endpoints
Controller path 'debug/config' returns process.env — information disclosure
  /src/users/users.controller.ts
```

```typescript
@Get('debug/config')
async getConfig() {
  return { env: process.env.NODE_ENV, db: process.env.DATABASE_URL };
}
```

One `curl` to `/users/debug/config`. Your `DATABASE_URL` — hostname, port, username, password — serialized as JSON, no authentication. I found this exact pattern live in a staging environment in under 60 seconds, running the same plugin against a client's repo during an onboarding audit — not a pentest, not a scan they'd scheduled. It had been live for four months. The blast radius was contained to a staging replica with no production data, which is the only reason this is a story and not an incident report.

The rule reports this as CWE-489 (Active Debug Code) — the endpoint itself shouldn't ship. It's worth also naming CWE-215 (Insertion of Sensitive Information Into Debugging Code), since Finding 3 already owns CWE-200 for the entity-level leak: this is the same class of mistake — secrets reachable through a code path meant for developers, not requests — just triggered by a route instead of a serializer.

**Why AI generates this:** Claude added this as a diagnostic helper. It's genuinely useful during development. AI generates code for the specification given to it and has no concept of a production boundary. "Useful during development" and "never deploy this" are the same to a model that doesn't model deployment environments.

**Why it survives review:** Debug endpoints arrive via two routes: AI generates them unguarded (this case), or a developer adds one temporarily and forgets to remove it. Either way, review approves it for a mundane reason, not a careless one — nobody ran `curl` against the deployed route before sign-off. Review verifies the diff; it rarely verifies the running service. The four-month staging case above fits this exactly: the code was correct enough to pass a read, and nobody executed the one request that would have caught it. The linter doesn't need to execute anything. It sees `process.env` in a response and fires.

> **Guarding is not a fix.** A guarded endpoint returning `DATABASE_URL` is still a credential leak waiting for a token to be compromised. Remove the sensitive values from the response entirely.

A `DATABASE_URL` leaked through a live route is one path to the same outcome as a `sk_live_` key committed straight into source — the secret ends up somewhere a scanner or a curious visitor can find it. If hardcoded credentials are more your team's failure mode than exposed routes, [the language-level version of this same problem — 28 CWE-mapped rules for hardcoded secrets, unsafe deserialization, and injection classes](https://ofriperetz.dev/articles/getting-started-eslint-plugin-secure-coding) — is the sibling plugin for it.

```typescript
// Fix: environment-gated module — never conditionally guard a live endpoint
// In app.module.ts:
@Module({
  imports: [...(process.env.NODE_ENV !== "production" ? [DebugModule] : [])],
})
export class AppModule {}

// In debug.controller.ts — AdminGuard is your own CanActivate checking req.user.role === 'admin'
@Controller("debug")
@UseGuards(JwtAuthGuard, AdminGuard)
export class DebugController {
  @Get("config")
  getConfig() {
    return { env: process.env.NODE_ENV }; // never return DATABASE_URL
  }
}

// In debug.module.ts — the module itself is completely absent in production builds
@Module({ controllers: [DebugController] })
export class DebugModule {}
```

---

## The pattern: AI optimizes for compilation, not for absence

All six findings share a root cause: **the AI fulfilled the prompt, and the prompt didn't specify a security constraint.**

TypeScript can't catch any of these. They compile, run, and do exactly what the code says. What's missing in each case isn't behavior — it's the _absence_ of something: a decorator, a pipe, a guard, an enum constraint, an environment check. Call it the **negative-space failure class**: a bug you can't diff against working code, because the code works. There's no wrong line to point at — only a missing one.

The question that surfaces all six: _"What happens when someone who isn't supposed to use this endpoint tries?"_ That's a negative-space question. AI doesn't ask it unless you do. Code reviewers often don't either — we're trained to verify correctness, not the absence of unauthorized access.

One caveat on the number itself: "6 findings" spans the controller, the entity, and a DTO — not 6 findings across 5 endpoints. Findings 3 and 5 are scoped to the `User` entity and `CreateUserDto`, not to a single route, so the honest framing is 6 findings across the service, not a per-endpoint rate. It's also one generation pass, not a sampled average — run the same prompt again and the count will move. What won't move is the failure _class_: the missing-guard pattern reappears on a retry, just attached to a different endpoint.

Static analysis asks the negative-space question on every file, every run — and a domain-specific plugin asks a sharper version of it than a general one does: [the general-purpose ESLint security floor caught 0 of 40 vulnerabilities](https://ofriperetz.dev/articles/benchmark-17-eslint-security-plugins-compared) that a NestJS-aware ruleset like this one is built to see. [The Hydra Problem](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more) shows what happens when you try to fix AI omissions one at a time in review: fixing one surfaces others. This run's count isn't what matters — what matters is that the same missing-guard pattern shows up [across every security domain we've benchmarked](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain). NestJS is no exception.

### The count moves by toolchain. The failure class doesn't.

The natural objection: maybe six is a Claude-specific weakness, and another toolchain gets it right. The count _does_ move with the toolchain — but the root cause doesn't. These aren't bugs the model got wrong; they're constraints the prompt never stated. Change assistants and the count changes; the negative-space class survives. That's also the finding of [a broader leaderboard comparing 5 AI models on security](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong): rank one model above another and you're still measuring which constraints it happened to infer, not which ones it was told.

I ran the identical prompt through Gemini 2.5 Flash via the Gemini CLI and scanned the output with the same plugin: [Same NestJS Prompt. Claude Got 6 Errors. Gemini Got 2.](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors) Gemini's default scaffolding was structurally tighter — it got guards, validators, and serialization right where Claude didn't. But both toolchains shipped the same Finding 2: **no rate limiting on the login endpoint.** The one class that survived the model swap is the one neither prompt thought to constrain. Zoomed out across four security domains — not just NestJS — [the pattern holds at a larger sample too](https://dev.to/ofri-peretz/claude-vs-gemini-across-4-security-domains-a-dead-heat-and-the-hardening-63-of-ai-code-skips-mpp): the two models trade wins domain by domain, but converge on skipping the same hardening step.

You can verify the whole thing yourself in three steps:

1. Paste the same prompt — _"Build a NestJS users service. Authentication, registration, login, profile endpoint, admin panel."_ — into whatever assistant you use (Claude, Gemini, GPT-4, Copilot).
2. Run the [config below](#the-config) on the output.
3. Count the findings by _class_, not by line. The total drifts by toolchain; the rate-limit, missing-guard, and exposed-`password` classes keep recurring. The rules read the decorator tree, not the git blame. Expect at minimum: a `require-throttler` hit on `login`, a `require-guards` hit on whatever route lists all resource records, and a `no-exposed-private-fields` hit on any entity with a `password` or token column — those three classes are the ones that survived every assistant I've run this against.

---

## The config

This is the full flat-config setup for `eslint-plugin-nestjs-security` — copy it into `eslint.config.mjs` to run all six rules from this article against your own NestJS code.

```javascript
// eslint.config.mjs
import nestjsSecurity from "eslint-plugin-nestjs-security";

export default [
  {
    plugins: { "nestjs-security": nestjsSecurity },
    rules: {
      "nestjs-security/require-guards": [
        "error",
        { assumeGlobalGuards: false },
      ],
      "nestjs-security/no-exposed-private-fields": "error",
      "nestjs-security/require-throttler": "error",
      "nestjs-security/no-missing-validation-pipe": "error",
      "nestjs-security/require-class-validator": "error",
      "nestjs-security/no-exposed-debug-endpoints": "error",
    },
  },
];
```

```bash
npm install --save-dev eslint-plugin-nestjs-security
```

> **Note:** NestJS is always TypeScript. Add these rules to your existing `typescript-eslint` configuration — the config above assumes `languageOptions.parser` and `languageOptions.parserOptions.project` are already set (both live under `languageOptions` in flat config). Running `eslint src/` without the TS parser will fail on decorators.

Full rule documentation at [eslint.interlace.tools/docs/security/plugin-nestjs-security](https://eslint.interlace.tools/docs/security/plugin-nestjs-security). New to the plugin? [Architectural Security: The NestJS Static Analysis Standard](https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-nestjs-security-32ic) covers the full rule set end to end.

{% cta https://github.com/ofri-peretz/eslint %}
⭐ Star on GitHub
{% endcta %}

---

_Which of these six shipped in your codebase — and how long was it live before anyone noticed?_

---

_Part of the [AI Security Benchmark Series](https://dev.to/ofri-peretz/series/35564):_
_← [I Let Claude Write 60 Functions. 65-75% Had Security Vulnerabilities.](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) | **Claude Wrote a NestJS Service (you are here)** | [Same Prompt, Gemini →](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors) | [Aggregate Benchmarks Lie →](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain)_

---

_[eslint-plugin-nestjs-security](https://www.npmjs.com/package/eslint-plugin-nestjs-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz) · [ofriperetz.dev](https://ofriperetz.dev) · [npm/~ofri-peretz](https://www.npmjs.com/~ofri-peretz)_
