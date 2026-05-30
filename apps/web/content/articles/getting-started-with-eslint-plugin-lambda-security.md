---
title: "Serverless Security: The AWS Lambda Static Analysis Standard"
description: "Engineering safety into the serverless stack. Automated static analysis for AWS Lambda to prevent event injection and IAM misconfigurations."
slug: "getting-started-with-eslint-plugin-lambda-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-with-eslint-plugin-lambda-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-lambda-security-44h8"
devto_id: 3144087
published_at: "2026-01-02T19:26:45Z"
edited_at: "2026-02-05T06:02:24Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fgetting-started-with-eslint-plugin-lambda-security.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-with-eslint-plugin-lambda-security.png"
reading_time_minutes: 4
tags:
  - "eslint"
  - "aws"
  - "lambda"
  - "serverless"
reactions: 0
comments: 0
views: 0
author:
  name: "Ofri Peretz"
  username: "ofri-peretz"
  avatar: "https://media2.dev.to/dynamic/image/width=640,height=640,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Fuser%2Fprofile_image%2F3669992%2F50a1f256-472c-48a1-85e8-149459647ea7.png"
  twitter: "ofriperetzdev"
series: null
---

**Serverless architectures introduce unique event injection risks. Here is the engineering standard for hardening AWS Lambda through automated static analysis, ensuring safety at the handler level.**

## Who Is This For?

This plugin is for **Node.js teams** building serverless applications on AWS:

