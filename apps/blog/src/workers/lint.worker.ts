// The playground's analyzer — OUR published rules, running where the
// reader is. Nothing here talks to a server: the linter, the parser and
// the plugins are all in this bundle (the spike: ~400KB gzipped,
// loaded lazily behind the article's "Try it live" gate), so a million
// readers lint for free and nothing they type leaves the page.

import { Linter } from "eslint/universal";
import jwt from "eslint-plugin-jwt";
import nodeSecurity from "eslint-plugin-node-security";

import type {
  LintRequest,
  LintResponse,
  PlaygroundPluginId,
} from "../lib/lint-embeds";

// Enumerated, never dynamic: the worker ships exactly the plugins the
// embed definitions name, and a request for anything else is an error.
const PLUGINS: Record<PlaygroundPluginId, unknown> = {
  jwt,
  "node-security": nodeSecurity,
};

const linter = new Linter();

self.onmessage = (event: MessageEvent<LintRequest>) => {
  const { id, code, pluginId, rules } = event.data;
  try {
    const plugin = PLUGINS[pluginId];
    if (!plugin) throw new Error(`unknown plugin: ${pluginId}`);
    const messages = linter.verify(
      code,
      {
        plugins: { [pluginId]: plugin } as never,
        languageOptions: { ecmaVersion: 2024, sourceType: "module" },
        rules,
      },
      { filename: "playground.js" },
    );
    const response: LintResponse = {
      id,
      ok: true,
      findings: messages.map((m) => ({
        line: m.line ?? 1,
        column: m.column,
        ruleId: m.ruleId ?? null,
        severity: m.severity === 2 ? "error" : "warn",
        message: m.message,
      })),
    };
    self.postMessage(response);
  } catch (error) {
    const response: LintResponse = { id, ok: false, error: String(error) };
    self.postMessage(response);
  }
};
