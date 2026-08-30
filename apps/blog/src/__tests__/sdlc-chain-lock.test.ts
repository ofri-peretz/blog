import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import matter from "gray-matter";
// Stage 1/2/5 chain lock — the artifact chain is well-formed and its evidence
// is re-runnable.
//
// The five recurring fabrication classes in this corpus (wrong rule counts,
// invented config keys, the `.configs` default-import crash, an SDK signature
// that never existed, a rule's skip branch assumed rather than read) all have
// one cause: ground truth is re-derived every session and thrown away, and
// some re-derivations are wrong. Cataloguing them in prose did not stop them
// recurring. This lock makes an unsourced number un-mergeable.
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../..");
const INTENT = join(ROOT, "sdlc/intent");
const SPEC = join(ROOT, "sdlc/spec");
const ARTICLES = join(ROOT, "apps/blog/content/articles");

const INTENT_STATUS = ["proposed", "approved", "killed", "shipped"];
const SPEC_STATUS = ["draft", "approved", "superseded"];

// Landscape framing. Enforced on chain artifacts and on any article that has
// been through the chain (i.e. carries a score). The legacy corpus contains
// ~20 files using this vocabulary; lifting them is intent I-7, and scoping the
// gate this way is the same ratchet the quality lock uses.
const BANNED_WORDS = [
  "beat",
  "beats",
  "beating",
  "winner",
  "winners",
  "wins",
  "crush",
  "crushes",
  "crushed",
  "destroy",
  "destroys",
  "destroyed",
  "moat",
  "competitor",
  "competitors",
];
// Set membership over tokens rather than a regex: a repo that publishes a
// no-redos-vulnerable-regex rule should not ship an alternation that trips it,
// and this is both faster and exact on word boundaries.
const BANNED = new Set(BANNED_WORDS);
const usesCompetitiveFraming = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z]+/)
    .some((word) => BANNED.has(word));

function markdownIn(dir: string) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "TEMPLATE.md")
    .map((f) => {
      const file = join(dir, f);
      const { data, content } = matter(readFileSync(file, "utf-8"));
      return { name: f, file, data, content };
    });
}

const SEPARATOR_ROW = /^\|[\s|:-]+\|$/;
// | claim | value | command | version | verified |
const EVIDENCE_COLUMNS = 5;

/** One row of a stage-2 evidence table: | claim | value | command | version | verified | */
function parseClaims(markdown: string) {
  const rows: {
    claim: string;
    value: string;
    command: string;
    version: string;
  }[] = [];
  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || SEPARATOR_ROW.test(trimmed)) continue;
    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    if (cells.length < EVIDENCE_COLUMNS) continue;
    const [claim, value, command, version] = cells;
    if (claim.toLowerCase() === "claim") continue;
    rows.push({
      claim,
      value,
      command: command.replace(/^`|`$/g, "").trim(),
      version,
    });
  }
  return rows;
}

const intents = markdownIn(INTENT);
const specs = markdownIn(SPEC);

// Read the corpus once. Two blocks below need it, and re-walking 90 files per
// block is both slower and what our own no-unlimited-resource-allocation rule
// flags when the read sits inside the loop.
const corpus = readdirSync(ARTICLES)
  .filter((f) => f.endsWith(".md"))
  .map((f) => ({
    name: f,
    ...matter(readFileSync(join(ARTICLES, f), "utf-8")),
  }));

describe("stage 1 — intents are well-formed", () => {
  it("at least one intent exists", () => {
    expect(intents.length).toBeGreaterThan(0);
  });

  it.each(intents.map((i) => [i.name, i] as const))("%s", (_name, intent) => {
    const d = intent.data as Record<string, unknown>;
    expect(d.id, "id is required").toBeTruthy();
    expect(d.slug, "slug is required").toBeTruthy();
    expect(d.stage, "stage must be 'intent'").toBe("intent");
    expect(
      INTENT_STATUS,
      `status "${d.status}" is not one of ${INTENT_STATUS.join(" | ")}`,
    ).toContain(d.status);
    expect(["public", "internal"]).toContain(d.visibility);

    // The kill criterion is the field that separates a hypothesis from a plan
    // to rationalise. An intent without one always survives contact with the
    // evidence, which is exactly the failure mode.
    expect(
      intent.content,
      `${intent.name}: no "## Kill criterion" section`,
    ).toMatch(/##\s+Kill criterion/i);
    expect(intent.content, `${intent.name}: no "## Why us" section`).toMatch(
      /##\s+Why us/i,
    );

    // An approved intent has an approver. Git records who; this records that.
    if (d.status === "approved" || d.status === "shipped") {
      expect(
        d.approved_by,
        `${intent.name}: status is "${d.status}" but approved_by is empty`,
      ).toBeTruthy();
    }
  });
});

describe("stage 2 — every number in a spec carries its command", () => {
  it.each(
    specs.length
      ? specs.map((s) => [s.name, s] as const)
      : [["(no specs yet)", null] as const],
  )("%s", (_name, spec) => {
    if (!spec) return;
    const d = spec.data as Record<string, unknown>;
    expect(d.slug).toBeTruthy();
    expect(d.stage).toBe("spec");
    expect(SPEC_STATUS).toContain(d.status);
    expect(d.intent, "a spec must name the intent it came from").toBeTruthy();
    expect(
      existsSync(join(ROOT, String(d.intent))),
      `${spec.name}: intent "${d.intent}" does not exist`,
    ).toBe(true);

    const claims = parseClaims(spec.content);
    expect(
      claims.length,
      `${spec.name}: evidence table is empty`,
    ).toBeGreaterThan(0);

    // The gate: a value containing a digit is a number the article could get
    // wrong, and a number without a command is a memory, not ground truth.
    const unsourced = claims
      .filter((c) => /\d/.test(c.value))
      .filter((c) => !c.command || !c.version);
    expect(
      unsourced.map((c) => c.claim),
      `${spec.name}: numeric claims missing a command or version: ${unsourced
        .map((c) => c.claim)
        .join(", ")}`,
    ).toEqual([]);
  });
});

describe("stage 5 — landscape framing on everything through the chain", () => {
  it("no chain artifact uses competitive vocabulary", () => {
    const offenders: string[] = [];
    for (const doc of [...intents, ...specs]) {
      // Strip the line that names the banned words in the template guidance.
      const prose = doc.content
        .split("\n")
        .filter(
          (l) => !/never|banned|blocking vocabulary|framing check/i.test(l),
        )
        .join("\n");
      if (usesCompetitiveFraming(prose)) offenders.push(doc.name);
    }
    expect(
      offenders,
      `competitive framing in: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("no scored article uses competitive vocabulary", () => {
    const offenders = corpus
      .filter((a) => a.data.quality) // legacy corpus is intent I-7
      .filter((a) => usesCompetitiveFraming(a.content))
      .map((a) => a.name);
    expect(
      offenders,
      `competitive framing in scored articles: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});

describe("stage 4 — a scored article points at a spec that exists", () => {
  it("every quality.spec resolves", () => {
    const dangling = corpus
      .map((a) => ({
        name: a.name,
        spec: (a.data.quality as { spec?: string } | undefined)?.spec,
      }))
      .filter((a) => a.spec && !existsSync(join(ROOT, a.spec)))
      .map((a) => `${a.name} -> ${a.spec}`);
    expect(
      dangling,
      `quality.spec points nowhere: ${dangling.join(", ")}`,
    ).toEqual([]);
  });
});