| Framework                                                                                                                     | Description                                            |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [AWS Lambda](https://aws.amazon.com/lambda/)                                                                                  | Native function handlers                               |
| [Serverless Framework](https://www.serverless.com/framework/docs/)                                                            | Most popular serverless deployment tool                |
| [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) | AWS-native IaC for Lambda                              |
| [Middy.js](https://middy.js.org/)                                                                                             | Middleware engine for Lambda (we have specific rules!) |

If you deploy functions to Lambda — whether via CDK, SAM, Serverless Framework, or raw CloudFormation — this plugin catches security issues before they reach production.

## Quick Install

```bash
npm install --save-dev eslint-plugin-lambda-security
```

## Flat Config

```javascript
// eslint.config.js
import lambdaSecurity from "eslint-plugin-lambda-security";

export default [lambdaSecurity.configs.recommended];
```

## Rule Overview

Based on the [OWASP Serverless Top 10](https://owasp.org/www-project-serverless-top-10/):

| Rule                                                                                                                                           | OWASP   | What it catches        |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------- |
| [`no-unvalidated-event-body`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-unvalidated-event-body)             | S1, S10 | Injection via event    |
| [`no-missing-authorization-check`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-missing-authorization-check)   | S2      | No auth in handlers    |
| [`no-exposed-error-details`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-exposed-error-details)               | S3      | Stack traces in errors |
| [`no-unbounded-batch-processing`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-unbounded-batch-processing)     | S4      | Large batch DoS        |
| [`no-overly-permissive-iam-policy`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-overly-permissive-iam-policy) | S5      | `*` in IAM             |
| [`no-permissive-cors-response`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-permissive-cors-response)         | S6      | CORS misconfiguration  |
| [`no-error-swallowing`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-error-swallowing)                         | S7      | Empty catch blocks     |
| [`no-secrets-in-env`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-secrets-in-env)                             | S8      | Secrets in env vars    |
| [`no-user-controlled-requests`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-user-controlled-requests)         | S9      | SSRF                   |
| [`no-env-logging`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-env-logging)                                   | S3      | Env logged             |
| [`no-hardcoded-credentials-sdk`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-hardcoded-credentials-sdk)       | S8      | AWS creds in code      |
| [`no-permissive-cors-middy`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/no-permissive-cors-middy)               | S6      | Middy CORS             |
| [`require-timeout-handling`](https://eslint.interlace.tools/docs/security/plugin-lambda-security/rules/require-timeout-handling)               | S4      | No timeout fallback    |

## Run ESLint

```bash
npx eslint .
```

You'll see output like:

```bash
src/handlers/api.ts
  12:5  error  🔒 OWASP-S3 | Error details exposed to client
               Fix: Return generic error message, log details internally

src/handlers/batch.ts
  28:3  error  🔒 OWASP-S4 | Unbounded batch processing detected
               Fix: Add batch size limit: records.slice(0, 100)

src/config/cors.ts
  8:1   error  🔒 OWASP-S6 | Permissive CORS origin '*'
               Fix: Specify allowed origins: ['https://app.example.com']
```

## Quick Wins

### Error Handling

```javascript
// ❌ Dangerous: Exposes stack trace
export const handler = async (event) => {
  try {
    return await processEvent(event);
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.stack }) };
  }
};

// ✅ Safe: Generic error, internal logging
export const handler = async (event) => {
  try {
    return await processEvent(event);
  } catch (error) {
    console.error("Handler error:", error); // Logged to CloudWatch
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal error" }),
    };
  }
};
```

### CORS Configuration

```javascript
// ❌ Dangerous: Wildcard origin
return {
  statusCode: 200,
  headers: { "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify(data),
};

// ✅ Safe: Explicit origin
return {
  statusCode: 200,
  headers: { "Access-Control-Allow-Origin": "https://app.example.com" },
  body: JSON.stringify(data),
};
```

## Custom Configuration

Add specific rules or customize options:

```javascript
// eslint.config.js
import lambdaSecurity from "eslint-plugin-lambda-security";

export default [
  lambdaSecurity.configs.recommended,
  {
    rules: {
      // Override severity
      "lambda-security/no-error-swallowing": "warn",

      // Configure with options
      "lambda-security/no-unbounded-batch-processing": [
        "error",
        {
          maxBatchSize: 50,
        },
      ],

      // Disable a rule
      "lambda-security/no-env-logging": "off",
    },
  },
];
```

## Strongly-Typed Options (TypeScript)

The plugin exports types for IDE autocompletion:

```typescript
// eslint.config.ts
import lambdaSecurity, {
  type RuleOptions,
} from "eslint-plugin-lambda-security";

const batchOptions: RuleOptions["no-unbounded-batch-processing"] = {
  maxBatchSize: 100,
  allowedSources: ["SQS", "Kinesis"],
};

export default [
  lambdaSecurity.configs.recommended,
  {
    rules: {
      "lambda-security/no-unbounded-batch-processing": ["error", batchOptions],
    },
  },
];
```

## Quick Reference

```bash
# Install
npm install --save-dev eslint-plugin-lambda-security

# Config (eslint.config.js)
import lambdaSecurity from 'eslint-plugin-lambda-security';
export default [lambdaSecurity.configs.recommended];

# Run
npx eslint .
```

---

📦 [npm: eslint-plugin-lambda-security](https://www.npmjs.com/package/eslint-plugin-lambda-security)
📖 [OWASP Serverless Mapping](https://github.com/ofri-peretz/eslint/tree/main/packages/eslint-plugin-lambda-security#owasp-serverless)

**[⭐ Star on GitHub](https://github.com/ofri-peretz/eslint)**

---

**The Interlace ESLint Ecosystem**
Interlace is a high-fidelity suite of static code analyzers designed to automate security, performance, and reliability for the modern Node.js stack. With over 330 rules across 18 specialized plugins, it provides 100% coverage for OWASP Top 10, LLM Security, and Database Hardening.

## [Explore the full Documentation](https://eslint.interlace.tools)

© 2026 Ofri Peretz. All rights reserved.

---

**Build Securely.**
I'm Ofri Peretz, a Security Engineering Leader and the architect of the Interlace Ecosystem. I build static analysis standards that automate security and performance for Node.js fleets at scale.

[ofriperetz.dev](https://ofriperetz.dev) | [LinkedIn](https://linkedin.com/in/ofri-peretz) | [GitHub](https://github.com/ofri-peretz)
