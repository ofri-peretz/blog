#!/usr/bin/env node
// Real-browser journey audit: the interactive contracts a reader relies
// on, driven end-to-end with trusted input. Every assertion here was
// first proven by hand with CDP-trusted keystrokes the night the
// surfaces shipped — synthetic DOM events LIED about Enter/Escape and
// focus, so a jsdom test cannot stand in for this file.
//
//   npm run audit:journeys          # against production
//   BASE=http://localhost:3000 node scripts/journey-audit.mjs
//
// Exit 1 on any failed journey, so CI can gate on it. Same
// playwright-core driver conventions as layout-audit.mjs (which owns
// process lifecycle lessons — see its header).
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "https://ofriperetz.dev";

/**
 * Navigation budget for the journeys that still need `waitUntil: "load"`.
 *
 * #224 moved the code-block journey to `domcontentloaded` and was right to:
 * its subject is the block being attached, which its own `waitFor` asserts, so
 * `load` was a stricter precondition than the claim.
 *
 * The two palette journeys cannot follow it. The command palette input is
 * rendered late enough that `domcontentloaded` does not have it — switching
 * them makes the first journey fail OUTRIGHT, verified against a local
 * production build and still failing with the element wait raised to 15s. For
 * these two, `load` is carrying a correctness requirement rather than being
 * merely stricter.
 *
 * So they keep `load` and get patience instead. 30s was not enough on a cold
 * runner, which is the same "one slow subresource" failure #224 describes —
 * the difference is that here the condition cannot be weakened, so the budget
 * moves.
 */
const NAV_MS = Number(process.env.JOURNEY_NAV_MS ?? 90000);

// A code-heavy article that exists in the corpus (layout-audit's
// "most code blocks" extreme) — the copy journey needs real blocks.
const CODE_ARTICLE = "/articles/getting-started-eslint-plugin-secure-coding";

if (process.env.CHROME && !existsSync(process.env.CHROME)) {
  console.error(`CHROME=${process.env.CHROME} does not exist.`);
  process.exit(2);
}
const CHROME_CANDIDATES = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const executablePath = CHROME_CANDIDATES.find((c) => existsSync(c));

const browser = await chromium
  .launch({
    ...(executablePath ? { executablePath } : { channel: "chrome" }),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })
  .catch((err) => {
    console.error(
      `Could not launch Chrome.\n${err.message}\n\nSet CHROME=/path/to/chrome. Looked in:\n  ` +
        CHROME_CANDIDATES.join("\n  "),
    );
    process.exit(2);
  });

const failures = [];
const pass = (name) => console.log(`✓ ${name}`);
const fail = (name, detail) => {
  console.log(`✗ ${name}\n    ${detail}`);
  failures.push(name);
};

