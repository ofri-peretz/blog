import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
// ────────────────────────────────────────────────────────────────────────────
// Interlace ecosystem — à-la-carte dogfooding, mirroring apps/blog.
//
// engage shipped 152 source files with NO eslint config and no `lint` task,
// so `turbo run lint` skipped it silently — a whole Next.js app, API routes
// included, linted by nothing while the repo next door dogfooded twelve of
// our own plugins. That is the worst possible advertisement for them.
//
// Same split as apps/blog, for the same reasons:
//   nine plugins expose a working flat `configs.recommended`, spread as-is;
//   three ship a BROKEN `recommended` on npm (doubled-namespace / categorized
//   rule names flat config cannot resolve) and are hand-wired below.
//
// engage has no SDK dependencies (no @anthropic-ai/sdk, openai, pg, mongodb,
// jsonwebtoken …), so none of the domain-security plugins apply here. Add the
// matching plugin at the same time as the dependency, not later.
// ────────────────────────────────────────────────────────────────────────────
import { configs as browserSecurityCfg } from "eslint-plugin-browser-security";
import { configs as conventionsCfg } from "eslint-plugin-conventions";
import { configs as importNextCfg } from "eslint-plugin-import-next";
import maintainability from "eslint-plugin-maintainability";
import { configs as modernizationCfg } from "eslint-plugin-modernization";
import { configs as modularityCfg } from "eslint-plugin-modularity";
import { configs as nodeSecurityCfg } from "eslint-plugin-node-security";
import operability from "eslint-plugin-operability";
import { configs as reactA11yCfg } from "eslint-plugin-react-a11y";
import reactFeatures from "eslint-plugin-react-features";
import { configs as reliabilityCfg } from "eslint-plugin-reliability";
import { configs as secureCodingCfg } from "eslint-plugin-secure-coding";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  // ── Next.js (KEEP FIRST) ──────────────────────────────────────────────────
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Synced from the Interlace registry — fix upstream, not here. Same
    // carve-out apps/blog makes for its vendored components.
    "src/components/ui/**",
    "public/**",
  ]),

  // ── Interlace à-la-carte recommended presets (9 clean plugins) ────────────
  browserSecurityCfg.recommended,
  secureCodingCfg.recommended,
  nodeSecurityCfg.recommended,
  conventionsCfg.recommended,
  importNextCfg.recommended,
  modernizationCfg.recommended,
  modularityCfg.recommended,
  reliabilityCfg.recommended,

  // react-a11y: WCAG 2.1 A/AA — spread recommended, scoped to TSX.
  {
    ...reactA11yCfg.recommended,
    files: ["**/*.tsx"],
  },

  // ── Hand-wired: maintainability + operability (broken published recommended)
  {
    plugins: { maintainability, operability },
    rules: {
      "maintainability/cognitive-complexity": "warn",
      "maintainability/identical-functions": "warn",
      "maintainability/max-parameters": "warn",
      "operability/no-console-log": "warn",
      "operability/no-debug-code-in-production": "error",
      "operability/no-verbose-error-messages": "warn",
    },
  },

  // ── Hand-wired: react-features (broken published recommended), TSX only ────
  {
    files: ["**/*.tsx"],
    plugins: { "react-features": reactFeatures },
    rules: {
      "react-features/jsx-key": "error",
      "react-features/no-children-prop": "warn",
      "react-features/no-danger": "warn",
      "react-features/no-string-refs": "error",
      "react-features/no-unknown-property": "warn",
      "react-features/hooks-exhaustive-deps": "warn",
      "react-features/jsx-no-target-blank": "error",
      "react-features/jsx-no-script-url": "error",
      "react-features/jsx-no-duplicate-props": "error",
      "react-features/no-danger-with-children": "error",
      "react-features/no-deprecated": "warn",
      "react-features/no-unnecessary-rerenders": "warn",
      "react-features/react-render-optimization": "warn",
    },
  },

  // ── Baseline (non-blocking) ───────────────────────────────────────────────
  // First lint of a 152-file app that had never been linted: 5,614 findings,
  // 664 of them errors. Same doctrine apps/blog follows — baseline the
  // pre-existing set at `warn` so the task can gate at all, then ratchet each
  // rule to `error` as the app is cleaned. A gate that cannot pass is not a
  // gate; a gate that passes today and fails on the NEXT violation is.
  //
  // Counts are from the first run and are here so the ratchet has a number to
  // beat, not as decoration.
  {
    rules: {
      // 379 — engage is untyped in places; the honest fix is types, not a
      // rule change.
      "@typescript-eslint/no-explicit-any": "warn",
      // 71 — src/lib/* fetch directly. Real finding, real refactor.
      "modularity/no-external-api-calls-in-utils": "warn",
      // 33 — console/debug left in shipped code.
      "operability/no-debug-code-in-production": "warn",
      // 30 — fetch without a timeout, in an app whose whole job is calling
      // other people's APIs.
      "reliability/require-network-timeout": "warn",
      // 15
      "secure-coding/no-improper-sanitization": "warn",
      // 12
      "browser-security/no-clickjacking": "warn",
      // 8
      "react-hooks/set-state-in-effect": "warn",
      /*
       * 5 — SUSPECTED FALSE POSITIVE, not a finding. Every one is a numeric
       * `reduce` accumulator: `pairs.reduce((s, p) => s + p[0], 0)` inside
       * `pearson()`, a correlation coefficient. There is no XPath, no XML and
       * no sink call anywhere near them, and the rule reports CVSS 9.8.
       *
       * Baselined rather than disabled so it stays visible, and filed against
       * the plugin with the exact lines. If it is confirmed a bug, this entry
       * disappears with the fix rather than being silently kept.
       */
      "secure-coding/no-xpath-injection": "warn",
    },
  },

  // ── The last fifteen, each named ─────────────────────────────────────────
  // Small enough to list, so none of them hides in a count. Three are
  // suspected false positives and are filed as such; the rest are real and
  // are the ratchet's first targets.
  {
    rules: {
      /*
       * REAL, and accepted for now. `api/spawn/route.ts` shells out via
       * `execFileSync("osascript", [...])` to open a Claude session from the
       * board. engage is LOCAL-ONLY — no Vercel project, no vercel.json, in
       * no deploy workflow — and the route takes its repo from a fixed
       * allowlist and passes argv rather than a shell string. If engage is
       * ever deployed, this becomes remote code execution and must be gated
       * on the environment first.
       */
      "node-security/detect-child-process": "warn",
      /*
       * REAL. Two `existsSync` → read races in control-bands.mjs and
       * prs/update. Local tooling, low consequence, worth fixing.
       */
      "node-security/no-toctou-vulnerability": "warn",
      /*
       * SUSPECTED FALSE POSITIVE. Both hits are `http://` inside a STRING in
       * a node script — control-bands.mjs and smoke.mjs — not a resource a
       * browser loads. "Mixed content" is a browser concept and these files
       * never reach one.
       */
      "browser-security/detect-mixed-content": "warn",
      /*
       * SUSPECTED FALSE POSITIVE. `queue/page.tsx` line 16 is
       * `const TONE: Record<Gate, string> = { pass: "text-[var(--success)]" }`
       * — a Tailwind class map. The rule appears to match the KEY `pass` as
       * in password, and reports CVSS 9.8 on a colour token.
       */
      "secure-coding/no-hardcoded-credentials": "warn",
      /*
       * REAL. `require("node:sqlite")` in an ESM route, deliberate because
       * the module is still experimental — worth a comment and a disable at
       * the line rather than a repo-wide allowance, once someone confirms.
       */
      "@typescript-eslint/no-require-imports": "warn",
    },
  },

  // React plugins register only for TSX above, so their baseline has to be
  // scoped the same way — a bare rules block references a namespace that is
  // not in scope for .ts files and ESLint refuses to load the config at all.
  {
    files: ["**/*.tsx"],
    rules: {
      // 82 across three rules — GENUINE keyboard-accessibility bugs: click
      // handlers with no key handler, interactive elements not focusable.
      // The highest-value group in this baseline and the first to ratchet.
      "react-a11y/interactive-supports-focus": "warn",
      "react-a11y/click-events-have-key-events": "warn",
      "react-a11y/role-supports-aria-props": "warn",
      // 8
      "react-features/jsx-key": "warn",
      /*
       * REAL React bugs, and the most valuable thing this first lint found:
       *   purity      — `Date.now()` called during render (network-graph,
       *                 panels). Non-deterministic render; a hydration
       *                 mismatch waiting to happen.
       *   refs        — refs read during render in series-chart.
       *   immutability— a value modified after being used previously.
       * Baselined only so the gate can exist at all. These three should be
       * the first rules ratcheted back to `error`.
       */
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      // Two apostrophes in copy.
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
