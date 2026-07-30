// WCAG AA contrast, enforced on the TOKENS rather than on rendered pages.
//
// Why here and not only in the browser audit: this runs in milliseconds with no
// browser, so it gates every commit, and it catches the failure the moment a
// token changes rather than after a deploy. The browser audit (scripts/
// layout-audit.mjs) still runs over real pages — the two are complementary:
// this proves the palette is sound, that proves the palette is USED soundly.
//
// The trap this exists for: a token pair can pass on flat surfaces and fail on
// a TINTED one. `bg-primary/10` is not `--primary` — it composites against
// whatever is behind it. That exact case shipped a 6.63:1 badge in the sibling
// design-system repo and only axe caught it, after a deploy. Composites are
// checked here explicitly.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(
  path.resolve(__dirname, "..", "app", "globals.css"),
  "utf-8",
);

// ── colour maths ───────────────────────────────────────────────────────────
type RGB = [number, number, number];

/** oklch(L C H) → sRGB 0-255. The tokens are authored in oklch. */
function oklchToRgb(L: number, C: number, Hdeg: number): RGB {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lin = [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((v) => {
    const g = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(g * 255)));
  }) as RGB;
}

/** Parsed colour plus its alpha. Alpha is CAPTURED, never assumed to be 1:
 *  a token written `oklch(L C H / 0.5)` that is silently read as opaque would
 *  report a contrast ratio the user never sees — the exact class of silent
 *  wrongness this file exists to catch. */
function parseColorAlpha(raw: string): { rgb: RGB; alpha: number } | null {
  const s = raw.trim();
  const ok = s.match(
    /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/,
  );
  if (ok) {
    const L = ok[1].endsWith("%") ? parseFloat(ok[1]) / 100 : parseFloat(ok[1]);
    const a = ok[4]
      ? ok[4].endsWith("%")
        ? parseFloat(ok[4]) / 100
        : parseFloat(ok[4])
      : 1;
    return { rgb: oklchToRgb(L, parseFloat(ok[2]), parseFloat(ok[3])), alpha: a };
  }
  const hex8 = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})$/i);
  if (hex8) {
    const n = parseInt(hex8[1], 16);
    return {
      rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255],
      alpha: parseInt(hex8[2], 16) / 255,
    };
  }
  const h = s.match(/^#([0-9a-f]{6})$/i);
  if (h) {
    const n = parseInt(h[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  return null;
}

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  const parsed = parseColorAlpha(s);
  return parsed ? parsed.rgb : null;
}

const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (c: RGB) =>
  0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** Composite `fg` at `alpha` over an opaque `bg` — what bg-x/10 actually is. */
const composite = (fg: RGB, bg: RGB, alpha: number): RGB =>
  fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))) as RGB;

// ── token extraction ───────────────────────────────────────────────────────
function block(selector: string): Record<string, string> {
  // `[^}]*` rather than `[\s\S]*?\n\}`: the old form required a newline
  // immediately before the closing brace, so a formatter collapsing the last
  // declaration onto the brace line would make this return {} — and the tests
  // would then pass VACUOUSLY. Declarations never contain `}`, so this is both
  // simpler and formatting-proof.
  const re = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  );
  const m = CSS.match(re);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const d = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/i);
    if (d) out[d[1]] = d[2].trim();
  }
  return out;
}

/** Resolves `var(--x)` chains, then parses. */
function resolve(
  name: string,
  scope: Record<string, string>,
  root: Record<string, string>,
  depth = 0,
): RGB | null {
  if (depth > 8) return null;
  const raw = scope[name] ?? root[name];
  if (!raw) return null;
  const v = raw.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
  if (v) return resolve(v[1], scope, root, depth + 1);
  return parseColor(raw);
}

const ROOT = block(":root");
const DARK = block(".dark");

const THEMES: Array<[string, Record<string, string>]> = [
  ["light", ROOT],
  ["dark", { ...ROOT, ...DARK }],
];

// Foreground/background pairs the UI actually renders, with the WCAG level each
// must clear. 4.5 = normal text (AA 1.4.3); 3 = large text and UI components
// (AA 1.4.11). Nothing here is decorative.
const PAIRS: Array<{ fg: string; bg: string; min: number; note: string }> = [
  { fg: "--foreground", bg: "--background", min: 4.5, note: "body text" },
  { fg: "--card-foreground", bg: "--card", min: 4.5, note: "card text" },
  { fg: "--muted-foreground", bg: "--background", min: 4.5, note: "secondary text" },
  { fg: "--muted-foreground", bg: "--muted", min: 4.5, note: "text on muted" },
  { fg: "--muted-foreground", bg: "--card", min: 4.5, note: "card meta text" },
  { fg: "--primary-foreground", bg: "--primary", min: 4.5, note: "primary button" },
  { fg: "--accent-foreground", bg: "--accent", min: 4.5, note: "accent surface" },
  { fg: "--primary", bg: "--background", min: 4.5, note: "link / accent text" },
  { fg: "--brand-orange", bg: "--background", min: 4.5, note: "brand orange text" },
  { fg: "--brand-green", bg: "--background", min: 4.5, note: "brand green text" },
  // --input, not --border: 1.4.11 covers "visual information required to
  // identify user interface components". A form field's boundary qualifies; a
  // decorative divider or card edge does not, and asserting on --border would
  // force every hairline on the site to be near-black.
  { fg: "--input", bg: "--background", min: 3, note: "form control boundary" },
];

