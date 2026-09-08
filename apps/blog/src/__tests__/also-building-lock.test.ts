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
  });

  it("lets a long name break rather than overflow", () => {
    expect(SOURCE).toMatch(/text-2xl font-semibold tracking-tight break-words/);
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

  it("ships both products, each in its own card", () => {
    expect(SOURCE).toContain('testId: "also-building-serverless"');
    expect(SOURCE).toContain('testId: "also-building-burgee"');
  });

  it("does not put a third party's trademark on our own card", () => {
    // The obvious mark for the Serverless card is the Serverless Framework's
    // own bolt, which is theirs. A reader scanning marks would read it as
    // their logo on our product.
    // Asserted on the executable shape, not on prose: the comment in the
    // component names the file precisely to record why it is NOT used, and a
    // bare `not.toContain` would fail on that explanation.
    const marks = [...SOURCE.matchAll(/src:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(marks).not.toContain("/serverless-logo.svg");
    expect(marks.every((m) => m === "/burgee-flag.svg")).toBe(true);
  });

  it("links only to things that exist", () => {
    // burgee has no npm page yet, so a star is the only honest ask; the
    // serverless plugins are published, so they link to what you can install.
    expect(SOURCE).toContain("https://serverless.interlace.tools");
    expect(SOURCE).toContain(
      "https://www.npmjs.com/package/@interlace/serverless-devkit",
    );
    expect(SOURCE).toContain("https://github.com/ofri-peretz/burgee");
    expect(SOURCE).not.toMatch(/npmjs\.com\/package\/burgee/);
  });
});
