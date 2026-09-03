/**
 * Runs the corpus's code blocks through the plugins they claim to describe.
 *
 * 655 fenced blocks, 393 of them JS/TS, every one making a checkable claim
 * about what our rules do — and until now, none checked. This class of error
 * has already shipped: wrong rule counts, an export shape that did not exist,
 * "taint" analysis the code does not perform. All caught by a human
 * re-reading, which is the least reliable mechanism available.
 *
 * Intent: docs/sdlc/intents/2026-09-02-articles-that-cannot-lie
 *
 * A block opts in through its fence:
 *
 *     ```ts lint:node-security/detect-child-process
 *     ```js lint:!jwt/no-none-algorithm      <- claims it reports NOTHING
 *
 * No annotation, no check. That keeps the ~600 config, terminal and JSON
 * blocks untouched and means nobody has to learn anything to write an
 * ordinary block.
 *
 * ASSERTS FIRING, NOT POSITIONS. Line numbers move whenever surrounding prose
 * is edited, and a checker that fails on unrelated edits gets switched off
 * within a month. What a reader relies on is "this code triggers that rule".
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { Linter } from "eslint";

const require = createRequire(import.meta.url);
const ARTICLES = path.resolve(import.meta.dirname, "../content/articles");
const TS_LANGS = new Set(["ts", "tsx", "typescript"]);
const JS_LANGS = new Set(["js", "jsx", "javascript", "mjs", "cjs"]);

/** `lint:pkg/rule` or `lint:!pkg/rule` — the `!` means "reports nothing". */
const CLAIM = /\blint:(!)?([a-z0-9-]+)\/([a-z0-9-]+)\b/;

function loadPlugin(ns) {
  try {
    const mod = require(`eslint-plugin-${ns}`);
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

function loadTsParser() {
  try {
    return require("@typescript-eslint/parser");
  } catch {
    return null;
  }
}

export function collectClaims() {
  const out = [];
  for (const file of readdirSync(ARTICLES).filter((f) => f.endsWith(".md"))) {
    const lines = readFileSync(path.join(ARTICLES, file), "utf-8").split("\n");
    let open = null;
    lines.forEach((line, i) => {
      if (!line.startsWith("```")) return;
      if (open) {
        if (open.claim) {
          out.push({ ...open, code: lines.slice(open.start, i).join("\n") });
        }
        open = null;
        return;
      }
      const info = line.slice(3).trim();
      const m = CLAIM.exec(info);
      open = {
        file,
        line: i + 1,
        lang: (info.split(/\s+/)[0] || "").toLowerCase(),
        claim: m ? { negated: Boolean(m[1]), ns: m[2], rule: m[3] } : null,
        start: i + 1,
      };
    });
  }
  return out;
}

export function verifyClaim(entry) {
  const { claim, lang, code, file, line } = entry;
  const id = `${claim.ns}/${claim.rule}`;
  const where = `${file}:${line}`;

  const plugin = loadPlugin(claim.ns);
  if (!plugin) {
    return { ok: false, where, msg: `no eslint-plugin-${claim.ns} installed` };
  }
  if (!plugin.rules?.[claim.rule]) {
    return {
      ok: false,
      where,
      msg: `eslint-plugin-${claim.ns} has no rule "${claim.rule}" — renamed or removed?`,
    };
  }

  const languageOptions = { ecmaVersion: 2023, sourceType: "module" };
  if (TS_LANGS.has(lang)) {
    const parser = loadTsParser();
    // Loud, not skipped. A skipped check that reads like a passed one is the
    // exact failure this whole intent was opened about.
    if (!parser) {
      return {
        ok: false,
        where,
        msg: `${lang} block claims ${id} but no TypeScript parser is available`,
      };
    }
    languageOptions.parser = parser;
  } else if (!JS_LANGS.has(lang)) {
    return {
      ok: false,
      where,
      msg: `lang "${lang}" is not lintable — remove the lint: claim or fix the fence`,
    };
  }

  const linter = new Linter({ configType: "flat" });
  let messages;
  try {
    messages = linter.verify(code, {
      plugins: { [claim.ns]: plugin },
      rules: { [id]: "error" },
      languageOptions,
    });
  } catch (err) {
    return { ok: false, where, msg: `linting threw: ${err.message}` };
  }

  const fatal = messages.find((m) => m.fatal);
  if (fatal) {
    return { ok: false, where, msg: `parse error: ${fatal.message}` };
  }

  const hits = messages.filter((m) => m.ruleId === id);
  if (claim.negated) {
    return hits.length === 0
      ? { ok: true, where, msg: `${id} correctly silent` }
      : {
          ok: false,
          where,
          msg: `claims !${id} but it reported ${hits.length}x: ${hits[0].message}`,
        };
  }
  return hits.length > 0
    ? { ok: true, where, msg: `${id} fired ${hits.length}x` }
    : {
        ok: false,
        where,
        msg: `claims ${id} fires, but it reported nothing on this block`,
      };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const claims = collectClaims();
  if (claims.length === 0) {
    console.log("no annotated blocks yet — nothing claimed, nothing checked");
    process.exit(0);
  }
  let bad = 0;
  for (const entry of claims) {
    const r = verifyClaim(entry);
    if (!r.ok) bad++;
    console.log(`${r.ok ? "✓" : "✗"} ${r.where}  ${r.msg}`);
  }
  console.log(`\n${claims.length - bad}/${claims.length} verified claims`);
  process.exit(bad ? 1 : 0);
}
