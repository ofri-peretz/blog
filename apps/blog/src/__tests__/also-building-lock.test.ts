/*
 * The "Also building" section argues for two products, and both have to
 * survive a 375px viewport with text at 200%.
 *
 * A flex item does not shrink below its content's min-content width unless it
 * is told it may. The card's padding is rem-based, so at 200% the content box
 * on a 375px viewport is about 117px — and "Interlace Serverless" wanted 276,
 * which pushed the DOCUMENT to 405px and scrolled the whole page sideways.
 * That is WCAG 1.4.10 (Reflow). `burgee` never hit it, only because it is a
 * short word: the section had the defect from the day it was written and
 * nothing revealed it until a longer name moved in.
 *
 * Measured in a browser at 375px/200% before and after: 405px -> 375px, four
 * overflowing elements -> zero.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(process.cwd(), "src/components/landing/also-building.tsx"),
  "utf8",
);

describe("also-building reflow contract", () => {
  it("lets the name block shrink below its content width", () => {
    // Both of these: the outer flex item AND the block holding the heading.
    // Only the pair together lets a long name reflow instead of pushing.
    expect(SOURCE).toContain("flex min-w-0 flex-col items-start");
    expect(SOURCE).toContain('<div className="min-w-0">');
    // The wrap row too — it is a flex item of the column above it.
    expect(SOURCE).toContain("flex min-w-0 flex-wrap items-center");
  });

  it("uses overflow-wrap:anywhere, which is the one that actually shrinks", () => {
    /*
     * `break-words` is NOT equivalent and was the first attempt. Only
     * `anywhere` reduces an element's min-content width, and min-content is
     * what sizes a flex item — so `break-words` looked correct at 375px and
     * the layout audit still reported the document scrolling 43px sideways at
     * 320px/200%, its narrowest width. Same distinction already recorded on
     * /foundations.
     */
    expect(SOURCE).toContain("[overflow-wrap:anywhere]");
    expect(SOURCE).not.toMatch(/tracking-tight break-words/);
    // The heading AND the tagline: both were in the audit's overflow list.
    expect(
      [...SOURCE.matchAll(/\[overflow-wrap:anywhere\]/g)].length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("keeps every status short enough for a badge", () => {
    /*
     * `Badge` is `whitespace-nowrap shrink-0` by design — a label, not a
     * sentence. It will not wrap or shrink for anyone, so a long status
     * pushes the whole flex row and the document scrolls sideways. Measured:
     * "146 in the registry" cost 43px at 320px/200%; "146 items" costs none.
     *
     * 16 characters is the budget the three shipped statuses fit inside
     * ("3 plugins live" is the longest at 14), with room that does not
     * invite another sentence.
     */
    // Statuses are either a plain string or a template interpolating
    // REGISTRY_ITEMS; measure what actually renders in both cases.
    const count = SOURCE.match(/const REGISTRY_ITEMS = (\d+);/)?.[1];
    expect(count, "REGISTRY_ITEMS not found").toBeDefined();
    const statuses = [...SOURCE.matchAll(/status: (?:"([^"]+)"|`([^`]+)`)/g)]
      .map((m) => m[1] ?? m[2])
      .map((v) => v.replace(/\$\{REGISTRY_ITEMS\}/g, count!));
    expect(statuses.length).toBeGreaterThanOrEqual(3);
    for (const status of statuses) {
      expect(status.length, `status too long for a badge: "${status}"`).toBeLessThanOrEqual(16);
    }
  });


  it("states the registry count once, not twice", () => {
    /*
     * The count is in the badge AND the body. As two literals they drift, and
     * a comment saying so would only record the drift. One const, two
     * renderings — so a stale number is impossible rather than merely
     * documented.
     */
    const count = SOURCE.match(/const REGISTRY_ITEMS = (\d+);/)?.[1];
    expect(count, "REGISTRY_ITEMS not found").toBeDefined();
    expect(SOURCE).toContain("status: `${REGISTRY_ITEMS} items`");
    expect(SOURCE).toContain("{REGISTRY_ITEMS}");
    // Exactly one occurrence in CODE. Comments legitimately quote the number
    // — its provenance, and the reflow bug the longer status caused — and a
    // raw count over the whole file would fail on prose, which is the mistake
    // this file has already made once.
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const occurrences = [
      ...code.matchAll(new RegExp(`\\b${count}\\b`, "g")),
    ].length;
    expect(
      occurrences,
      `the count must live in exactly one place in code, found ${occurrences}`,
    ).toBe(1);
  });

  it("keeps the button labels wrappable", () => {
    // Same failure mode, already fixed once for the CTAs: buttonVariants sets
    // `whitespace-nowrap`, which cannot reflow.
    expect(SOURCE).toContain('"h-auto max-w-full whitespace-normal text-center"');
  });
});

describe("also-building says what each product actually is", () => {
  it("sets the name in mono only for the one that is a command", () => {
    // `burgee` is typed at a shell. "Interlace Serverless" is a product name,
    // and mono is both wrong for it and much wider per character.
    expect(SOURCE).toMatch(/name: "burgee",\s*\n\s*mono: true,/);
    expect(SOURCE).not.toMatch(/name: "Interlace Serverless",\s*\n\s*mono: true,/);
    expect(SOURCE).toContain('product.mono && "font-mono"');
  });

  it("ships every product, each in its own card", () => {
    // Ordered by maturity, which is also the order they are declared.
    const ids = [...SOURCE.matchAll(/testId: "(also-building-[a-z-]+)"/g)].map(
      (m) => m[1],
    );
    expect(ids).toEqual([
      "also-building-serverless",
      "also-building-design-system",
      "also-building-burgee",
    ]);
  });

  it("does not put a third party's trademark on our own card", () => {
    // The obvious mark for the Serverless card is the Serverless Framework's
    // own bolt, which is theirs. A reader scanning marks would read it as
    // their logo on our product.
    // Asserted on the executable shape, not on prose: the comment in the
    // component names the file precisely to record why it is NOT used, and a
    // bare `not.toContain` would fail on that explanation.
    // `toEqual` on the whole list, not `every`: `every` is true for an empty
    // array, so deleting every mark — burgee's included, and that one is
    // load-bearing for the brand — would have passed silently. Review caught
    // it; it is the same vacuity this file exists to guard against.
    const marks = [...SOURCE.matchAll(/src:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(marks).toEqual(["/burgee-flag.svg"]);
  });

  it("links only to things that exist", () => {
    // burgee has no npm page yet, so a star is the only honest ask; the
    // serverless plugins are published, so they link to what you can install.
    expect(SOURCE).toContain("https://serverless.interlace.tools");
    expect(SOURCE).toContain("https://interlace.tools");
    expect(SOURCE).toContain("https://storybook.interlace.tools");
    // The DS is installed FROM a registry, not depended on: there is no
    // @interlace/ui on npm, so an npm link here would 404.
    expect(SOURCE).not.toMatch(/npmjs\.com\/package\/@interlace\/ui/);
    expect(SOURCE).toContain(
      "https://www.npmjs.com/package/@interlace/serverless-devkit",
    );
    expect(SOURCE).toContain("https://github.com/ofri-peretz/burgee");
    expect(SOURCE).not.toMatch(/npmjs\.com\/package\/burgee/);
  });
});
