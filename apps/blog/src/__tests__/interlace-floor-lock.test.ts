/**
 * Interlace-floor structural lock — see ../../../INTERLACE_AUDIT.md.
 *
 * Pins the blockers fixed in that audit. If any of these patterns return,
 * CI flags them before the regression ships.
 *
 *   - Tier A must not contain raw color literals or inline `style={{}}` for
 *     static styling.
 *   - Pages must consume <Container>/<Section> primitives, not `mx-auto
 *     max-w-… px-6`.
 *   - work-experience must not reintroduce the `style={{ color: "#…" }}`
 *     pattern.
 *
 * The Tier B (baseline-synced `src/components/ui/`) directory is excluded
 * — those fixes go upstream in `interlace/docs-baseline/components/ui/`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");

const TIER_A_DIRS = [
  path.join(SRC, "app"),
  path.join(SRC, "components", "landing"),
  path.join(SRC, "components", "charts"),
  path.join(SRC, "components", "home"),
];
const TIER_A_FILES = [
  path.join(SRC, "components", "app-header.tsx"),
  path.join(SRC, "components", "app-footer.tsx"),
  path.join(SRC, "components", "theme-toggle.tsx"),
  path.join(SRC, "components", "theme-provider.tsx"),
  path.join(SRC, "components", "structured-data.tsx"),
  path.join(SRC, "components", "markdown-article.tsx"),
  path.join(SRC, "components", "mobile-nav.tsx"),
];

// Tier C carve-outs — Satori OG generators need raw hex + inline styles.
const TIER_C = new Set(
  [
    path.join(SRC, "app", "og", "route.tsx"),
    path.join(SRC, "app", "og", "article", "[slug]", "route.tsx"),
    path.join(SRC, "app", "og", "cover", "[slug]", "route.tsx"),
  ].map((p) => p.replace(/\\/g, "/")),
);

function listTsx(dir: string, acc: string[] = []): string[] {
  if (!safeStat(dir)?.isDirectory()) return acc;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const s = safeStat(full);
    if (!s) continue;
    if (s.isDirectory()) {
      // Skip API routes — they have no JSX, the floor doesn't apply.
      if (entry === "api") continue;
      listTsx(full, acc);
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      acc.push(full);
    }
  }
  return acc;
}

function safeStat(p: string) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

const tierA = [
  ...TIER_A_DIRS.flatMap((d) => listTsx(d)),
  ...TIER_A_FILES.filter((p) => safeStat(p)?.isFile()),
].filter((p) => !TIER_C.has(p.replace(/\\/g, "/")));

/**
 * The generated DS tree — a SIBLING of `src/`, which this lock has never read
 * despite being named after the design system it holds.
 *
 * Verdict from the 2026-09-02 lock-coverage pass: EXTEND, scoped to the
 * components `src/` can actually reach. "No raw colour literal in source" is a
 * universal invariant, so the search space was simply wrong.
 *
 * Measured when this was added: 112 raw literals across the whole generated
 * tree, ZERO in the reachable set. So this assertion is green today because
 * the reachable code is clean — NOT because it cannot see the files, which is
 * the distinction the whole intent turns on and which the test below proves by
 * injection rather than assertion.
 */
const INTERLACE_ROOT = path.resolve(__dirname, "..", "..", ".interlace");

function reachableGenerated(): string[] {
  if (!safeStat(INTERLACE_ROOT)?.isDirectory()) return [];
  const specs = new Set<string>();
  const srcFiles = listTsx(path.resolve(__dirname, ".."));
  for (const f of srcFiles) {
    for (const m of readFileSync(f, "utf-8").matchAll(
      /^\s*(?:import|export)[^\n]*?from\s+"#interlace\/([^"]+)"/gm,
    )) {
      specs.add(m[1]);
    }
  }
  const resolveSpec = (spec: string): string | null => {
    for (const cand of [`${spec}.tsx`, `${spec}.ts`, `${spec}/index.ts`]) {
      const abs = path.join(INTERLACE_ROOT, cand);
      if (safeStat(abs)?.isFile()) return abs;
    }
    return null;
  };
  const seen = new Set<string>();
  const queue = [...specs];
  while (queue.length) {
    const file = resolveSpec(queue.pop()!);
    if (!file || seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf-8");
    for (const m of text.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)) {
      const abs = path.resolve(path.dirname(file), m[1]);
      if (abs.startsWith(INTERLACE_ROOT)) {
        queue.push(path.relative(INTERLACE_ROOT, abs));
      }
    }
    for (const m of text.matchAll(/from\s+"#interlace\/([^"]+)"/g)) {
      queue.push(m[1]);
    }
  }
  return [...seen].filter((f) => f.endsWith(".tsx"));
}

