/**
 * Counts characters per rendered line of article body text.
 *
 * COUNTS, does not compute. `ch` is the zero glyph's advance — 1.418x the
 * average glyph in Geist — so a column set to 65ch renders ~85 characters.
 * Two earlier estimates in this repo (76, then 83.6) divided width by an
 * "average glyph advance" and disagreed with each other, because that average
 * depends on the sample string. This walks the text node with a Range, groups
 * by line box, and counts.
 *
 * Contract: docs/TYPOGRAPHY.md — 45-75 characters, target 66.
 */
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const ROUTE =
  process.env.MEASURE_ROUTE ??
  "/articles/getting-started-eslint-plugin-secure-coding";
const WIDTHS = (process.env.MEASURE_WIDTHS ?? "1280,390")
  .split(",")
  .map((n) => Number(n.trim()))
  .filter((n) => n > 0);

const CHROME = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean).find((c) => existsSync(c));

const COUNT_FN = () => {
  const lens = [];
  for (const para of document.querySelectorAll(".prose p")) {
    if (para.children.length) continue;
    const node = para.firstChild;
    if (!node || node.nodeType !== 3) continue;
    const text = node.textContent ?? "";
    if (text.length < 200) continue;
    const rng = document.createRange();
    let top = null;
    let count = 0;
    for (let i = 0; i < text.length; i++) {
      rng.setStart(node, i);
      rng.setEnd(node, i + 1);
      const rect = rng.getClientRects()[0];
      if (!rect) continue;
      if (top === null) top = rect.top;
      if (Math.abs(rect.top - top) > 1) {
        lens.push(count);
        top = rect.top;
        count = 1;
      } else count++;
    }
    if (lens.length >= 12) break;
  }
  // Drop the last (partial) line of each paragraph run: it is not a measure.
  lens.sort((a, b) => a - b);
  return {
    lines: lens.length,
    median: lens.length ? lens[Math.floor(lens.length / 2)] : 0,
    min: lens[0] ?? 0,
    max: lens[lens.length - 1] ?? 0,
  };
};

export async function measure() {
  const browser = await chromium.launch(
    CHROME ? { executablePath: CHROME } : { channel: "chrome" },
  );
  const out = [];
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + ROUTE, {
        waitUntil: "load",
        timeout: 60000,
      });
      // Webfonts change glyph widths, so the measure is meaningless until they
      // land. `document.fonts.ready` is the real signal, not a sleep.
      await page.evaluate(() => document.fonts.ready);
      out.push({ width, ...(await page.evaluate(COUNT_FN)) });
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await measure();
  let bad = 0;
  for (const r of rows) {
    const ok = r.lines > 0 && r.median >= 45 && r.median <= 75;
    if (!ok) bad++;
    console.log(
      `${ok ? "✓" : "✗"} @${r.width}px  median ${r.median} chars ` +
        `(${r.min}-${r.max}, ${r.lines} lines)  contract 45-75`,
    );
  }
  process.exit(bad ? 1 : 0);
}
