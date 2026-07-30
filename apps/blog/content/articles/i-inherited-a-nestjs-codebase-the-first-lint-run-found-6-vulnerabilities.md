---
title: "I Inherited a NestJS Codebase. One 12-Second ESLint Run Found 47 Violations Across 6 Vulnerability Classes."
description: "The codebase had 2 years of feature PRs and zero security audits. A 12-second ESLint run surfaced 47 violations across 6 distinct vulnerability classes — auth bypass, sensitive field leaks, brute-force exposure, and three more. Here's what each one looks like, why experienced developers didn't catch it, and why your AI assistant writes the same six today."
slug: "i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities"
canonical_url: "https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities"
tier: "T3"
devto_url: "https://dev.to/ofri-peretz/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities-55ma"
devto_id: 3769186
published_at: "2026-05-28"
cover_image: "https://ofriperetz.dev/cdn/blog-cover-image/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities.jpg?v=b2"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities-og.jpg?v=b2"
reading_time_minutes: 8
tags:
  - "security"
  - "nestjs"
  - "eslint"
  - "devsecops"
reactions: 0
comments: 0
views: 0
series: "The Hardened Stack"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
---

I inherited a NestJS codebase where `/admin/users` had been returning the full user list to anyone who sent a well-formed-looking JWT — valid signature or not — for six months. Forging the shape of a token is a one-command job; this was unauthenticated in every way that mattered. Nobody knew. It was one of 47 violations my first ESLint run — 12 seconds — surfaced across 6 security vulnerability classes that had been in production for 2 years.

Not theoretical risks. Real violations: that admin controller with no auth guard, a `password` field serializing into every user response, a login route with no rate limit. A codebase that had passed CI on every commit. TypeScript strict mode. Two years of code reviews by engineers who cared. And 47 violations that none of it caught.

> **6 security vulnerability classes. 12 seconds. First lint run. The previous team had shipped these for 2 years without knowing.**

That number is why this ran on every inherited service after, on day one, before I read a single line of business logic.

Here's how the 47 broke down across 6 rule classes, on a 40K-line codebase with roughly 80 controllers and service classes — each rule name jumps to its walkthrough:

