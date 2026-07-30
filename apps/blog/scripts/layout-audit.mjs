#!/usr/bin/env node
// Real-layout audit: overflow, overlap, tap targets and colour contrast, across
// a viewport matrix. Drives the Chrome that is already installed, over CDP,
// using node's built-in WebSocket — no Playwright, no puppeteer, no install.
//
//   node scripts/layout-audit.mjs                       # against production
//   BASE=http://localhost:3000 node scripts/layout-audit.mjs   # local dev
//   node scripts/layout-audit.mjs --json               # machine-readable
//
// Requires node >= 22 (global WebSocket). Exit code 1 if any violation is found,
// so CI can gate on it.
//
// ponytail: one Chrome launch, one tab, reused across the whole matrix. Setting
// device metrics is far cheaper than a browser or page per case.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

// Defaults to the deployed site. A local run passes BASE explicitly — the
// default deliberately carries no plaintext-http literal, which the security
// lint (correctly) treats as a smell in shipped source.
const BASE = process.env.BASE ?? "https://ofriperetz.dev";
const JSON_OUT = process.argv.includes("--json");

// Consciously-accepted findings. See the file's own $comment for the rules;
// the short version is that entries must justify themselves, and everything
// not listed still fails the build.
const BASELINE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "layout-audit-baseline.json",
);
const BASELINE = existsSync(BASELINE_PATH)
  ? (JSON.parse(readFileSync(BASELINE_PATH, "utf-8")).accepted ?? [])
  : [];
// `label()` emits "tag[.class][#id]", so an unanchored substring test is
// catastrophically broad: b.el "a" matched button.action, nav, article,
// textarea and any class containing an "a". That silenced nearly every tap
// finding on the route instead of the one case it was written for. Match the
// TAG exactly, at a boundary, and require the declared context too.
const tagMatches = (label, tag) =>
  label === tag ||
  label.startsWith(`${tag}.`) ||
  label.startsWith(`${tag}#`) ||
  label.startsWith(`${tag}[`);
const matchesBaseline = (kind, route, finding) =>
  BASELINE.find(
    (b) =>
      b.kind === kind &&
      route.startsWith(b.route) &&
      tagMatches(finding.el ?? finding.a ?? "", b.el) &&
      // A baseline entry without a ctx would be a route-wide silencer.
      Boolean(b.ctx) &&
      finding.ctx === b.ctx,
  );

// Sampling "a few popular device widths" is the classic way to miss responsive
// bugs, because a layout almost never breaks AT a round number — it breaks one
// pixel either side of a breakpoint, where a grid drops a column or a `hidden
// sm:flex` swaps in. So the matrix is built FROM the breakpoints this codebase
// actually uses (sm/md/lg/xl = 640/768/1024/1280 — `sm:` alone appears 49
// times), testing each boundary and the pixel below it.
//
// The narrow end is sampled by device because below `sm` there are no
// breakpoints left to straddle: 320 is the narrowest viewport worth
// supporting, 360 the most common Android, 390 a modern iPhone, 414 a "plus".
// 1920 catches anything assuming a max container.
//
// Heights are deliberately short so "below the fold" never hides an overflow.
const BREAKPOINTS = [640, 768, 1024, 1280]; // Tailwind sm, md, lg, xl
const VIEWPORTS = [
  ...[320, 360, 390, 414].map((w) => ({ w, h: 720 })),
  // Each breakpoint and the pixel below it: the two layouts either side of
  // every switch the code can make.
  ...BREAKPOINTS.flatMap((b) => [
    { w: b - 1, h: 800 },
    { w: b, h: 800 },
  ]),
  ...[1440, 1920].map((w) => ({ w, h: 900 })),
];

const ROUTES = (
  process.env.ROUTES ??
  // An article page is the longest and densest layout here (prose, code
  // blocks, tables, a cover) and was the obvious omission from the first
  // matrix — the routes that LIST articles were covered, the one that renders
  // one was not.
  "/,/articles,/articles/getting-started-eslint-plugin-mongodb-security,/npm,/scorecard,/foundations"
).split(",");

