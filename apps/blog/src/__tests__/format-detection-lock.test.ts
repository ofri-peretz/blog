// Format-detection lock.
//
// iOS Safari data detectors rewrite the DOM before hydration: a CVE id such
// as "2019-9193" reads as a phone number and a header date reads as a date,
// and each gets wrapped in an <a>. React then finds an element where the
// server rendered text and throws #418 (args[]=HTML) on /articles/* pages.
// The root layout opts out of every detector; this lock keeps it that way.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layout = readFileSync(resolve(__dirname, "../app/layout.tsx"), "utf-8");
const block = layout.match(/formatDetection:\s*\{([^}]*)\}/)?.[1] ?? "";

describe("root metadata format detection", () => {
  it.each(["telephone", "date", "address", "email"])(
    "disables the %s detector",
    (detector) => {
      expect(block).toMatch(new RegExp(`\\b${detector}:\\s*false\\b`));
    },
  );
});
