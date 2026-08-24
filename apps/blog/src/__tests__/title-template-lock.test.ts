// Title-template lock.
//
// The root layout declares `title.template: "%s — Ofri Peretz"`, so a page
// that hard-codes the suffix in its own `title` ships a doubled tab title —
// "Articles — Ofri Peretz — Ofri Peretz" was live until 2026-08-24. The
// doubling is invisible in code review (each file looks right alone) and
// no build step compares the two, so it's locked here.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const APP_DIR = resolve(__dirname, "../app");

function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pageFiles(full));
    else if (entry === "page.tsx") out.push(full);
  }
  return out;
}

describe("metadata title template", () => {
  it("the root layout owns the suffix via title.template", () => {
    const layout = readFileSync(join(APP_DIR, "layout.tsx"), "utf-8");
    expect(layout).toMatch(/template:\s*"%s — Ofri Peretz"/);
  });

  it("no page hard-codes the template suffix in its own title", () => {
    const offenders: string[] = [];
    for (const file of pageFiles(APP_DIR)) {
      const src = readFileSync(file, "utf-8");
      // openGraph/twitter titles do NOT go through the template, so an
      // explicit suffix there is legitimate — only inspect the source
      // before the openGraph block.
      const head = src.split(/\bopenGraph\b/)[0];
      if (/title:\s*"[^"]*— Ofri Peretz"/.test(head)) {
        offenders.push(file.replace(APP_DIR, "src/app"));
      }
    }
    expect(offenders).toEqual([]);
  });
});