// AA has to hold in BOTH themes, and only one was ever measured. The tokens are
// checked in both by contrast-lock.test.ts, but rendered contrast can differ
// from token contrast wherever a component hardcodes or composites.
const SCHEMES = (process.env.SCHEMES ?? "dark,light").split(",");

// Probe rather than assume: the previous macOS-only default failed with a bare
// ENOENT for anyone on Linux, including a runner invoking this without CHROME.
const CHROME_CANDIDATES = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) {
  console.error(
    "No Chrome found. Set CHROME=/path/to/chrome. Looked in:\n  " +
      CHROME_CANDIDATES.join("\n  "),
  );
  process.exit(2);
}
const PORT = 9333;

// ── The audit, executed inside the page ────────────────────────────────────
// Kept as a single self-contained function: it is stringified and evaluated in
// the page, so it cannot close over anything from this module.
const AUDIT_FN = function auditPage() {
  const vw = document.documentElement.clientWidth;
  // Report the theme the DOM actually adopted. If the emulation never reached
  // the app, every "light" run would really be a second dark run and the
  // matrix would double in cost while proving nothing.
  const renderedTheme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
  const out = { renderedTheme, overflow: [], overlap: [], tapTargets: [], contrast: [] };

  const label = (el) => {
    const cls =
      el.className && el.className.baseVal !== undefined
        ? el.className.baseVal
        : el.className || "";
    const id = el.id ? `#${el.id}` : "";
    const slot = el.getAttribute?.("data-slot");
    return (
      el.tagName.toLowerCase() +
      id +
      (slot ? `[data-slot=${slot}]` : "") +
      (cls ? `.${String(cls).trim().split(/\s+/).slice(0, 3).join(".")}` : "")
    );
  };

  // ── 1. Horizontal overflow ───────────────────────────────────────────────
  // The document itself scrolling sideways is always a bug. Individual
  // elements sticking out are only a bug when nothing clips or scrolls them —
  // a wide <table> inside overflow-x:auto is correct and must not be flagged.
  const docOverflow = document.documentElement.scrollWidth - vw;
  const isHandled = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/auto|scroll|hidden|clip/.test(cs.overflowX)) return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" || cs.display === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 && !isHandled(el)) {
      out.overflow.push({ el: label(el), over: Math.round(r.right - vw) });
    }
  }

  // ── 2. Overlap of text/interactive boxes ─────────────────────────────────
  // Only leaf-ish boxes are compared: ancestors legitimately contain their
  // descendants, and siblings legitimately stack when positioned.
  // Only compare boxes that are BOTH in normal flow. An in-flow heading whose
  // box happens to sit under an absolutely-positioned rail or overlay is
  // layering on purpose, and flagging it drowns the real signal — content
  // colliding with content, which is always two in-flow boxes.
  const inFlow = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const pos = getComputedStyle(p).position;
      if (pos === "absolute" || pos === "fixed" || pos === "sticky") return false;
    }
    return true;
  };
  const boxes = [];
  for (const el of document.querySelectorAll(
    "a,button,input,select,textarea,h1,h2,h3,h4,p,li,td,th",
  )) {
    const cs = getComputedStyle(el);
    if (cs.position !== "static" || cs.display === "none") continue;
    if (!inFlow(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (!el.textContent?.trim() && !el.matches("input,select,textarea")) continue;
    boxes.push({ el, r });
  }
  // Compare PER-LINE rects, not the bounding box. An inline link that wraps
  // has a getBoundingClientRect() spanning every line it touches, so two
  // ordinary links in the same paragraph "overlap" while their rendered text
  // never comes close. getClientRects() returns the actual line boxes, which
  // is what a reader — and a finger — actually meets.
  const overlaps = (ra, rb) => {
    const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
    const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    return ox > 2 && oy > 2 ? ox * oy : 0; // 2px absorbs rounding and borders
  };
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // Cheap reject on the union boxes before the O(lines²) comparison.
      if (!overlaps(a.r, b.r)) continue;
      let area = 0;
      for (const ra of a.el.getClientRects()) {
        for (const rb of b.el.getClientRects()) area = Math.max(area, overlaps(ra, rb));
      }
      if (area > 0) {
        out.overlap.push({ a: label(a.el), b: label(b.el), area: Math.round(area) });
      }
    }
  }

  // ── 3. Tap targets (WCAG 2.2 SC 2.5.8, AA: 24x24 CSS px) ─────────────────
  // A visually-hidden control (the skip link) is 1x1 by design and only takes
  // size on focus. Detecting the sr-only clip rather than the class name keeps
  // this honest for any implementation of the pattern.
  const isScreenReaderOnly = (cs) =>
    cs.position === "absolute" &&
    (cs.clipPath === "inset(50%)" || cs.clip === "rect(0px, 0px, 0px, 0px)");
  for (const el of document.querySelectorAll(
    'a,button,[role="button"],input:not([type=hidden]),select',
  )) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    if (isScreenReaderOnly(cs)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // Inline links inside a paragraph are explicitly exempt in SC 2.5.8.
    if (el.tagName === "A" && el.closest("p,li")) continue;
    if (r.width < 24 || r.height < 24) {
      // ctx = the nearest structural ancestor. Without it a baseline entry can
      // only say "some <a> on this route", which is indistinguishable from
      // "all of them".
      const ctxEl = el.closest("td,th,nav,header,footer,figure,pre");
      out.tapTargets.push({
        el: label(el),
        ctx: ctxEl ? ctxEl.tagName.toLowerCase() : "",
        size: `${Math.round(r.width)}x${Math.round(r.height)}`,
      });
    }
  }

  // ── 4. Colour contrast (WCAG AA) ─────────────────────────────────────────
  // Walks real text nodes and resolves the effective background by climbing
  // until an opaque colour is found, compositing any translucent layers on the
  // way. That composite step is the one axe-style checks usually get right and
  // hand-rolled ones get wrong: `bg-primary/10` is not `--primary`.
  // Do NOT regex colour strings. getComputedStyle now returns lab(), oklch(),
  // color(srgb ...) and friends depending on how the author wrote them — this
  // site's body background computes to `lab(2.75 0 0)`. A regex that only knew
  // rgb() silently returned null, effectiveBg then found no opaque ancestor,
  // fell back to WHITE, and every text node on a dark page measured ~1:1. That
  // produced 2,450 phantom violations and would have hidden real ones.
  //
  // Canvas is the browser's own parser: fillStyle accepts any CSS colour and
  // getImageData hands back sRGB bytes plus real alpha.
  const _cv = document.createElement("canvas");
  _cv.width = _cv.height = 1;
  const _ctx = _cv.getContext("2d", { willReadFrequently: true });
  const parse = (c) => {
    if (!c || c === "transparent") return [0, 0, 0, 0];
    // fillStyle silently keeps its previous value when handed something it
    // cannot parse, so prime it with a sentinel and check that it moved.
    _ctx.fillStyle = "#000000";
    _ctx.fillStyle = c;
    const accepted = _ctx.fillStyle;
    _ctx.fillStyle = "#ffffff";
    _ctx.fillStyle = c;
    if (_ctx.fillStyle !== accepted) return null; // unparseable
    _ctx.clearRect(0, 0, 1, 1);
    _ctx.fillRect(0, 0, 1, 1);
    const d = _ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (fg, bg) => {
    const a = fg[3];
    return [
      fg[0] * a + bg[0] * (1 - a),
      fg[1] * a + bg[1] * (1 - a),
      fg[2] * a + bg[2] * (1 - a),
      1,
    ];
  };
  const lin = (v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (f, b) => {
    const [hi, lo] = [lum(f), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const effectiveBg = (el) => {
    const layers = [];
    for (let p = el; p; p = p.parentElement) {
      const c = parse(getComputedStyle(p).backgroundColor);
      if (!c || c[3] === 0) continue;
      layers.push(c);
      if (c[3] === 1) break;
    }
    if (!layers.length) return [255, 255, 255, 1];
    let acc = layers[layers.length - 1];
    for (let i = layers.length - 2; i >= 0; i--) acc = over(layers[i], acc);
    return acc;
  };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim();
    if (text.length < 2) continue;
    const el = n.parentElement;
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0")
      continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const key = label(el) + "|" + text.slice(0, 20);
    if (seen.has(key)) continue;
    seen.add(key);
    const fgRaw = parse(cs.color);
    if (!fgRaw) continue;
    const bg = effectiveBg(el);
    const fg = fgRaw[3] < 1 ? over(fgRaw, bg) : fgRaw;
    const px = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    // WCAG "large text": >=24px, or >=18.66px when bold.
    const large = px >= 24 || (px >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(fg, bg);
    if (got < need) {
      const ctxEl2 = el.closest("pre,code,td,th,nav,header,footer");
      out.contrast.push({
        el: label(el),
        ctx: ctxEl2 ? ctxEl2.tagName.toLowerCase() : "",
        text: text.slice(0, 34),
        got: Math.round(got * 100) / 100,
        need,
        px: Math.round(px),
      });
    }
  }

  return { vw, docOverflow, ...out };
};

// ── CDP plumbing ───────────────────────────────────────────────────────────
let msgId = 0;
function send(ws, method, params = {}, sessionId) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (m.id !== id) return;
      ws.removeEventListener("message", onMsg);
      m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result);
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

async function main() {
  // Every exit path below must reach chrome.kill(); an orphan holds PORT and
  // the next run's /json/version probe then attaches to the WRONG browser.
  let chrome;
  let ws;
  try {
    return await run();
  } finally {
    try {
      ws?.close();
    } catch {
      /* already closed */
    }
    chrome?.kill();
  }

  async function run() {
  chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      // CI containers run as root with a tiny /dev/shm; without these two
      // Chrome exits immediately and the only symptom is the debugging port
      // never opening. Harmless locally.
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--hide-scrollbars", // otherwise the scrollbar itself eats ~15px and fakes overflow
      "--force-prefers-reduced-motion", // animations must not race the measurement
      "--user-data-dir=/tmp/layout-audit-profile",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let chromeErr = "";
  chrome.stderr?.on("data", (d) => {
    chromeErr += d.toString();
  });

  let wsUrl;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      wsUrl = (await r.json()).webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  if (!wsUrl) {
    throw new Error(
      `Chrome (${CHROME}) never opened its debugging port.\n` +
        `Chrome said:\n${chromeErr.trim() || "(nothing on stderr)"}`,
    );
  }

  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });

  const { targetId } = await send(ws, "Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send(ws, "Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  await send(ws, "Page.enable", {}, sessionId);
  await send(ws, "Runtime.enable", {}, sessionId);

  const results = [];
  for (const scheme of SCHEMES) {
    await send(
      ws,
      "Emulation.setEmulatedMedia",
      { features: [{ name: "prefers-color-scheme", value: scheme }] },
      sessionId,
    );
    for (const route of ROUTES) {
      for (const vp of VIEWPORTS) {
        await send(
          ws,
          "Emulation.setDeviceMetricsOverride",
          { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 768 },
          sessionId,
        );
        const loaded = new Promise((res) => {
          const on = (ev) => {
            const m = JSON.parse(ev.data);
            if (m.method === "Page.loadEventFired" && m.sessionId === sessionId) {
              ws.removeEventListener("message", on);
              res();
            }
          };
          ws.addEventListener("message", on);
        });
        await send(ws, "Page.navigate", { url: BASE + route }, sessionId);
        await Promise.race([loaded, sleep(15000)]);
        await sleep(500); // let fonts settle; layout shifts after webfont swap

        const { result, exceptionDetails } = await send(
          ws,
          "Runtime.evaluate",
          {
            expression: `(${AUDIT_FN.toString()})()`,
            returnByValue: true,
            awaitPromise: false,
          },
          sessionId,
        );
        if (exceptionDetails) {
          results.push({ route, vp: vp.w, scheme, error: exceptionDetails.text });
          continue;
        }
        const value = result.value;
        // Assert, do not merely record. If setEmulatedMedia never reaches the
        // app — say it reads localStorage instead of the media query — every
        // "light" iteration would silently re-measure dark, and the matrix would
        // double in cost while proving exactly nothing.
        if (value.renderedTheme && value.renderedTheme !== scheme) {
          results.push({
            route,
            vp: vp.w,
            scheme,
            error:
              `theme emulation did not take: asked for "${scheme}", ` +
              `DOM rendered "${value.renderedTheme}"`,
          });
          continue;
        }
        results.push({ route, vp: vp.w, scheme, ...value });
      }
    }
  }

  return results;
  }
}

const results = await main();

if (JSON_OUT) {
  console.log(JSON.stringify(results, null, 2));
} else {
  let bad = 0;
  let accepted = 0;
  const usedBaseline = new Set();
  // Strip accepted findings BEFORE counting, so the summary reflects what is
  // actually being gated on.
  for (const r of results) {
    for (const kind of ["overflow", "overlap", "tapTargets", "contrast"]) {
      if (!Array.isArray(r[kind])) continue;
      const short = kind === "tapTargets" ? "tap" : kind;
      r[kind] = r[kind].filter((f) => {
        const hit = matchesBaseline(short, r.route, f);
        if (hit) {
          accepted++;
          usedBaseline.add(hit.reason);
          return false;
        }
        return true;
      });
    }
  }
  for (const r of results) {
    const issues =
      (r.docOverflow > 0 ? 1 : 0) +
      (r.overflow?.length ?? 0) +
      (r.overlap?.length ?? 0) +
      (r.tapTargets?.length ?? 0) +
      (r.contrast?.length ?? 0);
    if (r.error) {
      console.log(`✗ ${r.route} @${r.vp} ${r.scheme}  ERROR ${r.error}`);
      bad++;
      continue;
    }
    if (!issues) {
      console.log(`✓ ${r.route} @${r.vp} ${r.scheme}`);
      continue;
    }
    bad++;
    console.log(`✗ ${r.route} @${r.vp} ${r.scheme}`);
    if (r.docOverflow > 0)
      console.log(`    document scrolls sideways by ${r.docOverflow}px`);
    for (const o of r.overflow.slice(0, 4))
      console.log(`    overflow  +${o.over}px  ${o.el}`);
    for (const o of r.overlap.slice(0, 4))
      console.log(`    overlap   ${o.area}px²  ${o.a}  ×  ${o.b}`);
    for (const t of r.tapTargets.slice(0, 4))
      console.log(`    tap       ${t.size}  ${t.el}`);
    for (const c of r.contrast.slice(0, 4))
      console.log(
        `    contrast  ${c.got}:1 (need ${c.need}) ${c.px}px  "${c.text}"  ${c.el}`,
      );
  }
  console.log(
    `\n${results.length - bad}/${results.length} route×viewport combinations clean`,
  );
  if (accepted) {
    console.log(`${accepted} finding(s) matched the baseline and were not gated on:`);
    for (const reason of usedBaseline) console.log(`  - ${reason.slice(0, 140)}`);
  }
  // A baseline entry that no longer matches anything is stale — surface it so
  // the list shrinks as things get fixed, rather than quietly rotting.
  const unused = BASELINE.filter((b) => !usedBaseline.has(b.reason));
  if (unused.length) {
    console.log(`\n${unused.length} baseline entr(y/ies) matched nothing and can be deleted:`);
    for (const b of unused) console.log(`  - ${b.kind} ${b.route} ${b.el}`);
  }
  process.exit(bad ? 1 : 0);
}
