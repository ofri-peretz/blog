---
title: "I Inherited a NestJS Codebase. 12 Seconds of ESLint Found 47 Violations Across 6 Vulnerability Classes."
description: "The codebase had 2 years of feature PRs and zero security audits. A 12-second ESLint run surfaced 47 violations across 6 distinct vulnerability classes — auth bypass, sensitive field leaks, brute-force exposure, and three more. Here's what each one looks like, why it survived code review, and why your AI assistant writes the same six today."
slug: "i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities"
canonical_url: "https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities"
devto_url: "https://dev.to/ofri-peretz/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities-55ma"
devto_id: 3769186
published_at: "2026-05-28"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/jr9sy2gzvsl2w7j2uuvi.png"
social_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/jr9sy2gzvsl2w7j2uuvi.png"
reading_time_minutes: 8
tags:
  - "security"
  - "node"
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

Code review checks for what's there. Static analysis checks for what's missing.

That asymmetry is why a codebase can have CI, tests, TypeScript strict mode, and two years of feature PRs — and still ship 6 distinct vulnerability classes that no reviewer caught. Not because reviewers were careless. Because every one of these bugs required noticing the _absence_ of something: a missing decorator, a missing pipe, a missing guard. That's off the mental stack when you're reading route logic.

The first run of `eslint-plugin-nestjs-security` on a 40K-line production codebase took 12 seconds. It found 47 violations across 6 distinct vulnerability classes — auth bypass, sensitive field leaks, brute-force exposure, and three more. Nobody had touched a security tool in two years. Twelve seconds.

Here's how those 47 broke down by rule:

| Rule | CWE | Count |
| --- | --- | ---: |
| `require-guards` | CWE-284 | 11 |
| `no-exposed-private-fields` | CWE-200 | 9 |
| `no-missing-validation-pipe` | CWE-20 | 8 |
| `require-class-validator` | CWE-20 | 7 |
| `require-throttler` | CWE-770 | 7 |
| `no-exposed-debug-endpoints` | CWE-489 | 5 |
| **Total** | | **47** |