| Rule                                                     | CWE     |  Count |
| -------------------------------------------------------- | ------- | -----: |
| [`require-guards`](#unguarded-controllers)               | CWE-284 |     11 |
| [`no-exposed-private-fields`](#exposed-private-fields)   | CWE-200 |      9 |
| [`no-missing-validation-pipe`](#missing-validation-pipe) | CWE-20  |      8 |
| [`require-class-validator`](#missing-validators)         | CWE-20  |      7 |
| [`require-throttler`](#no-rate-limiting)                 | CWE-770 |      7 |
| [`no-exposed-debug-endpoints`](#debug-endpoints)         | CWE-489 |      5 |
| **Total** ([config](#the-config))                        |         | **47** |

> **[Reproducibility](https://ofriperetz.dev/articles/reproducibility-vs-replicability) (this run).** Plugin `eslint-plugin-nestjs-security@1.2.3` (published 2026-02-08 — the release current when this ran, ahead of this article's 2026-05-28 publish; as of 2026-07-19 no later patch has touched these six rules, so pin `@1.2.3` to reproduce this run exactly), all six rules at `error` ([config below](#the-config)). Scanned with `npx eslint "src/**/*.ts"` on the inherited service (~40K lines, 2 years of feature PRs, zero prior security passes). The 12-second figure is wall-clock on a single cold run, M2 / Node 20. Counts are from this one codebase — yours will differ, but the _class distribution_ (guards and validation dominate, debug routes are rare-but-fatal) is the part that holds across the NestJS services I've audited. And a disclosure, because you should be asking: I maintain the plugin. Which is exactly why this block exists — don't take my count, rerun it.

> **MTTR estimate:** Finding all 47 of these manually — reading every controller for missing guards, every entity for unexcluded fields, every DTO for missing validators — would have taken an experienced engineer 3–5 hours of focused audit work, assuming they knew exactly what to look for. ESLint found them in 12 seconds on a cold run. That gap is why lint — not a manual read — is the only realistic first pass on day one, before you've read the business logic.

If you just inherited a NestJS service and your stomach is now in a knot, run it on yours before reading further — it's one install, [full config is below](#the-config):

```bash
npm install --save-dev eslint-plugin-nestjs-security
npx eslint "src/**/*.ts"
```

Here are all 6 — and exactly why experienced engineers didn't catch each one.

---

<a id="unguarded-controllers"></a>

## 1. Unguarded Controllers (CWE-284)

**What the code looked like:**

```typescript
// admin.controller.ts
import { Controller, Get, Delete, Param } from "@nestjs/common";
import { UsersService } from "../users/users.service";

@Controller("admin")
export class AdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get("users")
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Delete("user/:id")
  async deleteUser(@Param("id") id: string) {
    return this.usersService.delete(id);
  }
}
```

**Why it survived review:** This is the one that still bothers me most. The team had a global `JwtAuthGuard` — it was real, tested, and documented in the onboarding wiki, registered via `{ provide: APP_GUARD, useClass: JwtAuthGuard }` so Nest could inject its `JwtService` properly. `canActivate()` rejected outright — `return false`, a clean 401 — for any request with no `Authorization` header or an obviously malformed one, before ever calling `jwtService.verify()`. Only a structurally well-formed token reached the `try { jwtService.verify(token) } catch { return true }` beyond it — added early on with a comment reading "verify() throwing here means the token library hiccuped, not that the user is unauthorized." Every test the team had sent either no token (rejected pre-`verify()`, correctly) or a valid one (accepted, correctly); nobody had a test for "well-formed token, `verify()` throws anyway," because until that day, no such token had ever existed. Six months later, a `JwtModule` re-registration during a refactor left `JwtService` pointed at a secret that no longer matched the one issuing tokens. Now every real token — still structurally well-formed — made `verify()` throw, straight into the catch block that had always meant "let it through." CI stayed green: nothing in the suite exercised a valid-shaped-but-cryptographically-wrong token, because that token type hadn't existed until the refactor created it. This wasn't scoped to `/admin` — every route behind that global guard was fail-open the same way, for the same reason: it's a global guard, one class, one catch block. It stayed invisible for six months precisely _because_ it was global — legitimate users kept authenticating with real, freshly-issued tokens that also failed `verify()` against the wrong secret and also got waved through by the same catch. Nothing broke for anyone, which is exactly why nobody went looking. Any request to `/admin/users`, forged token or not, returned the full user list.

**Why the decorator pattern hides it:** When you read a controller in a PR diff, your eye looks for what's _there_ — the route handlers, the service calls, the response shape. A missing decorator is invisible in a diff. There's no red line that says "authentication check removed here." The absence doesn't show up.

**What the lint rule catches:** `require-guards` fires on any route-handler method that lacks `@UseGuards(...)` — either its own or inherited from a class-level decorator — and lacks a `@Public()` / `@SkipAuth()` / `@AllowAnonymous()` / `@NoAuth()` opt-out. No type inference needed — pure structural, decorator-name analysis. Notice what that means for this exact bug: `require-guards` doesn't know or care whether `app.useGlobalGuards()` exists in `main.ts` — a global guard is invisible to a rule that only reads one controller file at a time. It would have flagged `AdminController` as missing a _local_ `@UseGuards()` regardless of the global guard's health. That's the design: it forces every route's guard to be explicit and co-located with the route, so a reviewer checking guard coverage never has to trust a bootstrap file from a distance. It's worth naming the seam honestly, though — this specific bug wasn't a _missing_ guard, it was a _broken_ one. A local `@UseGuards(JwtAuthGuard)` on `AdminController` would have satisfied `require-guards` and still shipped the same fail-open `catch`. The rule catches the class of bug (unguarded routes); this instance was a guard-logic bug, and no structural AST rule catches a `catch` block that returns the wrong boolean.

```typescript
// admin.controller.ts — fixed
import { Controller, Get, Delete, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UsersService } from "../users/users.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get("users")
  @Roles("admin")
  async getAllUsers() {
    return this.usersService.findAll();
  }
}
```

---

<a id="exposed-private-fields"></a>

## 2. Sensitive Fields Leaking in Responses (CWE-200)

**What the code looked like:**

```typescript
// user.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  password: string;      // hashed, but still in the response

  @Column()
  refreshToken: string;  // full token, rotated monthly
}

// users.controller.ts
@Get(':id')
async getUser(@Param('id') id: string): Promise<User> {
  return this.usersService.findOne(id); // entity returned directly
}
```

**Why it survived review:** The entity was originally consumed exclusively by an internal gRPC service that deserialized it into a typed struct — stripping unknown fields silently on the client side. No API log, no Datadog response capture, no staging `curl` that would surface `password` in the body. The data left the server but never appeared anywhere the team looked. Then a REST endpoint was added three months later and never audited. TypeScript's type system was 100% correct: the types were accurate, the shape matched, the compiler was satisfied. The field name `password` didn't trigger anything — TypeScript doesn't know or care what data is sensitive. A penetration tester found it by running a raw HTTP client against the REST endpoint.

**Why TypeScript types can't catch this:** TypeScript operates on shape and type compatibility. `password: string` is a perfectly valid property. The bug isn't a type error — it's a policy error. [Static analysis](https://ofriperetz.dev/articles/static-analysis-vs-sast-vs-linting) that understands the _semantics_ of field names is the only automated tool that catches it.

**What the lint rule catches:** `no-exposed-private-fields` scans classes it recognizes as entities or DTOs — via `@Entity`/`@Schema`/`@ObjectType`/`@ApiProperty`-style decorators, or a `Dto`/`Entity`/`Model`/`Schema` name suffix — for sensitive field name patterns (`password`, `secret`, `token`, `apiKey`, `refreshToken`, `ssn`, `creditCard`, ...) and flags any that aren't decorated with `@Exclude()` from `class-transformer`. A plain class outside that gate isn't scanned, so the entity/DTO naming convention matters.

```typescript
// user.entity.ts — fixed
import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";
import { Exclude } from "class-transformer";

@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  @Exclude()
  refreshToken: string;
}

// In main.ts — required for @Exclude() to take effect:
// app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

---

<a id="no-rate-limiting"></a>

## 3. Auth Endpoints Without Rate Limiting (CWE-770 → CWE-307)

**What the code looked like:**

```typescript
// auth.controller.ts
import { Controller, Post, Body } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
```

**Why it survived review:** The infra team planned to add rate limiting at the nginx layer. They did — the nginx config was updated for `/api/v1/auth/login`. In the same sprint, the app prefix was changed from `v1` to `v2`. Nobody cross-referenced the two PRs. The nginx rule was there, correctly written, matching a path that no longer existed. The app had no rate limiting at all on its login endpoint. This survived because two engineers on two different teams each believed the other had covered it — and the diff for each individual PR looked correct.

**What the lint rule catches:** `require-throttler` flags any `@Controller` or route handler that doesn't have `@Throttle(...)` or `ThrottlerGuard` in its guard chain. Note: you need `ThrottlerModule` configured in your module — the rule catches the missing guard on the controller, not the module wiring.

```typescript
// auth.module.ts — ThrottlerModule must be configured
import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}

// auth.controller.ts — fixed
import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

// requires @nestjs/throttler@^5 — ttl is in milliseconds (v4 and earlier used seconds)
@Controller("auth")
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per 60 seconds
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

> The rule emits **[CWE-770](https://ofriperetz.dev/articles/cwe-taxonomy-explained)** — Allocation of Resources Without Limits or Throttling. On an auth route the downstream consequence is brute-force / credential stuffing (**CWE-307**); that's the human-facing risk, but you'll see 770 in the tool output.

---

<a id="missing-validation-pipe"></a>

## 4. Unvalidated DTO Inputs (CWE-20)

**What the code looked like:**

```typescript
// posts.controller.ts
import { Controller, Post, Body } from "@nestjs/common";
import { CreatePostDto } from "./dto/create-post.dto";
import { PostsService } from "./posts.service";

@Controller("posts")
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  async createPost(@Body() body: CreatePostDto) {
    return this.postsService.create(body);
  }
}
```

**Why it survived review:** `CreatePostDto` is typed. TypeScript enforces the shape at compile time. Every senior engineer on the team knew this — TypeScript types, decorator-based DTO, looks correct. What wasn't obvious from the diff: without a `ValidationPipe` registered, the TypeScript types are compile-time only. At runtime, any shape passes through to the service layer. The types were right. The validation was missing. Nobody looked for the global pipe because the DTO existed and "looked validated." This is the TypeScript false sense of security in its purest form.

**What the lint rule catches:** `no-missing-validation-pipe` flags `@Body()` / `@Query()` / `@Param()` parameters with a non-primitive type that don't have a `ValidationPipe` in scope — via `@UsePipes(ValidationPipe)` on the class or method. It's a single-file AST rule: it cannot see into `main.ts` to confirm a global pipe actually exists there. There's an `assumeGlobalPipes` option that disables the rule entirely if you tell it (not verify it) that a global pipe is registered — which is exactly the kind of trust-without-checking that caused this bug in the first place, so I run without it.

```typescript
// main.ts — Option 1: global (recommended)
app.useGlobalPipes(
  new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
);

// posts.controller.ts — Option 2: per-parameter
@Post()
async createPost(@Body(new ValidationPipe()) body: CreatePostDto) {
  return this.postsService.create(body);
}
```

---

<a id="missing-validators"></a>

## 5. DTO Properties Without Validation Decorators (CWE-20)

**What the code looked like:**

```typescript
// create-user.dto.ts
import { IsEmail } from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email: string;

  name: string; // no validator — accepts any length, any encoding

  role: string; // no validator — accepts 'admin' as easily as 'user'
}
```

**Why it survived review:** `email` had a decorator, so the reviewer's eye scanned the class and mentally checked "validated." One decorated field gave the whole class a passing grade. The `role` field was added three weeks later in a quick patch — it looked safe in context because the surrounding code looked safe. When `whitelist: true` wasn't enforced at runtime (bug #4), `role: 'admin'` passed through unchecked. This is the halo effect: a class that has _some_ validation gets treated as fully validated.

**What the lint rule catches:** `require-class-validator` verifies that every property in a DTO class (name ending `Dto`/`Request`/`Input`, or carrying an `@ApiProperty`-style decorator) has at least one `class-validator` decorator — properties prefixed with `_` are treated as internal and exempted.

```typescript
// create-user.dto.ts — fixed
import { IsEmail, IsString, MaxLength, IsEnum } from "class-validator";

export enum UserRole {
  User = "user",
  Moderator = "moderator",
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(UserRole) // 'user' | 'moderator' — not 'admin'
  role: UserRole;
}
```

---

<a id="debug-endpoints"></a>

## 6. Debug Endpoints Left in Production (CWE-489)

**What the code looked like:**

```typescript
// debug.controller.ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { DebugGuard } from "./debug.guard";

@Controller("debug")
@UseGuards(DebugGuard)
export class DebugController {
  @Get("config")
  getConfig() {
    return process.env; // DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY, all of it
  }
}

// debug.guard.ts
@Injectable()
export class DebugGuard implements CanActivate {
  canActivate(): boolean {
    // intent: block in prod, allow elsewhere — shipped inverted
    return process.env.NODE_ENV === "production";
  }
}
```

**Why it survived review:** `DebugGuard` was real and had its own test — the test ran with `NODE_ENV` unset, the default in the test runner, and asserted the guard blocked the request. That passed: `undefined === 'production'` is `false`, and a blocked debug endpoint in a test environment looked exactly as safe as it was supposed to look. Nobody wrote a second test with `NODE_ENV` actually set to `'production'`, because — on paper — that's the "does the boring, obviously-correct thing" branch: the guard exists specifically to gate access in prod, so of course it gates access in prod. Nobody traced that the one untested input was the one that flips the comparison to `true`. The guard was real, tested, green in CI. It had just never been tested against the one value it existed to react to. Deployed in a Friday afternoon push. Found by a user who noticed `/debug/config` returned valid JSON with real secrets — because in production, the guard's `canActivate()` returned `true`.

**Why this survives review:** "It has a guard and the guard has a test" is where most reviewers stop checking. Nobody asked which branch of the guard's logic the test actually exercised. A guard that's real, wired up, and covered by a green test can still be testing the wrong half of its own conditional — and a `@Controller('debug')` with `@UseGuards` on it reads as fully handled at a glance.

**What the lint rule catches:** `no-exposed-debug-endpoints` flags any controller or route whose path contains one of its `DEFAULT_DEBUG_PATHS` — `debug`, `__debug__`, `admin`, `_admin`, `test`, `health` — full stop, regardless of whether it's guarded. That's deliberate: a debug route with a guard today is one config change away from losing it, and the rule would rather you silence it explicitly (see the override below) than trust a guard to stay in place. It does not inspect the handler body, so it won't catch `process.env` on its own here — that exposure is what made this specific debug route catastrophic, not what the rule detects; the path-name match is what makes it fire at all.

Note the overlap this creates with bug #1: `admin` is in `DEFAULT_DEBUG_PATHS`, so `AdminController` from the first section — fixed or not — also trips `no-exposed-debug-endpoints`. In the real run, that finding is counted once, under this rule, not double-counted against `require-guards`; I'm calling it out here rather than in the table because it's the kind of overlap you'll hit on your own codebase too. If you have a legitimate `/admin` route that isn't a debug backdoor, you'll want the same per-project override shown below — drop `'admin'` from the list, or scope it to something more specific like `_admin`/`debug`.

```typescript
// debug.controller.ts — fix: remove the controller entirely.
// If you need a health check for load balancers / k8s probes,
// use a dedicated module that never touches process.env:

// health.controller.ts
import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { status: "ok", timestamp: Date.now() };
  }
}
// Note: 'health' IS in DEFAULT_DEBUG_PATHS. Health checks are intentionally public —
// LBs can't auth — so silence it deliberately:
//
//   'nestjs-security/no-exposed-debug-endpoints': ['error', {
//     endpoints: ['debug', '__debug__', 'admin', '_admin', 'test'], // drop 'health'
//   }],
```

---

<a id="the-config"></a>

## The config that catches all 6 in one pass

```javascript
// eslint.config.mjs
import tseslint from "typescript-eslint";
import nestjsSecurity from "eslint-plugin-nestjs-security";

export default tseslint.config({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { project: true },
  },
  plugins: { "nestjs-security": nestjsSecurity },
  rules: {
    "nestjs-security/require-guards": "error",
    "nestjs-security/no-exposed-private-fields": "error",
    "nestjs-security/require-throttler": "error",
    "nestjs-security/no-missing-validation-pipe": "error",
    "nestjs-security/require-class-validator": "error",
    "nestjs-security/no-exposed-debug-endpoints": "error",
  },
});
```

```bash
npm install --save-dev eslint-plugin-nestjs-security typescript-eslint
npx eslint "src/**/*.ts"
```

The parser matters: decorators and type annotations (`@Param('id') id: string`) aren't valid syntax under ESLint's default `espree` parser. If your project already lints TypeScript, you likely have this wired up already — the plugin's own `configs.recommended` assumes it and only adds `plugins` + `rules` on top of it.

Full rule documentation: [eslint.interlace.tools](https://eslint.interlace.tools)

Want the per-rule reasoning — what each of the six rules matches on and _why NestJS leaves the gap open in the first place_? That's the [rule-by-rule getting-started guide](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules). This post is the war story; that one is the manual.

---

## Why an unregistered ValidationPipe and an undecorated DTO compound into role escalation

The missing global `ValidationPipe` (bug #4) and the undecorated `role` field (bug #5) compound, and which one matters depends on how `role` is meant to be used. If `role` is never supposed to be client-settable at all, `whitelist: true` alone strips it — but only if the pipe is registered, which is bug #4. If `role` is a legitimate client-settable field (say, a "display as" preference that happens to share a name with an internal permission field), `whitelist` won't touch it — it's a known key — and the only thing standing between `role: 'user'` and `role: 'admin'` is a validator like `@IsEnum(UserRole)` constraining which values are accepted. That's bug #5. Neither rule substitutes for the other: `no-missing-validation-pipe` stops fields the client shouldn't be sending at all; `require-class-validator` stops fields the client can send but shouldn't be able to set arbitrarily. Know which threat model your DTO has, and run both checks regardless — you rarely get to assume you got the pipe config right on every controller.

---

## These aren't legacy bugs. Your AI assistant writes them today.

Here's why I stopped treating this as a one-time incident report: these six patterns are not artifacts of 2018 NestJS or a junior who didn't know better. They are the _default output of a competent developer moving fast_ — which is exactly what a coding assistant emulates.

I gave Claude Sonnet 4.6 a single prompt — "Build a NestJS users service. Authentication, registration, login, profile endpoint, admin panel." — and ran the same plugin on the result. It produced 200 lines of clean, TypeScript-passing NestJS, and **6 errors in 3 seconds**: the same unguarded admin controller, the same `password` in the response body, the same unthrottled login route, the same debug endpoint returning `DATABASE_URL`. Not similar bugs — the same six classes. I wrote that up in [Claude Wrote a NestJS Service. TypeScript Was Happy. ESLint Found 6 Security Holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes). Running the same prompt through Gemini 2.5 Flash got the count down to 2 — but it _still shipped auth endpoints with no rate limiting_ ([Claude vs Gemini, same prompt, different errors](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors)).

Read that last bit again, because it's the most uncomfortable number in this whole post: **the one finding that survived the model swap is #3 — the unthrottled login route.** Claude failed `require-throttler`. Gemini, which got guards, validators, and serialization _right_, failed `require-throttler` too. Switching your AI vendor changed five of the six findings and left the brute-force hole untouched. And don't assume a smarter model saves you: across [80 Claude-written functions, 65–75% carried at least one vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — and the _newest_ model in that run (Opus 4.6) scored identically to the older Sonnet 4.5.

The reason is the same reason these survived human review: an LLM optimizes for the route logic you asked for, and the security boundary is the _absence_ of something it was never prompted to add. A guard that isn't there doesn't show up in a diff, doesn't fail a type check, and doesn't fail a unit test that mocked it. It only shows up in structural analysis — which is the entire premise of that 80-function experiment.

So the inherited codebase and the AI-generated one converge on the same lint config. Whether the `password` leak came from a 2-year-old PR or from yesterday's autocomplete, `no-exposed-private-fields` fires identically.

---

## Why this pattern repeats across every team

Look back at the six "why it survived review" explanations and the failure mode is identical every time: **the security control existed somewhere the reviewer trusted, so the reviewer stopped looking.** The global guard "was in `main.ts`." Rate limiting "was at the nginx layer." The debug endpoint "was disabled in production." The DTO "was typed." In each case a senior engineer waved the PR through not out of negligence but because the diff in front of them was locally correct — and the broken assumption lived in a different file, a different sprint, or a different team's config.

Code review verifies the lines that changed. None of these bugs were in the lines that changed. That's the asymmetry static analysis closes.

For the full onboarding protocol — the three plugins, the `jq` one-liner that ranks findings by rule, and how to read the heatmap — see [The 30-Minute Security Audit: I ran it on 140 Gemini-written functions, 102 shipped vulnerable](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase).

---

## Foundations

Every finding in this post carries a CWE label — the CWE-284 / CWE-200 / CWE-770 tags in the table up top. [CWE Taxonomy Explained](https://ofriperetz.dev/articles/cwe-taxonomy-explained) is the map behind those labels: how the taxonomy works and why lint rules key their findings to it. And for turning "which class" into "how bad" — the severity scoring those labels feed into — see [CVSS Scores Explained](https://ofriperetz.dev/articles/cvss-scores-explained).

---

_What's the first ESLint security finding you remember that surprised you in a production codebase — the one that made you think "how has this been here this long?" Drop the rule name and the war story below. I read every one._

---

_Part of **The Hardened Stack** series:_
_← [The 30-Minute Security Audit: onboarding a new codebase](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) | **You inherited a NestJS codebase (you are here)** | [The same six classes, written by Claude →](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes)_

---

_[eslint-plugin-nestjs-security](https://www.npmjs.com/package/eslint-plugin-nestjs-security) is part of the [Interlace ESLint ecosystem](https://eslint.interlace.tools). Source on [GitHub](https://github.com/ofri-peretz/eslint) · Follow: [Dev.to/ofri-peretz](https://dev.to/ofri-peretz)_
