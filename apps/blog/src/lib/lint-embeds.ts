// Live-lint playground definitions — which article gets which rule,
// running on which vulnerable-by-design sample.
//
// The playground is the flagship embed: the reader edits the code and
// OUR published rule fires with its CWE-tagged message, entirely in the
// browser (see workers/lint.worker.ts). Definitions are enumerated here
// so locks can hold them: every slug is a published article, every
// pluginId is one the worker actually bundles, and every sample is
// vulnerable ON PURPOSE — the mount lint must find something, or the
// demo opens on silence.

import type { Linter } from "eslint";

/** The plugins the worker bundles. Enumerated — never dynamic. */
export type PlaygroundPluginId = "jwt" | "node-security";

export interface LintEmbedDef {
  /** Article slug this playground renders under. */
  slug: string;
  /** Section heading. */
  title: string;
  /** One sentence inviting the edit. */
  invite: string;
  pluginId: PlaygroundPluginId;
  /** Flat-config rules entry, `<pluginId>/<rule>` keys. */
  rules: Linter.RulesRecord;
  /** Vulnerable-by-design starting code — the mount lint must fire. */
  initialCode: string;
}

/** Worker protocol. */
export interface LintRequest {
  id: number;
  code: string;
  pluginId: PlaygroundPluginId;
  rules: Linter.RulesRecord;
}
export interface LintFinding {
  line: number;
  column?: number;
  ruleId: string | null;
  severity: "error" | "warn";
  message: string;
}
export type LintResponse =
  | { id: number; ok: true; findings: LintFinding[] }
  | { id: number; ok: false; error: string };

export const LINT_EMBEDS: readonly LintEmbedDef[] = [
  {
    slug: "the-jwt-algorithm-none-attack-the-vulnerability-in-1-line-of-code-d9g",
    title: "Run the rule on this code — live",
    invite:
      'This is the one line the article is about. Edit it — remove "none", add it back, paste your own verify call — and watch the rule react.',
    pluginId: "jwt",
    rules: { "jwt/no-algorithm-none": "error" },
    initialCode: `import jwt from "jsonwebtoken";

export function verifySession(token, secret) {
  return jwt.verify(token, secret, { algorithms: ["HS256", "none"] });
}
`,
  },
  {
    slug: "getting-started-eslint-plugin-node-security",
    title: "Try the plugin before you install it",
    invite:
      "Three of the 35 rules, live. Edit the code — or paste your own — and see exactly what a finding looks like before it ever reaches your CI.",
    pluginId: "node-security",
    rules: {
      "node-security/detect-eval-with-expression": "error",
      "node-security/detect-child-process": "error",
      "node-security/no-zip-slip": "error",
    },
    initialCode: `import { exec } from "child_process";

export function runReport(userInput) {
  exec("generate-report " + userInput);
  return eval("(" + userInput + ")");
}
`,
  },
];
