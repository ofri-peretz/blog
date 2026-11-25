import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ────────────────────────────────────────────────────────────────────────────
// Interlace ecosystem — à-la-carte dogfooding. Each plugin is wired separately
// via its OWN `recommended` preset (NOT the @interlace/eslint-config meta-config),
// on the current majors, where every preset loads as published:
//   security — browser-security, secure-coding, node-security
//   quality —  conventions, import-next, maintainability, modernization,
//             modularity, operability, reliability
//   react —    react-a11y, react-features (+ componentApi), TSX only
// ────────────────────────────────────────────────────────────────────────────
import { configs as browserSecurityCfg } from "eslint-plugin-browser-security";
import { configs as secureCodingCfg } from "eslint-plugin-secure-coding";
import { configs as nodeSecurityCfg } from "eslint-plugin-node-security";
import { configs as conventionsCfg } from "eslint-plugin-conventions";
import { configs as importNextCfg } from "eslint-plugin-import-next";
import { configs as modernizationCfg } from "eslint-plugin-modernization";
import { configs as modularityCfg } from "eslint-plugin-modularity";
import { configs as reliabilityCfg } from "eslint-plugin-reliability";
import { configs as reactA11yCfg } from "eslint-plugin-react-a11y";
import { configs as maintainabilityCfg } from "eslint-plugin-maintainability";
import { configs as operabilityCfg } from "eslint-plugin-operability";
import { configs as reactFeaturesCfg } from "eslint-plugin-react-features";
import { configs as truepass } from "truepass/eslint";

const eslintConfig = defineConfig([
  // ── Next.js (KEEP FIRST) ──────────────────────────────────────────────────
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Synced from interlace/docs-baseline — fix upstream, not here.
    "src/components/ui/**",
    ".interlace/**",
    // Satori OG image routes are a documented carve-out (no Tailwind support).
    "src/app/og/**",
    // Static/generated assets — not source. public/lint-worker.js alone is
    // a 1.7MB minified bundle; linting it OOMs the 4GB heap.
    "public/**",
    // oxlint JS-plugin shims — CJS tooling, not app source (legit `require`).
    "tools/**",
    // Reproducibility scripts — not app source; may import packages not in this workspace.
    "repro/**",
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

  maintainabilityCfg.recommended,
  operabilityCfg.recommended,

  // react-features: the recommended React rules, plus the componentApi floor
  // (data-slot, no inline style, no raw colours …), both TSX only.
  { ...reactFeaturesCfg.recommended, files: ["**/*.tsx"] },
  { ...reactFeaturesCfg.componentApi, files: ["**/*.tsx"] },

  // ── Baseline (non-blocking) ───────────────────────────────────────────────
  // First-run Interlace backlog stays at `warn` so PRs aren't blocked on
  // pre-existing findings — run both linters every PR without the friction.
  // Ratchet each rule to `error` as the codebase is cleaned.
  // See agents memory: eslint-dogfooding-doctrine ("baseline-then-ratchet").
  {
    rules: {
      "modularity/no-external-api-calls-in-utils": "warn",
      "node-security/detect-non-literal-fs-filename": "error",
      "node-security/no-arbitrary-file-access": "error",
      "node-security/no-ssrf": "error",
      "operability/no-debug-code-in-production": "error",
      "reliability/require-network-timeout": "warn",
      "secure-coding/no-ldap-injection": "error",
      // Pre-existing: INSTALL_RE in markdown.ts uses negated char class flagged conservatively.
      "secure-coding/no-redos-vulnerable-regex": "warn",
      // Pre-existing: test file uses new RegExp(str) without escaping for dynamic pattern matching.
      "secure-coding/no-unsafe-regex-construction": "error",
      // Pre-existing: empty catch in scorecard/error.tsx (error boundary intentionally suppresses).
      "reliability/no-silent-errors": "warn",
      "conventions/no-raw-cross-property-href": "warn",
      // Pre-existing: PostHog event names in use-visitor-tracking.ts use legacy naming
      // ("pageview", "linkedin_click") before category:object_action convention was adopted.
      "conventions/analytics-event-naming": "warn",
    },
  },
  {
    files: ["**/*.tsx"],
    rules: {
      "react-a11y/role-supports-aria-props": "error",
      "react-features/jsx-key": "warn",
    },
  },

  // ── truepass: tests that cannot pass by checking less ────────────────────
  // A focused test, a skip with no reason, a fixed sleep or a retry fails lint,
  // at error. Zero findings when it was turned on, so there is no backlog to
  // baseline. Its other half, `truepass diff` (an assertion moved to a weaker
  // matcher), runs on pre-push as `hook:test-integrity`. Locked by
  // src/__tests__/truepass-lock.test.ts.
  {
    ...truepass.recommended,
    files: ["src/__tests__/**/*.test.{ts,tsx}", "vitest.config.mts"],
  },

  // ── Covers must go through next/image ─────────────────────────────────────
  // Ratcheted from the eslint-config-next default of `warn` to `error`. A raw
  // <img> bypasses Vercel's optimizer entirely: measured on a real article
  // cover, 245 KB PNG → 43 KB AVIF, and grid tiles were shipping full-size
  // images to thumbnails. This regressed once already (a raw <img> in
  // devto-articles.tsx carried a comment explaining it was needed because
  // next.config had no remotePatterns — that gap is now fixed), so the rule
  // is `error` to stop it coming back.
  //
  // Legitimate exceptions:
  //   - src/app/og/**   already globally ignored (Satori has no next/image)
  //   - <img> inside an email template or raw-HTML string is not JSX, so the
  //     rule never sees it
  // Anything else needs an inline disable WITH a reason.
  {
    files: ["**/*.tsx"],
    rules: {
      "@next/next/no-img-element": "error",
    },
  },
  // scripts/ are devtools/automation utilities — pre-existing findings baselied here
  // (baseline-then-ratchet: fix these in follow-up PRs, don't block article PRs).
  {
    files: ["scripts/**"],
    rules: {
      "secure-coding/no-redos-vulnerable-regex": "warn",
      "secure-coding/no-unsafe-regex-construction": "error",
      "reliability/no-silent-errors": "warn",
    },
  },
  // ── Current-major ratchet (2026-11-18) ───────────────────────────────────
  // `@/` is this app's tsconfig path alias, not a package (ofri-peretz/eslint#1551);
  // with it allowed, the rule reports 0 here.
  {
    rules: {
      "import-next/no-extraneous-dependencies": [
        "error",
        { allowPatterns: ["^@/"] },
      ],
    },
  },
]);

export default eslintConfig;
