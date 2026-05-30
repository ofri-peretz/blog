import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
  ]),
]);

export default eslintConfig;
