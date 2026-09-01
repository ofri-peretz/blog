/**
 * Locks on the SDLC artifacts that keep a claim traceable to the command
 * that produced it.
 *
 * Separating our own browsing from a reader's is deliberately NOT done in
 * app code. A `?internal=1` flag was built and rejected: it needs a manual
 * visit per browser per device, it silently rots the moment one is missed,
 * and it can only ever work forwards. The replacement is an analysis-time
 * population rule (docs/sdlc/analysis-population.md) which needs nothing
 * from anyone and applies retroactively to data we already have.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
// src → apps/blog → apps → repo root
const REPO = path.resolve(SRC, "../../..");

describe("the analysis population is defined somewhere durable", () => {
  const DOC = path.join(REPO, "docs/sdlc/analysis-population.md");

  it("exists — an exclusion rule that lives only in a chat log is not a rule", () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it("states both thresholds and ships runnable SQL", () => {
    const body = readFileSync(DOC, "utf-8");
    // The thresholds ARE the definition; prose describing them without
    // numbers cannot be applied consistently twice.
    expect(body).toMatch(/active_days\s*>=\s*3/);
    expect(body).toMatch(/events\s*>=\s*50/);
    expect(body).toContain("SELECT");
  });
});

describe("the SDLC artifacts exist and are usable", () => {
  const SDLC = path.join(REPO, "docs/sdlc");

  it("both templates are present", () => {
    expect(existsSync(path.join(SDLC, "templates/intent.template.md"))).toBe(true);
    expect(existsSync(path.join(SDLC, "templates/plan.template.md"))).toBe(true);
  });

  const intents = existsSync(path.join(SDLC, "intents"))
    ? readdirSync(path.join(SDLC, "intents")).filter((f) => f.endsWith(".md"))
    : [];

  it("at least one real intent exists — a template nobody used is not a process", () => {
    expect(intents.filter((f) => f.endsWith(".intent.md")).length).toBeGreaterThan(0);
  });

  it.each(intents)("%s carries the sections its template requires", (file) => {
    const body = readFileSync(path.join(SDLC, "intents", file), "utf-8");
    const required = file.endsWith(".intent.md")
      ? ["## What", "## Why now", "## Constraints", "## How we will know it worked"]
      : ["## Ground truth", "## Approach", "## Gates", "## Risks"];
    for (const heading of required) {
      expect(body, `${file} is missing "${heading}"`).toContain(heading);
    }
  });

  it.each(intents.filter((f) => f.endsWith(".intent.md")))(
    "%s has a matching plan",
    (file) => {
      const plan = file.replace(".intent.md", ".plan.md");
      expect(
        existsSync(path.join(SDLC, "intents", plan)),
        `${file} has no ${plan} — an intent without a plan never reached Design`,
      ).toBe(true);
    },
  );

  it("every plan's ground-truth table cites a source per row", () => {
    for (const file of intents.filter((f) => f.endsWith(".plan.md"))) {
      const body = readFileSync(path.join(SDLC, "intents", file), "utf-8");
      // Skip the header and its separator STRUCTURALLY (first cell === the
      // literal header name, or a row made only of dashes) rather than by
      // searching for "Claim |" anywhere in the line — a data row whose cell
      // happened to contain that string would have been dropped silently,
      // which is the same class of bug as the greps this file exists to
      // replace. (Review: flagged four times; it was right.)
      const rows = body
        .split("\n")
        .filter((l) => l.startsWith("|"))
        .filter((l) => {
          const cells = l.split("|").slice(1, -1).map((c) => c.trim());
          const isSeparator = cells.every((c) => /^:?-{3,}:?$/.test(c));
          const isHeader = cells[0] === "Claim";
          return !isSeparator && !isHeader;
        });
      expect(rows.length, `${file} has an empty ground-truth table`).toBeGreaterThan(0);
      for (const row of rows) {
        // 4 columns => 5 pipes. A row missing its source column is a number
        // written from memory, which is the exact defect this table exists
        // to prevent.
        expect(row.split("|").length, `thin row in ${file}: ${row}`).toBe(6);
      }
    }
  });
});
