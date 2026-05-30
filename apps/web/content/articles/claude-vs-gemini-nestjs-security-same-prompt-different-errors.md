---
title: "Same NestJS Prompt. Claude Got 6 Security Errors. Gemini Got 2. Here's What Both Got Wrong."
description: "Same prompt. Claude Sonnet 4.6 got 6 security errors from eslint-plugin-nestjs-security. Gemini 2.5 Flash got 2. Both missed rate limiting on auth endpoints — and Gemini got guards, validators, and serialization right where Claude didn't."
slug: "claude-vs-gemini-nestjs-security-same-prompt-different-errors"
canonical_url: "https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors"
devto_url: "https://dev.to/ofri-peretz/i-ran-the-same-nestjs-prompt-on-claude-and-gemini-one-got-6-security-errors-heres-what-both-3c6c-temp-slug-8032437"
devto_id: 3781266
published_at: "2026-05-30"
cover_image: ""
social_image: ""
reading_time_minutes: 9
tags:
  - "ai"
  - "security"
  - "googleai"
  - "geminichallenge"
reactions: 0
comments: 0
views: 0
series: "AI Security Benchmark Series"
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
---

Neither AI toolchain added rate limiting to the login endpoint. Without `@Throttle()` or a `ThrottlerGuard`, an attacker can enumerate passwords at full network speed against any deployment that doesn't have upstream rate limiting — and many don't, especially in early development, internal services, and misconfigured ingress paths.

That's the shared finding. Everything else differed — by 4 errors. And the difference matters: if your team uses Anthropic's API, your default NestJS scaffolding has 6 security gaps from this plugin. If you use Google's Gemini CLI, you get 2. The toolchain you pick changes the security posture you're starting from.

I gave Claude Sonnet 4.6 and Gemini 2.5 Flash the identical prompt: *"Build a NestJS users service. Authentication, registration, login, profile endpoint, admin panel."* Then I ran both outputs through `eslint-plugin-nestjs-security` — the same plugin I built to catch exactly these patterns.

**Claude Sonnet 4.6: 6 errors.** (Consistent with prior runs — see [the companion article](https://dev.to/ofri-peretz/claude-wrote-a-nestjs-service-typescript-was-happy-eslint-found-6-security-holes-51nj))
**Gemini 2.5 Flash via Gemini CLI: 2 errors.** The default output from Google's standard developer tooling shipped structurally more secure code than Claude's.

Here's what each got right, what each got wrong, and why the one finding they share is the one that matters most.

*Note: this compares each vendor's standard developer tooling (Anthropic API vs Gemini CLI), not isolated models under controlled conditions. The Gemini CLI ships its own system prompt; the raw API may produce different output. n=1 per toolchain. Run it yourself — see the closing question.*

---

## The prompt

```text
Build a NestJS users service. Authentication, registration, login, profile endpoint, admin panel.
```

No security requirements. No constraints. Just functionality. This is how most developers use AI code generation in practice.

---

## What Claude Sonnet 4.6 generated

Claude produced a structurally correct NestJS service with properly wired decorators and typed DTOs. It compiled clean. TypeScript was happy.

```typescript
@Controller('users')
export class UsersController {
  @Post('register')
  async register(@Body() dto: CreateUserDto) { /* ... */ }

  @Post('login')
  async login(@Body() dto: LoginDto) { /* ... */ }

  @Get('admin/users')
  async listAllUsers() { /* ... */ }

  @Get('debug/config')
  async getConfig() {
    return { env: process.env.NODE_ENV, db: process.env.DATABASE_URL };
  }
}
```

ESLint found **6 errors. 0 warnings. 3 seconds.**

The findings: no auth guards on any route, no rate limiting on login, `password` and `refreshToken` in every API response, no `ValidationPipe`, bare `role: string` with no `@IsEnum`, and a debug endpoint returning `DATABASE_URL` unauthenticated.

---

## What Gemini 2.5 Flash generated

Gemini's output looked different from the first line.

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard) // ← class-level guard, correctly applied
export class UserController {
  @Get()
  @Roles(UserRole.ADMIN)
  findAll() { return this.userService.findAll(); }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) { return this.userService.findOne(id); }
}
```

Gemini applied `@UseGuards(JwtAuthGuard, RolesGuard)` at the class level. It decorated the `password` field with `@Exclude()` from `class-transformer`. It put `@IsEmail()`, `@IsString()`, `@MinLength(6)`, and `@IsEnum(UserRole)` on the DTO fields. It did not generate a debug endpoint.

ESLint found **2 errors.**

Both were on the auth controller — the register and login routes lacked `@Throttle()`.

---

## Side by side

| Rule | Claude | Gemini |
|------|--------|--------|
| `require-guards` (CWE-284) | ❌ No guards anywhere | ✅ Class-level guards on UserController |
| `no-exposed-private-fields` (CWE-200) | ❌ `password` in every response | ✅ `@Exclude()` on password + `ClassSerializerInterceptor` registered |
| `require-throttler` (CWE-770) | ❌ No throttling on login | ❌ No throttling on login |
| `no-missing-validation-pipe` (CWE-20) | ❌ No ValidationPipe | ✅ Global `ValidationPipe` in main.ts (config: `assumeGlobalPipes: true`) |
| `require-class-validator` (CWE-20) | ❌ `role: string` with no `@IsEnum` | ✅ `@IsEmail()`, `@IsString()`, `@IsEnum(UserRole)` |
| `no-exposed-debug-endpoints` (CWE-489) | ❌ `DATABASE_URL` in response | ✅ No debug endpoint generated |

---

## Why the gap

Claude fulfilled the prompt precisely. "Build a users service" describes features. Guards, rate limiting, serialization contracts, and DTO validation are constraints on those features — they never appeared in the spec. Claude generated code that does exactly what it says it does.

Gemini produced the same functional code but included structural security patterns Claude skipped. In this run: guards on the controller, `@Exclude()` on sensitive fields, class-validator on every DTO field. Claude, across multiple documented runs: zero guards, no `@Exclude()`, bare DTO fields.

**The observable difference:** for a prompt that includes an admin panel, Gemini inferred that admin routes need authorization. Claude did not. We can observe the behavior; we can't see why from outside the model.

---

## The finding both got wrong: rate limiting

Neither model added `@Throttle()` to the auth endpoints.

```typescript
// What both generated (auth controller):
@Post('login')
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