> **Reproducibility (this run).** Plugin `eslint-plugin-nestjs-security@1.2.3`, all six rules at `error` ([config below](#the-config)). Scanned with `npx eslint "src/**/*.ts"` on the inherited service (~40K lines, 2 years of feature PRs, zero prior security passes). The 12-second figure is wall-clock on a single cold run, M2 / Node 20. Counts are from this one codebase — yours will differ, but the _class distribution_ (guards and validation dominate, debug routes are rare-but-fatal) is the part that holds across the NestJS services I've audited.

If you just inherited a NestJS service and your stomach is now in a knot, run it on yours before reading further — it's one install, [full config is below](#the-config):

```bash
npm install --save-dev eslint-plugin-nestjs-security
npx eslint "src/**/*.ts"
```

Here are all 6 — and exactly why each one survived code review.

---

## 1. Unguarded Controllers (CWE-284)

**What the code looked like:**

```typescript
@Controller('admin')
export class AdminController {
  @Get('users')
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Delete('user/:id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
```

**Why it survived review:** The team believed a global `JwtAuthGuard` was configured in `main.ts`. It was configured on the AppModule — but a 6-month-old refactor broke the middleware ordering. No test caught this because the test suite mocked the guard globally.

**What the lint rule catches:** `require-guards` fires on any `@Controller` class or route handler that lacks `@UseGuards(...)` or a `@Public()` opt-out. No type inference needed — pure structural analysis.

```typescript
// Fix: explicit guard at the controller level
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('users')
  @Roles('admin')
  async getAllUsers() {
    return this.usersService.findAll();
  }
}
```

---

## 2. Sensitive Fields Leaking in Responses (CWE-200)

**What the code looked like:**

```typescript
@Entity()
export class User {
  @Column() id: string;
  @Column() email: string;
  @Column() password: string;      // hashed, but still in the response
  @Column() refreshToken: string;  // full token, rotated monthly
}

@Get(':id')
async getUser(@Param('id') id: string): Promise<User> {
  return this.usersService.findOne(id); // entity returned directly
}
```

**Why it survived review:** The entity was consumed exclusively by an internal gRPC service that deserialized it into a typed struct — stripping unknown fields silently on the client side. No API log, no Datadog response capture, no staging curl that would surface `password` in the body. The data left the server but never appeared anywhere the team looked. A penetration tester found it by running a raw HTTP client against the REST endpoint that was added three months later and never audited.

**What the lint rule catches:** `no-exposed-private-fields` scans class properties for sensitive field name patterns (`password`, `secret`, `token`, `apiKey`, `refreshToken`, `ssn`, `creditCard`, ...) and flags any that aren't decorated with `@Exclude()` from `class-transformer`.

```typescript
import { Exclude } from 'class-transformer';

@Entity()
export class User {
  @Column() id: string;
  @Column() email: string;

  @Column()
  @Exclude()
  password: string;

  @Column()
  @Exclude()
  refreshToken: string;
}

// In main.ts:
// app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

---

## 3. Auth Endpoints Without Rate Limiting (CWE-770 → CWE-307)

**What the code looked like:**

```typescript
@Controller('auth')
export class AuthController {
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
```

**Why it survived review:** The infra team planned to add rate limiting at the nginx layer. The nginx config was updated for `/api/v1/auth/login` — but the app prefix was changed to `/api/v2` in the same sprint. Nobody cross-referenced the two PRs.

**What the lint rule catches:** `require-throttler` flags any `@Controller` or route handler that doesn't have `@Throttle(...)` or `ThrottlerGuard` in its guard chain. (The rule emits **CWE-770** — Allocation of Resources Without Limits or Throttling — because the missing control is a rate limit, full stop. On an _auth_ route the downstream consequence is brute-force / credential stuffing, which is **CWE-307**; that's the human-facing fit I lead with here, but you'll see 770 in the tool output, not 307.)

```typescript
// requires @nestjs/throttler@^5 — ttl is in milliseconds (v4 and earlier used seconds)
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per 60 seconds
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

---

## 4. Unvalidated DTO Inputs (CWE-20)

**What the code looked like:**

```typescript
@Post('typed')
async createPost(@Body() body: CreatePostDto) {
  return this.postsService.create(body);
}
```

**Why it survived review:** `CreatePostDto` is typed. TypeScript enforces the shape at compile time. Reviewers saw a typed DTO and assumed validation was running. It wasn't — without a `ValidationPipe`, the TypeScript types are compile-time only. At runtime, any shape passes through.

**What the lint rule catches:** `no-missing-validation-pipe` flags `@Body()` parameters that lack `new ValidationPipe()` at the parameter level, and verifies that a global `ValidationPipe` is registered.

```typescript
// Option 1: global (recommended) — in main.ts
app.useGlobalPipes(
  new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })
);

// Option 2: per-parameter
@Post()
async createPost(@Body(new ValidationPipe()) body: CreatePostDto) {
  return this.postsService.create(body);
}
```

---

## 5. DTO Properties Without Validation Decorators (CWE-20)

**What the code looked like:**

```typescript
export class CreateUserDto {
  @IsEmail()
  email: string;

  name: string;  // no validator — accepts any length, any encoding

  role: string;  // no validator — accepts 'admin' as easily as 'user'
}
```

**Why it survived review:** `email` had a decorator, so the reviewer's eye treated the DTO as validated and moved on. One decorated field gave the whole class a passing grade. The `role` field was added three weeks later in a quick patch, never circled back to, and accepted because the surrounding context looked safe. When `whitelist: true` wasn't enforced at runtime, `role: 'admin'` passed through unchecked.

**What the lint rule catches:** `require-class-validator` verifies that every property in a DTO class has at least one `class-validator` decorator.

```typescript
import { IsEmail, IsString, MaxLength, IsEnum } from 'class-validator';

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

## 6. Debug Endpoints Left in Production (CWE-489)

**What the code looked like:**

```typescript
@Controller('debug')
export class DebugController {
  @Get('config')
  getConfig() {
    return process.env; // DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY, all of it
  }
}
```

**Why it survived review:** It was protected by `@UseGuards(JwtAuthGuard)` — in staging. A `NODE_ENV === 'production'` check was meant to disable it but the condition was inverted. Deployed to production in a Friday afternoon push. Found by a user who noticed `/debug/config` returned valid JSON.

**What the lint rule catches:** `no-exposed-debug-endpoints` flags controllers whose path contains any of its `DEFAULT_DEBUG_PATHS` — `debug`, `__debug__`, `admin`, `_admin`, `test`, `health` — when they lack auth guards, plus any endpoint that returns `process.env` directly. The match is a substring check, so `/admin`, `/internal-test`, and `/healthz` all trip it.

```typescript
// Fix: remove the controller entirely.
// If you need a health check for load balancers / k8s probes,
// use a dedicated module that never touches process.env:
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: Date.now() };
  }
}
// Heads up: 'health' IS in DEFAULT_DEBUG_PATHS, so with the default config
// this controller still fires (no guard + a flagged path). Health checks are
// intentionally public — LBs can't auth — so silence it deliberately, e.g.:
//
//   'nestjs-security/no-exposed-debug-endpoints': ['error', {
//     endpoints: ['debug', '__debug__', 'admin', '_admin', 'test'], // drop 'health'
//   }],
//
// Narrowing the path list is the explicit opt-out; the default stays loud
// on purpose, because a 'health' route that quietly returns process.env is
// exactly the bug above wearing a friendlier name.
```

---

<a id="the-config"></a>

## The config that catches all 6 in one pass

```javascript
// eslint.config.mjs
import nestjsSecurity from 'eslint-plugin-nestjs-security';

