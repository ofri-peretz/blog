#!/usr/bin/env node
// Scaffold stages 1-3 for a new article from the committed templates.
//
//   npm run sdlc:new -- my-article-slug
//
// The templates are not suggestions — the locks parse the fields they define,
// so starting from them is the difference between a chain and three loose
// files.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const slug = process.argv[2];
if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error("usage: npm run sdlc:new -- <lowercase-hyphenated-slug>");
  process.exit(2);
}

const TODAY = (process.env.SDLC_TODAY || new Date().toISOString()).slice(0, 10);
const stages = [
  ["sdlc/intent", "TEMPLATE.md"],
  ["sdlc/spec", "TEMPLATE.md"],
  ["sdlc/plan", "TEMPLATE.md"],
];

const created = [];
for (const [dir, template] of stages) {
  const target = join(ROOT, dir, `${slug}.md`);
  if (existsSync(target)) {
    console.error(`exists, left alone: ${dir}/${slug}.md`);
    continue;
  }
  copyFileSync(join(ROOT, dir, template), target);
  const filled = readFileSync(target, "utf-8")
    .replaceAll("the-article-slug", slug)
    .replace(/^opened: .*$/m, `opened: ${TODAY}`)
    .replace(/^gathered: .*$/m, `gathered: ${TODAY}`);
  writeFileSync(target, filled);
  created.push(`${dir}/${slug}.md`);
}

console.log(
  created.length ? `created:\n  ${created.join("\n  ")}` : "nothing to do",
);
console.log(
  `\nStage 1 first: fill the intent and get it approved before gathering any\n` +
    `ground truth. An intent written after the research is a rationalisation.`,
);