No `ThrottlerGuard`. No rate limit. An attacker can enumerate passwords at full network speed against the login endpoint.

**Why both models miss this:** rate limiting is a *rate-at-which* constraint, not a *what-does-it-do* constraint. "Build a login endpoint" describes a function. The spec says nothing about how fast it can be called. Neither model inferred the constraint. Neither will, unless you say so.

The fix is identical regardless of model:

```typescript
// requires @nestjs/throttler@^5
@Post('login')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

---

## Gemini's unique finding: hardcoded JWT secret

Gemini generated a `jwt.constants.ts` file:

```typescript
export const jwtConstants = {
  secret: 'superSecretKey', // Replace with a strong, environment-variable-based secret in production
};
```

Claude wrote inline configuration without an explicit secret. Gemini added an explicit constants file — which is better architecture — and then put a hardcoded string in it. The comment acknowledges the risk. The code ships the risk anyway.

`eslint-plugin-secure-coding/no-hardcoded-credentials` would catch this. It's a different plugin than the one used for the main comparison, but worth noting: Gemini's more structured output surfaced a new class of finding Claude's less structured output avoided by omission.

---

## What this means

Neither toolchain produces security-complete NestJS code from a feature-only prompt. They differ on *which* security features they include by default.

In this run, Gemini treated guards, validators, and serialization exclusion as part of "what a NestJS service is." Claude generated the same features without the security scaffolding — correct code, incomplete security posture.

Both will add throttling, env-variable JWT secrets, and explicit guard wiring if you ask for them. The question is whether you know to ask — and whether you know what you're not asking for.

The rate limiting gap is the finding that answers that question. Gemini passed `require-guards`, `no-exposed-private-fields`, `require-class-validator`; Claude failed all three — but both failed `require-throttler` the same way. That's not a tooling difference. That's a prompt difference. Neither spec said "prevent brute-force attacks on login." So neither output did.

*(For teams that rate-limit at the edge: app-layer `@Throttle()` is defense-in-depth, not redundant. Internal callers, misconfigured ingress, and direct-to-pod paths bypass edge rules. The rule fires on the generated code — what you add upstream is a separate layer.)*

Static analysis asks the negative-space questions your prompt didn't.

---

## The config (runs on output from either model)

```javascript
// eslint.config.mjs
import nestjsSecurity from 'eslint-plugin-nestjs-security';
import secureCoding from 'eslint-plugin-secure-coding';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser }, // Required to parse NestJS decorators
    plugins: {
      'nestjs-security': nestjsSecurity,
      'secure-coding': secureCoding,
    },
    rules: {
      'nestjs-security/require-guards': 'error',
      'nestjs-security/no-exposed-private-fields': 'error',
      'nestjs-security/require-throttler': 'error',
      // Use assumeGlobalPipes: true if you register ValidationPipe in main.ts
      'nestjs-security/no-missing-validation-pipe': ['error', { assumeGlobalPipes: true }],
      'nestjs-security/require-class-validator': 'error',
      'nestjs-security/no-exposed-debug-endpoints': 'error',
      'secure-coding/no-hardcoded-credentials': 'error',
    },
  },
];
```

```bash
npm install --save-dev eslint-plugin-nestjs-security eslint-plugin-secure-coding
npx eslint src/
```

Full rule documentation at [eslint.interlace.tools](https://eslint.interlace.tools/docs/security/plugin-nestjs-security).

---

*Run the same prompt on whichever model you use. What does your linter find? I'm specifically curious whether Gemini's CLI result holds across runs — this is one data point and I want more.*

---

*Part of the [AI Security Benchmark Series](https://dev.to/ofri-peretz/series/ai-security-benchmark-series):*
*← [Claude Wrote a NestJS Service. TypeScript Was Happy. ESLint Found 6 Security Holes.](https://dev.to/ofri-peretz/claude-wrote-a-nestjs-service-typescript-was-happy-eslint-found-6-security-holes-51nj) | [Aggregate Benchmarks Lie →](https://dev.to/ofri-peretz/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain-1hgj)*

---

📦 [`eslint-plugin-nestjs-security`](https://www.npmjs.com/package/eslint-plugin-nestjs-security) · [Rule docs](https://eslint.interlace.tools/docs/security/plugin-nestjs-security)

{% cta https://github.com/ofri-peretz/eslint %}
⭐ Star on GitHub
{% endcta %}

---

[GitHub](https://github.com/ofri-peretz) | [X](https://x.com/ofriperetzdev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [Dev.to](https://dev.to/ofri-peretz) | [ofriperetz.dev](https://ofriperetz.dev)
