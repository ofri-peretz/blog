---
title: "Frontend Protection: The Browser Static Analysis Standard"
description: "Protect the frontend host. Use automated static analysis to detect localStorage leaks and XSS sinks in professional JS architectures."
slug: "getting-started-eslint-plugin-browser-security"
canonical_url: "https://ofriperetz.dev/articles/getting-started-eslint-plugin-browser-security"
devto_url: "https://dev.to/ofri-peretz/getting-started-with-eslint-plugin-browser-security-3iop"
devto_id: 3143592
published_at: "2026-01-02T15:20:36Z"
edited_at: "2026-01-11T10:21:38Z"
cover_image: "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fofriperetz.dev%2Fcdn%2Fblog-cover-image%2Fgetting-started-eslint-plugin-browser-security.png"
social_image: "https://ofriperetz.dev/cdn/blog-cover-image/getting-started-eslint-plugin-browser-security.png"
reading_time_minutes: 2
tags:
  - "eslint"
  - "javascript"
  - "security"
  - "browser"
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

**The frontend host is the primary target for modern XSS. Here is the automated static analysis standard for browser security, protecting your users from localStorage leaks and insecure sinks.**

## Quick Install

```bash
npm install --save-dev eslint-plugin-browser-security
```

## Flat Config

```javascript
// eslint.config.js
import browserSecurity from "eslint-plugin-browser-security";

export default [browserSecurity.configs.recommended];
```

## Rule Overview

| Category         | Rules | Examples                                             |
| ---------------- | ----- | ---------------------------------------------------- |
| XSS Prevention   | 7     | no-innerhtml, no-eval, no-websocket-innerhtml        |
| Storage Security | 4     | no-sensitive-localstorage, no-jwt-in-storage         |
| postMessage      | 3     | no-postmessage-wildcard-origin, require-origin-check |
| Cookie Security  | 2     | require-cookie-secure-attrs, no-sensitive-cookie-js  |
| CSP              | 2     | no-unsafe-inline-csp, no-unsafe-eval-csp             |
| Other            | 3     | require-websocket-wss, require-blob-url-revocation   |

## Run ESLint

```bash
npx eslint .
```

You'll see output like:

```bash
src/components/preview.tsx
  42:5  error  🔒 CWE-79 CVSS:6.1 | innerHTML is XSS vulnerable
               Fix: Use textContent or sanitize with DOMPurify

src/utils/storage.ts
  18:3  error  🔒 CWE-922 | Storing JWT in localStorage is insecure
               Fix: Use httpOnly cookies or sessionStorage with expiry

src/messaging/iframe.ts
  31:1  error  🔒 CWE-345 | postMessage with '*' origin is dangerous
               Fix: Specify exact origin: postMessage(data, 'https://trusted.com')
```

## Quick Wins

### XSS Prevention

```javascript
// ❌ Dangerous: XSS vulnerability
element.innerHTML = userInput;

// ✅ Safe: Use textContent
element.textContent = userInput;

// ✅ Safe: Sanitize HTML
import DOMPurify from "dompurify";
element.innerHTML = DOMPurify.sanitize(userInput);
```

### Storage Security

```javascript
// ❌ Dangerous: JWT in localStorage
localStorage.setItem("token", jwt);

// ✅ Better: Use httpOnly cookies (server-side)
// Or if you must use storage:
sessionStorage.setItem("token", jwt); // Clears on tab close
```

### postMessage Security

```javascript
// ❌ Dangerous: Wildcard origin
window.parent.postMessage(data, "*");

// ✅ Safe: Explicit origin
window.parent.postMessage(data, "https://trusted-parent.com");

// ✅ Safe: Origin validation in listener
window.addEventListener("message", (event) => {
  if (event.origin !== "https://trusted-sender.com") return;
  // Handle message
});
```

```bash
# Install
npm install --save-dev eslint-plugin-browser-security

# Config (eslint.config.js)
import browserSecurity from 'eslint-plugin-browser-security';
export default [browserSecurity.configs.recommended];

# Run
npx eslint .
```

---

📦 [npm: eslint-plugin-browser-security](https://www.npmjs.com/package/eslint-plugin-browser-security)
📖 [Full Rule List](https://eslint.interlace.tools/docs/security/plugin-browser-security/rules)

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
