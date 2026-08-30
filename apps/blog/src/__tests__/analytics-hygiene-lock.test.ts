/**
 * Locks on the things that make our numbers safe to decide from.
 *
 * The August baseline could not separate our own browsing from a reader's,
 * which at ~11 pageviews a day makes every small number suspect. These pin
 * the separation mechanism and the SDLC artifacts that are supposed to keep
 * a claim traceable to the command that produced it.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
// src → apps/blog → apps → repo root
const REPO = path.resolve(SRC, "../../..");
const read = (rel: string): string => readFileSync(path.resolve(SRC, rel), "utf-8");

describe("internal traffic is separable from readers", () => {
  const FLAG = read("components/internal-traffic-flag.tsx");

  it("registers a persistent super property, not a one-off event property", () => {
    // register() is what makes posthog-js attach the flag to EVERY later
    // event, including $pageview and everything in lib/analytics.ts. A
    // capture() here would flag one event and nothing else.
    expect(FLAG).toContain("posthog.register({ is_internal: true })");
    expect(FLAG).toContain('posthog.unregister("is_internal")');
  });

  it("is reversible and only reacts to the two known values", () => {
    expect(FLAG).toMatch(/flag !== "1" && flag !== "0"/);
  });

  it("strips the parameter so a shared link cannot flag a real reader", () => {
    expect(FLAG).toContain('searchParams.delete("internal")');
    expect(FLAG).toContain("history.replaceState");
  });

  it("is mounted inside the PostHog provider, or it can never register", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain("<InternalTrafficFlag />");
    // Must sit INSIDE the provider subtree: registering before posthog.init
    // is a silent no-op on an inert singleton.
    const provider = layout.indexOf('<PostHogProvider app="blog">');
    const flag = layout.indexOf("<InternalTrafficFlag />");
    expect(provider).toBeGreaterThan(-1);
    expect(flag).toBeGreaterThan(provider);
  });

  it("never lets analytics break the page", () => {
    // Three independent try blocks: reading the URL, registering, tidying up.
    expect(FLAG.match(/try \{/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
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
      const rows = body
        .split("\n")
        .filter((l) => l.startsWith("|") && !l.includes("---") && !l.includes("Claim |"));
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