/**
 * Translucent surfaces the code ACTUALLY renders, e.g. `bg-muted/40`, read out
 * of the components rather than imagined. Text routinely sits on these, and a
 * composited surface is not the token it is named after — that mismatch is how
 * a 6.63:1 badge shipped in the sibling design-system repo.
 *
 * Deriving them from source means the check cannot go stale: add a new tint in
 * a component and it is covered on the next run; remove one and the assertion
 * stops testing a combination nobody renders.
 */
function usedTints(): Array<{ token: string; alpha: number }> {
  const dir = path.resolve(__dirname, "..");
  // recursive readdirSync does the descent in one call — no hand-built paths,
  // so nothing here can escape `dir`.
  const files = readdirSync(dir, { recursive: true, encoding: "utf-8" })
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => path.join(dir, f));
  const found = new Map<string, { token: string; alpha: number }>();
  const re = /\bbg-(background|card|muted|accent|primary|secondary)\/(\d{1,3})\b/g;
  for (const f of files) {
    for (const m of readFileSync(f, "utf-8").matchAll(re)) {
      const token = `--${m[1]}`;
      const alpha = Number(m[2]) / 100;
      if (alpha > 0 && alpha < 1) found.set(`${token}/${m[2]}`, { token, alpha });
    }
  }
  return [...found.values()];
}

describe("WCAG AA contrast — design tokens", () => {
  // Guards against a VACUOUS pass. A count check is not enough: if `.dark`
  // failed to parse, ROOT alone still satisfied both counts and every
  // assertion below would trivially pass while testing one theme. Naming the
  // tokens means a parse failure surfaces as a parse failure.
  it("parses both theme blocks, with the tokens the assertions depend on", () => {
    for (const [name, block] of [
      ["ROOT", ROOT],
      ["DARK", DARK],
    ] as const) {
      for (const token of [
        "--background",
        "--foreground",
        "--muted",
        "--muted-foreground",
        "--primary",
      ]) {
        expect(block[token], `${name} is missing ${token}`).toBeDefined();
      }
    }
    // The two themes must actually differ, or one selector matched the other.
    expect(DARK["--background"]).not.toEqual(ROOT["--background"]);
  });

  it.each(THEMES)("%s: every semantic pair clears AA", (themeName, scope) => {
    const failures: string[] = [];
    for (const { fg, bg, min, note } of PAIRS) {
      const f = resolve(fg, scope, ROOT);
      const b = resolve(bg, scope, ROOT);
      if (!f || !b) {
        failures.push(`${themeName}: ${fg} on ${bg} — token missing or unparsed`);
        continue;
      }
      const got = contrast(f, b);
      if (got < min) {
        failures.push(
          `${themeName}: ${fg} on ${bg} = ${got.toFixed(2)}:1, need ${min} (${note})`,
        );
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("finds the translucent surfaces the components actually use", () => {
    // Sanity: if this ever returns nothing the tint assertion below is vacuous
    // and would pass while testing nothing.
    expect(usedTints().length).toBeGreaterThan(0);
  });

  it.each(THEMES)(
    "%s: text stays AA on every translucent surface the code renders",
    (themeName, scope) => {
      const page = resolve("--background", scope, ROOT);
      expect(page).not.toBeNull();
      const failures: string[] = [];
      for (const { token, alpha } of usedTints()) {
        const base = resolve(token, scope, ROOT);
        if (!base) continue;
        const surface = composite(base, page!, alpha);
        // Pair each surface with the foreground token shadcn actually renders
        // on it. `bg-primary/90` is a button face carrying
        // --primary-foreground; asserting --foreground there would be checking
        // a combination the UI never produces.
        const PAIRED: Record<string, string[]> = {
          "--primary": ["--primary-foreground"],
          "--accent": ["--accent-foreground"],
        };
        const fgTokens = PAIRED[token] ?? ["--foreground", "--muted-foreground"];
        for (const fgToken of fgTokens) {
          const fg = resolve(fgToken, scope, ROOT);
          if (!fg) continue;
          const got = contrast(fg, surface);
          if (got < 4.5) {
            failures.push(
              `${themeName}: ${fgToken} on ${token}/${Math.round(alpha * 100)} = ${got.toFixed(2)}:1, need 4.5`,
            );
          }
        }
      }
      expect(failures, failures.join("\n")).toEqual([]);
    },
  );
});