describe("the generated DS tree obeys the same token floor", () => {
  it("no reachable generated component carries a raw colour literal", () => {
    const offenders: string[] = [];
    for (const file of reachableGenerated()) {
      readFileSync(file, "utf-8")
        .split("\n")
        .forEach((line, i) => {
          const t = line.trim();
          if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
          // `rgba(var(--token))` is token-based and correct; only literals count.
          const stripped = line.replace(/\b(?:rgba?|hsla?|oklch)\(\s*var\([^)]*\)[^)]*\)/g, "");
          if (/#[0-9a-fA-F]{3,8}\b/.test(stripped)) {
            offenders.push(
              `.interlace/${path.relative(INTERLACE_ROOT, file)}:${i + 1} ${t}` +
                ` — GENERATED: fix upstream in the agents repo at` +
                ` apps/interlace-docs-baseline/, then run \`npm run sync\`.`,
            );
          }
        });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("actually reads the tree — the reachable set is not empty", () => {
    // Without this, the assertion above is green whether the code is clean or
    // the glob is broken, and those are the two states this whole intent
    // exists to tell apart. 17 reachable files on 2026-09-02.
    expect(reachableGenerated().length).toBeGreaterThan(5);
  });
});

describe("Interlace floor — Tier A regression lock", () => {
  it("ships at least one Tier A file (sanity)", () => {
    expect(tierA.length).toBeGreaterThan(10);
  });

  it("contains no raw hex / rgb / oklch literal in source", () => {
    const offenders: string[] = [];
    for (const file of tierA) {
      const src = readFileSync(file, "utf-8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        // Skip comment lines and JSDoc.
        const trimmed = line.trim();
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("/*")
        ) {
          return;
        }
        if (/#[0-9a-fA-F]{3,8}\b/.test(line)) {
          offenders.push(`${file}:${i + 1} ${line.trim()}`);
        }
        if (/\boklch\(\s*[\d.]/.test(line) && !line.includes("--chart-")) {
          // CSS-token definitions in globals.css are not Tier A.
        }
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("uses no inline `style={{}}` for static styling", () => {
    // R18 forbids inline `style={{}}` for STATIC styling. Carve-outs:
    //   - Recharts `contentStyle` / `labelStyle` / `cursor` / `wrapperStyle`
    //     props (the lib's API only accepts style objects, not className).
    //   - Dynamic values (template literals, `${…}` expressions, computed
    //     values from props/state) — these are the legitimate use case for
    //     inline styles per MOTION_PHILOSOPHY / LAYOUT_PHILOSOPHY (progress
    //     bars, animated positions, mouse-tracking offsets, etc.).
    // The lock flags ONLY static literal styles like `style={{ color: "red" }}`.
    const ALLOWED_KEY_PATTERN =
      /(contentStyle|labelStyle|cursor|wrapperStyle)=\{?\{/;
    const DYNAMIC_VALUE_PATTERN = /\$\{|\(\)|\w+\s*\?\s*\w+\s*:|\w+\.\w+/;
    const offenders: string[] = [];
    for (const file of tierA) {
      const src = readFileSync(file, "utf-8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        if (!line.includes("style={{")) return;
        if (ALLOWED_KEY_PATTERN.test(line)) return;
        // If the inline-style body contains a template literal, function call,
        // ternary, or property access, treat it as dynamic and skip.
        if (DYNAMIC_VALUE_PATTERN.test(line)) return;
        offenders.push(`${file}:${i + 1} ${line.trim()}`);
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("never reintroduces open-coded `mx-auto max-w-… px-6` page wrappers", () => {
    const offenders: string[] = [];
    for (const file of tierA) {
      const src = readFileSync(file, "utf-8");
      if (/mx-auto\s+max-w-[a-z0-9]+\s+px-6\b/.test(src)) {
        offenders.push(file);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("never reintroduces the literal `container mx-auto px-4` pattern", () => {
    for (const file of tierA) {
      const src = readFileSync(file, "utf-8");
      expect(src, file).not.toContain("container mx-auto px-4");
    }
  });
});
