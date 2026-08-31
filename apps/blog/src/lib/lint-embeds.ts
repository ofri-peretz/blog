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
      "Three of the 42 rules, live — path traversal, command injection, and eval, all in one upload handler. Edit the code, or paste your own, and see exactly what a finding looks like before it ever reaches your CI.",
    pluginId: "node-security",
    rules: {
      "node-security/detect-eval-with-expression": "error",
      "node-security/detect-child-process": "error",
      "node-security/no-zip-slip": "error",
    },
    // An Express handler, because detect-child-process is provenance-gated:
    // it reports a command built from an attacker-reachable root (req, ctx,
    // event…), not from any dynamic string. A sample with a bare `userInput`
    // parameter is silent BY DESIGN — which is exactly how the first version
    // of this embed advertised three rules and could only ever fire one.
    initialCode: `import child_process from "child_process";

export function handleUpload(req, res) {
  const archive = openArchive(req.file.path);
  archive.unzip("/srv/plugins"); // entries may contain ../ and escape this
  child_process.exec("npm run build --prefix " + req.body.target);
  return res.json(eval("(" + req.body.manifest + ")"));
}
`,
  },
];