const context = await browser.newContext({
  reducedMotion: "reduce",
  // The copy journey verifies the CLIPBOARD CONTENT, not just the label
  // flip — the honesty fix means the flip only follows a real write,
  // but reading the write back closes the loop.
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();

try {
  // ── 1. Grep the corpus: the full keyboard journey ─────────────────
  // ⌘K/Ctrl+K opens with focus in the input; typing filters; ArrowDown
  // highlights; Enter navigates AND closes. This is the palette's whole
  // reason to exist — if any key stops working, the feature is
  // decoration.
  //
  // The query comes from the palette's OWN index (/search-index.json),
  // not a hardcoded guess: slugs are frozen while titles get rebranded,
  // and the first version of this journey typed a slug-derived phrase
  // that matched nothing — the filter was right and the test was wrong.
  try {
    const res = await page.request.get(`${BASE}/search-index.json`);
    if (!res.ok()) throw new Error(`search index HTTP ${res.status()}`);
    const docs = await res.json();
    const doc = docs.find((d) => d.title.length >= 20) ?? docs[0];
    if (!doc) throw new Error("search index is empty");
    await page.goto(`${BASE}/articles`, { waitUntil: "load", timeout: NAV_MS });
    await page.keyboard.press("ControlOrMeta+KeyK");
    const input = page.locator('[data-slot="command-palette-input"]');
    await input.waitFor({ state: "visible", timeout: 5000 });
    // Base UI sets initial focus asynchronously after mount — poll
    // rather than asserting the instant the input becomes visible.
    await page
      .waitForFunction(
        () =>
          document.activeElement ===
          document.querySelector('[data-slot="command-palette-input"]'),
        undefined,
        { timeout: 3000 },
      )
      .catch(() => {
        throw new Error("palette opened but the input never received focus");
      });
    // The lazy index may still be in flight; typing races it safely —
    // Base UI filters whatever arrives. The full title is its own
    // haystack substring, so exactly this doc must surface.
    await page.keyboard.type(doc.title, { delay: 5 });
    await page
      .locator('[role="option"]', { hasText: doc.title.slice(0, 30) })
      .first()
      .waitFor({ state: "visible", timeout: 5000 });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForURL(new RegExp(`/articles/${doc.slug}$`), {
      timeout: 10000,
    });
    const paletteCount = await page
      .locator('[data-slot="command-palette-content"]')
      .count();
    if (paletteCount !== 0)
      throw new Error("navigated but the palette stayed open");
    pass("palette: ⌘K → type → ↓ → Enter navigates to the exact match");
  } catch (err) {
    fail(
      "palette: ⌘K → type → ↓ → Enter navigates to the exact match",
      err.message,
    );
  }

  // ── 2. Escape closes and restores focus to the trigger ────────────
  try {
    await page.goto(`${BASE}/articles`, { waitUntil: "load", timeout: NAV_MS });
    await page.locator('[data-slot="corpus-search-trigger"]').click();
    await page
      .locator('[data-slot="command-palette-input"]')
      .waitFor({ state: "visible", timeout: 5000 });
    await page.keyboard.press("Escape");
    await page
      .locator('[data-slot="command-palette-content"]')
      .waitFor({ state: "detached", timeout: 5000 });
    const focusRestored = await page.evaluate(
      () =>
        document.activeElement?.getAttribute("data-slot") ===
        "corpus-search-trigger",
    );
    if (!focusRestored)
      throw new Error("palette closed but focus did not return to the trigger");
    pass("palette: Escape closes and restores focus to the trigger");
  } catch (err) {
    fail(
      "palette: Escape closes and restores focus to the trigger",
      err.message,
    );
  }

  // ── 3. Copy is a receipt: click writes the EXACT code text ────────
  //
  try {
    // domcontentloaded, NOT load. `load` waits for every subresource on the
    // page; a single slow or hanging image/font request means it never fires
    // and the whole journey times out — which is what happened here four
    // times, on a PRODUCTION build, so it was never about compilation.
    //
    // An earlier fix warmed the route on the theory that cold dev compilation
    // was eating the budget. That was wrong: this job runs `next start`, the
    // route is prebuilt, and the failure reproduced with the warm-up in place.
    // Removed rather than left in as cargo.
    //
    // The real gate is the waitFor below: the journey needs the code block
    // ATTACHED, and that is what it now waits for. `load` was asserting
    // something stricter than the test's own subject.
    await page.goto(`${BASE}${CODE_ARTICLE}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const block = page.locator('[data-slot="code-block"]').first();
    await block.waitFor({ state: "attached", timeout: 10000 });
    const expected = await block
      .locator('[data-slot="code-block-code"]')
      .evaluate((el) => el.textContent ?? "");
    await block.locator('[data-slot="code-block-copy"]').click();
    // The honesty fix: "Copied!" only follows a SUCCESSFUL write.
    await block
      .locator('[data-slot="code-block-copy"]')
      .getByText("Copied!")
      .waitFor({ timeout: 5000 });
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    if (clip !== expected) {
      throw new Error(
        `clipboard holds ${clip.length} chars, code has ${expected.length} — not the same text`,
      );
    }
    pass("code block: copy click writes the exact code text to the clipboard");
  } catch (err) {
    fail(
      "code block: copy click writes the exact code text to the clipboard",
      err.message,
    );
  }
} finally {
  await browser.close();
}

console.log(
  `\n${failures.length === 0 ? "all journeys hold" : `${failures.length} journey(s) broken`}`,
);
process.exit(failures.length ? 1 : 0);
