---
title: "NestJS Hands You Guards, Pipes, and Throttlers. You — and Your AI — Ship Controllers Without Them. 6 ESLint Rules Catch It."
description: "A NestJS controller with no @UseGuards is wide open; a handler with no ValidationPipe takes raw input; an entity returned directly leaks the password hash. The decorator you forgot is invisible — and the AI you paste from forgets it every time. 6 CWE-mapped ESLint rules that catch it in CI."
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

**14 findings on ~30 lines of a NestJS controller — before I touched a single
line.** I pasted in the most boring "users service" an AI assistant will hand
you, ran one ESLint config, and got 4 errors and 10 warnings on code that
compiles clean and looks like a senior wrote it. **I would have approved it in
review, too** — and that's the whole problem.

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
— different models leave _different_ gaps, but the unthrottled login route
survived **both**. And it isn't a NestJS quirk: across a
[700-function benchmark spanning 5 AI models](https://ofriperetz.dev/articles/aggregate-benchmarks-lie-heres-what-700-ai-functions-look-like-by-security-domain)
the [vulnerability rate held at 65–75%](https://ofriperetz.dev/articles/i-let-claude-write-60-functions-65-75-had-security-vulnerabilities)
— with **no statistically significant difference between models** (χ² = 0.640,
p > 0.05). Two out of three functions an assistant hands you carry a security
gap, and "missing authorization" is one of the most common shapes that gap
takes. The model isn't broken; insecure-by-default is a property of generation
itself, which is exactly why this belongs in CI and not in your reviewer's head.

`eslint-plugin-nestjs-security` is **6 rules** that read your decorators and
fail CI when the protection you have available isn't wired up — each pinned to
a CWE. It doesn't care whether a human or a model left the decorator off; it
checks the AST either way. The 14 findings I opened with were **5 of the 6 rules
firing** on that one generated controller — the verbatim output and the exact
file that produced it are [a few sections down](#run-it-on-the-ai-s-output), and
it reproduces in one install.

This guide covers how the guard rule walks the controller AST, the validation
pair, the things you accidentally expose, the full 6-rule map, that
reproducible scan, and exact install/engine support — and, for each rule, why
the gap survives both an AI and the human reviewing its output. If you want to
point it at your own AI-generated controllers before reading further, it's one
install — [config is below](#install).

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

**Why this survives review.** Nobody scans a controller and asks "is there a
guard on this handler?"; they ask "does the logic look right?" The guard is off
the mental stack — the team _has_ a `JwtAuthGuard` registered somewhere, or
reviewers think it does. The handler body is correct, the DTO is typed, the
service call is named well — approve. An AI omits it for the mirror reason:
"only admins can list users" is a _negation_ of the default the prompt never
asked for. (The longer version, with a 2-year-old codebase where every PR
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
`ValidationPipe` re-enforces them on the way in. A reviewer reading
`@Body() dto: CreateUserDto` sees a typed parameter and pattern-matches "this is
validated" — the compiler agreed, after all — but compile-time shape and runtime
enforcement are different claims, and the gap isn't in the diff. The subtler
miss: even when the DTO _does_ carry `@IsEmail()` on `email`, nobody audits
field-by-field for the one bare `role: string` that lets a request body promote
itself to admin. An assistant reproduces both — it validates the obvious
semantic types and leaves domain enums like `role` bare, because the prompt
never named the allowed values.

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
miss on AI-generated NestJS — and the one I opened this article admitting I'd
wave through. The entity type is `User`, the controller returns `User`,
TypeScript shows no errors, so the reviewer sees typed, structured data and
approves. What they never see is the JSON shape at runtime: they're reading
code, not running `curl` against staging, and `@Exclude()` only means anything
inside Nest's response lifecycle, which the diff doesn't show. Rate limiting
slips for a different reason entirely — it reads as an infra concern ("nginx
handles it"), so its absence in application code never gets flagged.

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

## Run it on the AI's output

Claims are cheap, so here's the reproducible version. I asked for the most
generic NestJS users controller imaginable — typed DTO, wired DI, the right
route decorators, a login route — and pasted the result verbatim into a file.
No editing, no "make it insecure." This is what one prompt produces:

```ts
// users.controller.ts — verbatim from "build me a NestJS users service"
export class CreateUserDto {
  email: string;
  password: string;
  role: string;
}

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get() findAll(): Promise<User[]> { return this.users.findAll(); }
  @Post() create(@Body() dto: CreateUserDto): Promise<User> { return this.users.create(dto); }
  @Post("login") login(@Body() dto: CreateUserDto) { return this.users.login(dto.email, dto.password); }
  @Delete(":id") remove(@Param("id") id: string) { return this.users.remove(id); }
}
```

Thirty lines. Compiles clean, types check, looks like a senior wrote it. Save it
as `src/users.controller.ts`, point `configs.recommended` at it (ESLint 10.4.1,
the built plugin, the `@typescript-eslint` parser, nothing else configured), and
run `npx eslint "src/**/*.ts"`. This is the **verbatim** emitted output — every
line copied from the run, not paraphrased:

```text
src/users.controller.ts
   2:3   warning  🔒 CWE-20 OWASP:A03-Injection CVSS:7.5 | DTO property "email" lacks class-validator decorators | MEDIUM [SOC2,PCI-DSS,HIPAA,GDPR]      nestjs-security/require-class-validator
   3:3   warning  🔒 CWE-20 OWASP:A03-Injection CVSS:7.5 | DTO property "password" lacks class-validator decorators | MEDIUM [SOC2,PCI-DSS,HIPAA,GDPR]   nestjs-security/require-class-validator
   3:3   warning  🔒 CWE-200 OWASP:A01-Broken CVSS:7.5 | Sensitive field "password" may be exposed in API responses | HIGH                              nestjs-security/no-exposed-private-fields
   4:3   warning  🔒 CWE-20 OWASP:A03-Injection CVSS:7.5 | DTO property "role" lacks class-validator decorators | MEDIUM [SOC2,PCI-DSS,HIPAA,GDPR]       nestjs-security/require-class-validator
  11:3   error    🔒 CWE-284 OWASP:A01-Broken CVSS:9.8 | Controller/route handler findAll lacks @UseGuards for access control | CRITICAL              nestjs-security/require-guards
  11:3   warning  🔒 CWE-770 CVSS:7.5 | Controller findAll lacks rate limiting protection (Throttler) | HIGH                                          nestjs-security/require-throttler
  12:3   error    🔒 CWE-284 OWASP:A01-Broken CVSS:9.8 | Controller/route handler create lacks @UseGuards for access control | CRITICAL               nestjs-security/require-guards
  12:3   warning  🔒 CWE-770 CVSS:7.5 | Controller create lacks rate limiting protection (Throttler) | HIGH                                           nestjs-security/require-throttler
  12:26  warning  🔒 CWE-20 OWASP:A06-Insecure CVSS:8.6 | Parameter @Body() dto receives user input without ValidationPipe | HIGH [SOC2,PCI-DSS,HIPAA,GDPR]  nestjs-security/no-missing-validation-pipe
  13:3   error    🔒 CWE-284 OWASP:A01-Broken CVSS:9.8 | Controller/route handler login lacks @UseGuards for access control | CRITICAL                nestjs-security/require-guards
  13:3   warning  🔒 CWE-770 CVSS:7.5 | Controller login lacks rate limiting protection (Throttler) | HIGH                                            nestjs-security/require-throttler
  13:32  warning  🔒 CWE-20 OWASP:A06-Insecure CVSS:8.6 | Parameter @Body() dto receives user input without ValidationPipe | HIGH [SOC2,PCI-DSS,HIPAA,GDPR]  nestjs-security/no-missing-validation-pipe
  14:3   error    🔒 CWE-284 OWASP:A01-Broken CVSS:9.8 | Controller/route handler remove lacks @UseGuards for access control | CRITICAL               nestjs-security/require-guards
  14:3   warning  🔒 CWE-770 CVSS:7.5 | Controller remove lacks rate limiting protection (Throttler) | HIGH                                           nestjs-security/require-throttler

✖ 14 problems (4 errors, 10 warnings)
```

**14 findings, 4 of them CWE-284 errors, on code that passed `tsc`.** Five of the
six rules fired — only `no-exposed-debug-endpoints` stayed quiet, because this
particular prompt didn't ask for a debug route. The four errors are every
handler reachable with no guard, `login` and `DELETE /users/:id` included;
`password` trips two separate rules (no validator, plus exposed-in-response the
moment that DTO doubles as a response shape); and `role`, a bare `string`, is one
request body away from privilege escalation. This isn't a curated worst case —
it's the default output, and it's why I stopped treating these rules as
nice-to-have. Swap in your own last AI-generated controller; the file:line
numbers change, the shape of the report rarely does.

> **Reproducibility (this exact run).** Plugin `eslint-plugin-nestjs-security`
> `configs.recommended`, ESLint `10.4.1`, `@typescript-eslint/parser`, run with
> `npx eslint "src/**/*.ts"` against the controller printed above and nothing
> else configured. The block is **verbatim** — those are the rules' real
> `formatLLMMessage` strings, including the OWASP token and `CVSS`. (The OWASP
> category is enriched from each rule's CWE, so `require-guards` → `CWE-284`
> surfaces `OWASP:A01-Broken`; `require-throttler` carries no OWASP mapping, so
> it emits `CWE-770` alone — exactly as you see.) To reproduce these 14 lines
> yourself: paste the controller above into `src/users.controller.ts`, drop in
> the flat config from [Install](#install) (add `@typescript-eslint/parser` so
> ESLint reads the decorators), and run `npx eslint "src/**/*.ts"`. Per-rule
> message anatomy is in the
> [rule docs](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-nestjs-security/docs/rules).
> LLM output is non-deterministic, so on _your_ generation the **counts and line
> numbers will differ** — what stays stable is the finding _class_, not the
> position. Same thing I saw scanning a real
> [40K-line inherited NestJS codebase: 47 violations across the same 6 classes in 12 seconds](https://ofriperetz.dev/articles/i-inherited-a-nestjs-codebase-the-first-lint-run-found-6-vulnerabilities)
> — different source, same six shapes.

### Different model, same six rules

The scan above was one Claude generation. In a separate head-to-head I gave the
**identical prompt to Claude Sonnet 4.6 and Gemini 2.5 Flash** (via the Gemini
CLI) and pointed the same `configs.recommended` at each output. The difference
was stark: Claude's controller tripped **all six** of these rules; **Gemini's
tripped only one — `require-throttler`.** Gemini applied a class-level
`@UseGuards(JwtAuthGuard, RolesGuard)`, put `@Exclude()` on `password`,
decorated the DTO with `@IsEmail()` / `@IsEnum(UserRole)`, and wired a global
`ValidationPipe` — so guards, serialization, and validation all stayed quiet on
its output. But **both models shipped the same login endpoint with no
`@Throttle`**, so `require-throttler` fired on both, identically. The toolchain
you scaffold with changes _which_ gaps you inherit; it doesn't change _whether_
you inherit them, and the rules are the constant that reads both. The full
side-by-side — every rule, both models, plus the `secure-coding` hardcoded-secret
rule that took Claude's total to 6 errors and Gemini's to 2 — is in
[Same NestJS Prompt, Claude Got 6 Errors, Gemini Got 2](https://ofriperetz.dev/articles/claude-vs-gemini-nestjs-security-same-prompt-different-errors).

> **Running this as a Gemini benchmark?** The methodology drops straight into a
> [Build-with-Gemini](https://dev.to/challenges) submission: scaffold a service
> with the Gemini CLI, run `configs.recommended`, and report the rule-by-rule
> findings as original security-evaluation data — swap these tags for
> `#googleai #geminichallenge`. The plugin is the measuring instrument; the
> model under test is the variable.

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

Flat config (`eslint.config.mjs`) — the rules read decorators, so pair them with
the TypeScript parser (this is the exact config behind the scan above):

```js
// `configs` is a NAMED export; the default export is the plugin object.
import { configs } from "eslint-plugin-nestjs-security";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts"],
    languageOptions: { parser: tsParser, parserOptions: { sourceType: "module" } },
  },
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

Every finding is two lines — the standards header plus a concrete `Fix:` line
(the trailing `| <docs-url>` is elided here for width):

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
| **Oxlint**           | Loads under Oxlint's JS-plugin runner via the package's own sub-export — `{ "jsPlugins": ["eslint-plugin-nestjs-security/oxlint"] }`. ESLint↔Oxlint finding-level parity runs in the repo's [Oxlint Parity Gate](https://github.com/ofri-peretz/eslint/blob/main/.github/workflows/oxlint-parity.yml) across every plugin. The full 6-rule set runs on ESLint today. |

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
> where every PR approved the gap. The pattern AI reintroduces faster than you
> can review it is the broader thesis in
> [The AI Hydra Problem](https://ofriperetz.dev/articles/the-ai-hydra-problem-fix-one-ai-bug-get-two-more);
> the [5-model security leaderboard](https://ofriperetz.dev/articles/we-ranked-5-ai-models-by-security-the-leaderboard-is-wrong)
> shows the gap is model-agnostic; and the
> [30-minute security audit](https://ofriperetz.dev/articles/the-30-minute-security-audit-onboarding-a-new-codebase)
> applies the same "scan first, read later" protocol to a whole repo.

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
