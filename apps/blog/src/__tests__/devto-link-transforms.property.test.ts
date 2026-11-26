/**
 * Property tests for the dev.to link transform: generated article bodies try to break the
 * guarantees the publisher relies on. No dependency is added for this: the generator is a seeded
 * PRNG (mulberry32), so a failure reproduces from the seed and the failing body is in the assertion.
 */
import { describe, expect, it } from "vitest";

import {
  collectDevtoLinks,
  transformBodyForDevto,
} from "../../scripts/devto-link-transforms.mjs";

const RUNS = 300;
const SEED = 0x5eed;
const SLUG = "my-current-article";

const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
};
type Next = () => number;
const pick = <T>(next: Next, items: readonly T[]): T =>
  items[Math.floor(next() * items.length)] as T;

const TARGETS = [
  "/articles/target-post",
  "/articles/other#section",
  "https://ofriperetz.dev/articles/x",
  "https://ofriperetz.dev",
  "https://www.npmjs.com/package/eslint-plugin-jwt",
  "https://github.com/ofri-peretz/eslint",
  "https://doi.org/10.1016/j.patrec.2005.10.010",
  "https://owasp.org/Top10/",
  "https://eslint.interlace.tools/docs",
  "#local-anchor",
  "mailto:someone@example.com",
];
const WORDS = ["Read", "the", "rule", "fires", "here", "·", "and", "—", "x"];

/** One line of an article: prose, a link, a heading with an anchor, or a fenced block. */
const line = (next: Next): string => {
  const words = () =>
    Array.from({ length: 1 + Math.floor(next() * 5) }, () =>
      pick(next, WORDS),
    ).join(" ");
  const link = () => `[${words()}](${pick(next, TARGETS)})`;
  switch (Math.floor(next() * 5)) {
    case 0:
      return words();
    case 1:
      return `${words()} ${link()} ${words()} ${link()}`;
    case 2:
      return `## ${words()} ${link()} {#anchor-${String(Math.floor(next() * 9))}}`;
    case 3:
      return `\`\`\`ts\nconst url = "${pick(next, TARGETS)}"; // [kept](${pick(next, TARGETS)})\n\`\`\``;
    default:
      return `- ${link()}`;
  }
};
const body = (next: Next): string =>
  Array.from({ length: 1 + Math.floor(next() * 8) }, () => line(next)).join(
    "\n",
  );

const forAll = (check: (generated: string) => void): void => {
  const next = random(SEED);
  for (let run = 0; run < RUNS; run += 1) check(body(next));
};

/** Every inline link target outside fenced code. */
const targetsOutsideFences = (text: string): string[] => {
  let inFence = false;
  const found: string[] = [];
  for (const one of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(one)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence)
      for (const m of one.matchAll(/\]\(([^()\s]+)\)/g)) found.push(m[1] ?? "");
  }
  return found;
};

describe("transformBodyForDevto (properties)", () => {
  it("is idempotent on any body: a second pass changes nothing", () => {
    forAll((generated) => {
      const once = transformBodyForDevto(generated, SLUG);
      expect({ generated, twice: transformBodyForDevto(once, SLUG) }).toEqual({
        generated,
        twice: once,
      });
    });
  });

  it("routes every web link outside code through /go/, and leaves fenced code as written", () => {
    forAll((generated) => {
      const out = transformBodyForDevto(generated, SLUG);
      const leaked = targetsOutsideFences(out).filter(
        (target) =>
          !target.startsWith("https://ofriperetz.dev/go/") &&
          !target.startsWith("#") &&
          !target.startsWith("mailto:"),
      );
      expect({ generated, leaked }).toEqual({ generated, leaked: [] });
      const fences = (text: string) => text.match(/```ts\n[^`]*```/g) ?? [];
      expect(fences(out)).toEqual(fences(generated));
    });
  });

  it("collects one stored row per routed key, each key unique", () => {
    forAll((generated) => {
      const keys = collectDevtoLinks(generated, SLUG).map((row) => row.key);
      expect({ generated, keys }).toEqual({
        generated,
        keys: [...new Set(keys)],
      });
    });
  });
});
