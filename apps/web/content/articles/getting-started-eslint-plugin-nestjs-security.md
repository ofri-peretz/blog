---
title: "Architectural Security: The NestJS Static Analysis Standard"
description: "The engineering standard for modern NestJS applications. Detect injection points and architectural flaws automatically using static analysis."
slug: "getting-started-eslint-plugin-nestjs-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-nestjs-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-nestjs-security-32ic"
devto_id: 3144090
published_at: "2026-01-02T19:28:48Z"
edited_at: "2026-01-11T10:21:35Z"
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/nhu1ka6yvpqg0bpuypni.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-nestjs-security.png"
reading_time_minutes: 2
tags:
  - "eslint"
  - "nestjs"
  - "security"
  - "node"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: "The Hardened Stack"
---

**NestJS provides the structure, but developers provide the injection points. Here is the automated static analysis standard for enforcing architectural security across your entire NestJS fleet.**

> This plugin is for **Node.js teams** building APIs with [NestJS](https://nestjs.com/).

## Quick Install

```bash
npm install --save-dev eslint-plugin-nestjs-security
```

## Flat Config

```javascript
// eslint.config.js
import nestjsSecurity from "eslint-plugin-nestjs-security";

export default [nestjsSecurity.configs.recommended];
```

## Rule Overview

| Rule                                                                                                                                 | What it catches                        |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| [`require-guards`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/require-guards)                         | Controllers without @UseGuards         |
| [`require-class-validator`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/require-class-validator)       | DTOs without validation decorators     |
| [`require-throttler`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/require-throttler)                   | Auth endpoints without rate limiting   |
| [`no-exposed-private-fields`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/no-exposed-private-fields)   | Entities without @Exclude on sensitive |
| [`no-missing-validation-pipe`](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules/no-missing-validation-pipe) | @Body without ValidationPipe           |

## Run ESLint

```bash
npx eslint .
```

You'll see output like:

```bash
src/users/users.controller.ts
  12:1  error  🔒 Controller missing @UseGuards decorator
               Fix: Add @UseGuards(AuthGuard) to the controller or method

src/auth/dto/login.dto.ts
  8:3   error  🔒 DTO property 'password' missing validation decorator
               Fix: Add @IsString() @MinLength(8) decorators

src/users/entities/user.entity.ts
  15:3  error  🔒 Sensitive field 'password' not excluded from serialization
               Fix: Add @Exclude() decorator from class-transformer
```

## Quick Wins

### Guards

```typescript
// ❌ Unprotected controller
@Controller('users')
export class UsersController {
  @Get()
  findAll() { ... }
}

// ✅ Protected with guards
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  @Get()
  findAll() { ... }
}
```

### DTO Validation

```typescript
// ❌ No validation
export class CreateUserDto {
  email: string;
  password: string;
}

// ✅ Validated DTO
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

## Custom Configuration

```javascript
// eslint.config.js
import nestjsSecurity from "eslint-plugin-nestjs-security";

export default [
  nestjsSecurity.configs.recommended,
  {
    rules: {
      // Only require guards on specific routes
      "nestjs-security/require-guards": [
        "error",
        {
          excludePatterns: ["health", "public"],
        },
      ],

      // Warn instead of error for throttling
      "nestjs-security/require-throttler": "warn",
    },
  },
];
```

## Strongly-Typed Options (TypeScript)

```typescript
// eslint.config.ts
import nestjsSecurity, {
  type RuleOptions,
} from "eslint-plugin-nestjs-security";

const guardOptions: RuleOptions["require-guards"] = {
  excludePatterns: ["health", "metrics"],
  requireOnMethods: ["POST", "PUT", "DELETE"],
};

export default [
  nestjsSecurity.configs.recommended,
  {
    rules: {
      "nestjs-security/require-guards": ["error", guardOptions],
    },
  },
];
```

## Quick Reference

```bash
# Install
npm install --save-dev eslint-plugin-nestjs-security

# Config (eslint.config.js)
import nestjsSecurity from 'eslint-plugin-nestjs-security';
export default [nestjsSecurity.configs.recommended];

# Run
npx eslint .
```

---

📦 [npm: eslint-plugin-nestjs-security](https://www.npmjs.com/package/eslint-plugin-nestjs-security)
📖 [Full Rule List](https://eslint.interlace.tools/docs/security/plugin-nestjs-security/rules)

::dev-to-cta{url="https://github.com/ofri-peretz/eslint"}
⭐ Star on GitHub
::

---

**The Interlace ESLint Ecosystem**
Interlace is a high-fidelity suite of static code analyzers designed to automate security, performance, and reliability for the modern Node.js stack. With over 330 rules across 18 specialized plugins, it provides 100% coverage for OWASP Top 10, LLM Security, and Database Hardening.

## [Explore the full Documentation](https://eslint.interlace.tools)

© 2026 Ofri Peretz. All rights reserved.

---

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
