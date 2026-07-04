import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ────────────────────────────────────────────────────────────────────────────
// Interlace ecosystem — à-la-carte dogfooding. Each plugin is wired separately
// via its OWN `recommended` preset (NOT the @interlace/eslint-config meta-config).
//
// Nine plugins expose a working flat `configs.recommended` that we spread as-is:
//   security: browser-security, secure-coding, node-security
//   quality:  conventions, import-next, modernization, modularity, reliability
//   a11y:     react-a11y (scoped to **/*.tsx)
//
// Three plugins ship a BROKEN `recommended` on npm (doubled-namespace /
// categorized rule names flat-config can't resolve), so they are hand-wired
// below with explicit flat rule names:
//   maintainability, operability (default imports), react-features (TSX only).
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
import maintainability from "eslint-plugin-maintainability";
import operability from "eslint-plugin-operability";
import reactFeatures from "eslint-plugin-react-features";

/**
 * STR-1 status: `eslint-plugin-react-features` `componentApi` preset is
 * NOT wired here yet — the rules (R5/R6/R8/R11/R12/R18/R19) ship in the
 * local `eslint/` monorepo's `dist/` but the published npm v1.1.4 does
 * not yet expose them. Re-enable after the plugin publishes the
 * `componentApi/*` rules.
 *
 * Regression coverage in the meantime: `src/__tests__/interlace-floor-lock.test.ts`
 * runs the same grep-based checks at test time.
 */
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
    // oxlint JS-plugin shims — CJS tooling, not app source (legit `require`).
    "tools/**",
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
  // First-run Interlace backlog stays at `warn` so PRs aren't blocked on
  // pre-existing findings — run both linters every PR without the friction.
  // Ratchet each rule to `error` as the codebase is cleaned.
  // See agents memory: eslint-dogfooding-doctrine ("baseline-then-ratchet").
  {
    rules: {
      "modularity/no-external-api-calls-in-utils": "warn",
      "node-security/detect-non-literal-fs-filename": "warn",
      "node-security/no-arbitrary-file-access": "warn",
      "node-security/no-ssrf": "warn",
      "operability/no-debug-code-in-production": "warn",
      "reliability/require-network-timeout": "warn",
      "secure-coding/no-ldap-injection": "warn",
      // ReDoS / dynamic-regex findings are all on TRUSTED build-time input:
      // our own frontmatter + markdown parsing (scripts/*.mjs, src/lib/markdown.ts)
      // on author-written content, plus a regression test that builds a regex from
      // a fixed identifier list. No untrusted-input attack surface. Held at warn as
      // ratchet backlog (per the baseline-then-ratchet doctrine above); harden the
      // patterns with tests, then ratchet back to error.
      "secure-coding/no-redos-vulnerable-regex": "warn",
      "secure-coding/no-unsafe-regex-construction": "warn",
      // Custom conventions rules flag PRE-EXISTING app code that predates them:
      // raw cross-property hrefs that should route through buildUtmHref() (lib/utm.ts),
      // and PostHog event names not yet in category:object_action grammar. Held at warn
      // so PRs merge green; adopting buildUtmHref + renaming live analytics events is a
      // product migration, then ratchet these back to error. (Adopt-then-ratchet.)
      "conventions/no-raw-cross-property-href": "warn",
      "conventions/analytics-event-naming": "warn",
    },
  },
  {
    files: ["**/*.tsx"],
    rules: {
      "react-a11y/role-supports-aria-props": "warn",
      "react-features/jsx-key": "warn",
    },
  },
]);

export default eslintConfig;