export default [
  {
    plugins: { 'nestjs-security': nestjsSecurity },
    rules: {
      'nestjs-security/require-guards': 'error',
      'nestjs-security/no-exposed-private-fields': 'error',
      'nestjs-security/require-throttler': 'error',
      'nestjs-security/no-missing-validation-pipe': 'error',
      'nestjs-security/require-class-validator': 'warn',
      'nestjs-security/no-exposed-debug-endpoints': 'error',
    },
  },
];
```

```bash
npm install --save-dev eslint-plugin-nestjs-security
npx eslint "src/**/*.ts"
```

Want the per-rule reasoning — what each of the six rules matches on and _why NestJS leaves the gap open in the first place_? That's the [rule-by-rule getting-started guide](https://ofriperetz.dev/articles/nestjs-guards-pipes-throttlers-6-eslint-rules). This post is the war story; that one is the manual.

---

## The connection between #4 and #5

Bugs 4 and 5 interact. `whitelist: true` on the `ValidationPipe` strips the `role: 'admin'` attack — but only if the pipe is actually registered (bug #4). Without it, even a perfectly decorated DTO is runtime-permissive. The two rules catch the issues independently; fixing one without the other leaves a gap. Run both checks.

---

## These aren't legacy bugs. Your AI assistant writes them today.

Here's the part that turned this from a one-off cleanup into a rule set I now run on everything: these six patterns are not artifacts of 2018 NestJS or a junior who didn't know better. They are the _default output of a competent developer moving fast_ — which is exactly what a coding assistant emulates.

I gave Claude Sonnet 4.6 a single prompt — "Build a NestJS users service. Authentication, registration, login, profile endpoint, admin panel." — and ran the same plugin on the result. It produced 200 lines of clean, TypeScript-passing NestJS, and **6 errors in 3 seconds**: the same unguarded admin controller, the same `password` in the response body, the same unthrottled login route, the same debug endpoint returning `DATABASE_URL`. Not similar bugs — the same six classes. I wrote that up in [Claude Wrote a NestJS Service. TypeScript Was Happy. ESLint Found 6 Security Holes](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes). Running the same prompt through Gemini 2.5 Flash got the count down to 2 — but it _still shipped auth endpoints with no rate limiting_ ([Claude vs Gemini, same prompt, different errors](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors)).

Read that last bit again, because it's the most uncomfortable number in this whole post: **the one finding that survived the model swap is #3 — the unthrottled login route.** Claude failed `require-throttler`. Gemini, which got guards, validators, and serialization _right_, failed `require-throttler` too. Switching your AI vendor changed five of the six findings and left the brute-force hole untouched, because neither prompt thought to constrain login rate — exactly the way a different team's nginx PR left it untouched in the inherited codebase. And don't assume a smarter model saves you: across [80 Claude-written functions, 65–75% carried at least one vulnerability](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities) — and the _newest_ model in that run (Opus 4.6) scored identically to the older Sonnet 4.5. The vulnerability rate is a property of how AI generates code, not of which checkpoint you're on.

The reason is the same reason these survived human review: an LLM optimizes for the route logic you asked for, and the security boundary is the _absence_ of something it was never prompted to add. A guard that isn't there doesn't show up in a diff, doesn't fail a type check, and doesn't fail a unit test that mocked it. It only shows up in structural analysis — which is the entire premise of that 80-function experiment.

So the inherited codebase and the AI-generated one converge on the same lint config. Whether the `password` leak came from a 2-year-old PR or from yesterday's autocomplete, `no-exposed-private-fields` fires identically.

If you want to run this experiment yourself on a Gemini model instead of Claude — the head-to-head with the full per-rule scorecard and the exact prompt is the [Claude vs Gemini run](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors), which is the version positioned for the [Build with Gemini XPRIZE](https://dev.to/challenges) track. The adaptation is a one-line model swap in the prompt and a re-run of the config below.

## Why this survived review (the pattern underneath all six)

Look back at the six "why it survived review" notes and the failure mode is identical every time: **the security control existed somewhere the reviewer trusted, so the reviewer stopped looking.** The global guard "was in `main.ts`." Rate limiting "was at the nginx layer." The debug endpoint "was disabled in production." The DTO "was typed." In each case a senior engineer waved the PR through not out of negligence but because the diff in front of them was locally correct — and the broken assumption lived in a different file, a different sprint, or a different team's config. Code review verifies the lines that changed. None of these bugs were in the lines that changed.

That's why a structural linter is not a downgrade from human review — it's the half of the review that humans are structurally bad at. For the full protocol I run on day one of any inherited service — the three plugins, the `jq` one-liner that ranks findings by rule, and how to read the heatmap — see [I Inherited a 3,000-Line Codebase. One ESLint Run Found 26 Critical Security Bugs](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase).

---

_You inherited a service this quarter. Run the two commands above before you read the comments — then tell me: which of these six fired first, and how did you find out it had been live? A pentest report, a 2 a.m. page, or a user emailing you a screenshot of `/debug/config`? Drop the rule name and the war story below — I read every one._

---

_Part of **The Hardened Stack** series:_
_← [The 30-Minute Security Audit: onboarding a new codebase](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) | **You inherited a NestJS codebase (you are here)** | [The same six classes, written by Claude →](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes)_

---

📦 [`eslint-plugin-nestjs-security`](https://www.npmjs.com/package/eslint-plugin-nestjs-security) — 6 security rules for NestJS · [rule docs](https://eslint.interlace.tools/docs/security/plugin-nestjs-security)

{% cta <https://github.com/ofri-peretz/eslint> %}
⭐ Star on GitHub
{% endcta %}

**Companion pieces:** the same six classes in [AI-generated code](https://ofriperetz.dev/articles/claude-wrote-nestjs-service-eslint-found-6-security-holes) · the [Claude vs Gemini](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors) head-to-head · the full [day-one audit protocol](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase) for an inherited codebase.

---

[GitHub](https://github.com/ofri-peretz) | [X](https://x.com/ofriperetzdev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [Dev.to](https://dev.to/ofri-peretz)
