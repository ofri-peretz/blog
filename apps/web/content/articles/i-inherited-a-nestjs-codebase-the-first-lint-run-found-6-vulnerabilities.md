---
title: "I Inherited a NestJS Codebase. The First Lint Run Found 6 Vulnerabilities."
description: "The codebase had 2 years of feature PRs and zero security audits. In 30 minutes, a fresh ESLint run surfaced 6 distinct vulnerability classes — auth bypass, sensitive field leaks, brute-force exposure, and three more. Here's what each one looks like and why it survived code review."
slug: "i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities"
canonical_url: "https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities"
devto_url: "https://dev.to/ofri-peretz/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities-55ma"
devto_id: 3769186
published_at: "2026-05-28"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/jr9sy2gzvsl2w7j2uuvi.png"
social_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/jr9sy2gzvsl2w7j2uuvi.png"
reading_time_minutes: 8
tags:
  - "nestjs"
  - "security"
  - "node"
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

The first run of `eslint-plugin-nestjs-security` on a 40K-line production codebase took 12 seconds. It found 47 violations. Here are all 6 — and exactly why each one survived code review.

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

## 3. Auth Endpoints Without Rate Limiting (CWE-307)

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

**What the lint rule catches:** `require-throttler` flags any `@Controller` or route handler that doesn't have `@Throttle(...)` or `ThrottlerGuard` in its guard chain.

```typescript
// requires @nestjs/throttler@^4
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute
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

## 6. Debug Endpoints Left in Production (CWE-215)

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

**What the lint rule catches:** `no-exposed-debug-endpoints` flags controllers with paths matching `debug`, `internal`, or `_health` that lack auth guards, and any endpoint that returns `process.env` directly.

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
// Note: health endpoints are intentionally public (LBs can't auth).
// The rule won't fire here because the path is 'health', not 'debug'.

```

---

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
npx eslint src/
```

---

## The connection between #4 and #5

Bugs 4 and 5 interact. `whitelist: true` on the `ValidationPipe` strips the `role: 'admin'` attack — but only if the pipe is actually registered (bug #4). Without it, even a perfectly decorated DTO is runtime-permissive. The two rules catch the issues independently; fixing one without the other leaves a gap. Run both checks.

---

_Which of these six hit production before anyone noticed — and how did you find out? Drop the worst one below._

---

📦 [`eslint-plugin-nestjs-security`](https://www.npmjs.com/package/eslint-plugin-nestjs-security) — 6 security rules for NestJS

{% cta <https://github.com/ofri-peretz/eslint> %}
⭐ Star on GitHub
{% endcta %}

---

[GitHub](https://github.com/ofri-peretz) | [X](https://x.com/ofriperetzdev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [Dev.to](https://dev.to/ofri-peretz)
