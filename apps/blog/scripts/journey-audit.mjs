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
    await page.goto(`${BASE}/articles`, { waitUntil: "load", timeout: 30000 });
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
    if (paletteCount !== 0) throw new Error("navigated but the palette stayed open");
    pass("palette: ⌘K → type → ↓ → Enter navigates to the exact match");
  } catch (err) {
    fail("palette: ⌘K → type → ↓ → Enter navigates to the exact match", err.message);
  }

  // ── 2. Escape closes and restores focus to the trigger ────────────
  try {
    await page.goto(`${BASE}/articles`, { waitUntil: "load", timeout: 30000 });
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
    fail("palette: Escape closes and restores focus to the trigger", err.message);
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

  // ── 4. The newsletter form actually submits ───────────────────────
  //
  // This journey exists because the form shipped to production without
  // ever having been submitted by a browser. Unit tests covered the
  // server action directly, and `curl` confirmed the markup — neither
  // touches the half that can actually break here: hydration and event
  // wiring. `useActionState` + a server action + a Base UI checkbox
  // fails in exactly that half, and a form that renders perfectly and
  // never submits looks identical to a working one in both of those
  // checks.
  //
  // WHAT IT ASSERTS: that the form leaves its idle state. With valid
  // input a validation error is impossible, so ANY terminal state —
  // success or the action's error message — proves the whole round trip
  // ran: React hydrated, the click reached the action, the server
  // executed it, and the result rendered.
  //
  // It deliberately does NOT assert a row was written, and the address is
  // the reason. @example.com is RFC 2606 reserved, so the action's
  // UNREACHABLE guard rejects it BEFORE it ever looks at credentials —
  // which means this is safe everywhere, not just in CI. (Review caught an
  // earlier version of this comment claiming the "unavailable" branch ran;
  // that is true only where credentials are absent, and the first working
  // version of this journey wrote a real row on a developer machine
  // because of exactly that assumption.) A run must never add rows to the
  // real subscriber table, and the write path already has direct coverage. The end-to-end proof (browser →
  // row) was done once by hand against production and recorded in the
  // browser-verification intent; this is the repeatable half.
  try {
    // domcontentloaded, not load: `load` waits for every subresource and
    // one hanging request sinks the navigation (that flake cost five CI
    // runs). The element waits below are the real gate.
    await page.goto(`${BASE}${CODE_ARTICLE}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const form = page.locator('[data-slot="article-subscribe"]');
    await form.waitFor({ state: "attached", timeout: 10000 });

    await form.locator('input[type="email"]').fill("journey@example.com");
    // Base UI renders the consent control as a hidden native input paired
    // with a visible control, so .check() on the input can fail as "not
    // visible". Clicking the LABEL toggles it whichever shape it takes,
    // and is what a person actually does.
    await form
      .locator('label:has([name="consent"])')
      .click({ timeout: 10000 });
    await form.locator('button[type="submit"]').click();

    // Either terminal state ends the wait. Racing them means a real
    // failure surfaces as its own message rather than a bare timeout.
    const settled = page
      .locator('[data-testid="article-subscribe-done"], [data-slot="article-subscribe"] [role="alert"]')
      .first();
    await settled.waitFor({ state: "visible", timeout: 20000 });

    const text = (await settled.textContent())?.trim() ?? "";
    if (!text) throw new Error("the form settled into an empty state");
    pass("newsletter: filling and submitting the form reaches a terminal state");
  } catch (err) {
    fail(
      "newsletter: filling and submitting the form reaches a terminal state",
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
