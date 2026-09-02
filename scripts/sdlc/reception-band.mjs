#!/usr/bin/env node
// Stage-6 detector: reception control bands over the published corpus.
//
// Western Electric, as the playbook prescribes: 1σ log, 2σ diagnose, 3σ open
// an intent. Reception is noisy and slow, so this band is weekly and
// advisory — it never pages and never blocks a build.
//
// SIGNAL: page views are only exposed on the authenticated `/api/articles/me/all`
// endpoint. Without DEVTO_API_KEY the public endpoint returns
// `page_views_count: 0` for every article — which, if used naively, produces a
// σ of 0 and a confident "0 below band" report on no data at all. So the
// detector picks the best signal available, names it in the output, and
// refuses to report rather than report on nothing.
//
// The distribution is heavily skewed (the top article is ~23% of all views),
// so bands are computed on log10(x + 1). Raw values would put the mean above
// the median and flag most of the corpus as underperforming — a detector that
// cries wolf is one everybody learns to close unread.
import { articles, isPublished } from "./lib.mjs";

const USERNAME = process.env.DEVTO_USERNAME || "ofri-peretz";
const KEY = process.env.DEVTO_API_KEY;

const skip = (reason) => {
  console.error(reason);
  process.stdout.write(
    `\n::detector-json::${JSON.stringify({ detector: "reception-band", findings: [], skipped: true, reason })}\n`,
  );
  process.exit(0);
};

const url = KEY
  ? "https://dev.to/api/articles/me/all?per_page=1000"
  : `https://dev.to/api/articles?username=${USERNAME}&per_page=1000`;

let remote;
try {
  const res = await fetch(url, {
    headers: KEY ? { "api-key": KEY } : {},
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok)
    skip(`dev.to API returned ${res.status}; skipping reception band.`);
  remote = await res.json();
} catch (error) {
  skip(`dev.to API unreachable (${error.message}); skipping reception band.`);
}

const byId = new Map(remote.map((r) => [r.id, r]));
const observed = articles()
  .filter(isPublished)
  .map((a) => ({ slug: a.slug, remote: byId.get(a.data.devto_id) }))
  .filter((a) => a.remote)
  .map((a) => ({
    slug: a.slug,
    views: a.remote.page_views_count ?? 0,
    engagement:
      (a.remote.public_reactions_count ?? 0) + (a.remote.comments_count ?? 0),
  }));

if (observed.length < 8)
  skip(`Only ${observed.length} articles matched dev.to; too few for a band.`);

// Prefer views; fall back to reactions+comments. Either way, require the
// signal to actually vary — a corpus where every value is identical carries no
// information, and saying so is the honest output.
const totalViews = observed.reduce((s, a) => s + a.views, 0);
const signal = totalViews > 0 ? "views" : "engagement";
const valueOf = (a) => (signal === "views" ? a.views : a.engagement);

if (observed.reduce((s, a) => s + valueOf(a), 0) === 0) {
  skip(
    `No reception signal available.\n` +
      `  page_views_count is 0 for every article, which is what the PUBLIC dev.to\n` +
      `  endpoint returns — views need DEVTO_API_KEY and /api/articles/me/all.\n` +
      `  Reactions and comments are also all zero, so there is nothing to band.\n` +
      `  Set DEVTO_API_KEY to enable this detector.`,
  );
}

const logs = observed.map((a) => Math.log10(valueOf(a) + 1));
const mean = logs.reduce((s, v) => s + v, 0) / logs.length;
const sd = Math.sqrt(
  logs.reduce((s, v) => s + (v - mean) ** 2, 0) / logs.length,
);

if (sd === 0)
  skip(`Every article reports the same ${signal}; no variance to band.`);

// Only the low side is a finding. An article 3σ ABOVE the mean is a promotion
// signal, reported separately — it is not a defect.
const sigmaOf = (a) => (Math.log10(valueOf(a) + 1) - mean) / sd;

const findings = [];
const promote = [];
for (const a of observed) {
  const z = Number(sigmaOf(a).toFixed(2));
  const severity =
    z <= -3 ? "3sigma" : z <= -2 ? "2sigma" : z <= -1 ? "1sigma" : null;
  if (severity) findings.push({ ...a, sigma: z, severity, signal });
  if (z >= 2) promote.push({ ...a, sigma: z });
}

console.log(
  `signal: ${signal}${signal === "engagement" ? "  (views need DEVTO_API_KEY)" : ""}\n` +
    `corpus: ${observed.length} articles · geometric mean ${(10 ** mean - 1).toFixed(1)} · σ ${sd.toFixed(2)} (log10)\n`,
);
for (const f of findings.sort((a, b) => a.sigma - b.sigma)) {
  console.log(
    `${f.severity.padEnd(7)} ${String(f.sigma).padStart(6)}σ  ${String(valueOf(f)).padStart(5)}  ${f.slug}`,
  );
}
if (promote.length) {
  console.log(`\nAbove band — promotion candidates, not defects:`);
  for (const p of promote)
    console.log(`  +${p.sigma}σ  ${String(valueOf(p)).padStart(5)}  ${p.slug}`);
}
console.log(
  `\n${findings.length} below band · ${findings.filter((f) => f.severity === "3sigma").length} at 3σ.`,
);

process.stdout.write(
  `\n::detector-json::${JSON.stringify({ detector: "reception-band", findings, promote, signal })}\n`,
);
