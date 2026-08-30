#!/usr/bin/env node
// Stage-6 detector: link health across published articles.
//
// Advisory by design. Upstream 404s are not always ours to fix, and a dead
// third-party link must never wedge a deploy — but it must be reported rather
// than silently accepted, which is the state we were in.
import { articles, isPublished } from "./lib.mjs";

const LINK = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)|<(https?:\/\/[^>\s]+)>/g;
const CONCURRENCY = 8;

// Hosts that refuse automated requests outright. Probing them produces a
// verdict about their bot policy, not about our link.
const SKIP_HOST = /(^|\.)(x\.com|twitter\.com|linkedin\.com|reddit\.com)$/i;

// Hosts that serve humans fine but answer CI with 403/429. A status from these
// is UNVERIFIABLE, not broken — counting them as findings buried the two real
// 404s in this corpus under 130 npm bot-protection responses, which is how a
// detector teaches everyone to ignore it.
const BOT_PROTECTED =
  /(^|\.)(npmjs\.com|npmjs\.org|doi\.org|medium\.com|bloomberg\.com)$/i;
const UNVERIFIABLE_STATUS = new Set([401, 403, 405, 406, 429]);

function classify(url, status) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return "broken";
  }
  if (BOT_PROTECTED.test(host) && UNVERIFIABLE_STATUS.has(status))
    return "unverifiable";
  return "broken";
}

function urlsIn(article) {
  const found = new Set();
  for (const m of article.body.matchAll(LINK)) found.add(m[1] || m[2]);
  for (const key of [
    "canonical_url",
    "cover_image",
    "social_image",
    "devto_url",
  ]) {
    if (article.data[key]) found.add(String(article.data[key]));
  }
  return [...found].filter((u) => {
    try {
      return !SKIP_HOST.test(new URL(u).hostname);
    } catch {
      return false;
    }
  });
}

const targets = [];
for (const a of articles().filter(isPublished)) {
  for (const url of urlsIn(a)) targets.push({ slug: a.slug, url });
}

// Probe each distinct URL once, then fan the verdict back out to the articles
// that reference it — the corpus cross-links heavily and re-probing would
// multiply the request count for no extra signal.
const distinct = [...new Set(targets.map((t) => t.url))];
const verdict = new Map();

async function probe(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      // Some hosts reject HEAD with 403/405 but serve GET fine.
      if (res.ok || (method === "GET" && res.status < 400))
        return { ok: true, status: res.status };
      if (method === "GET") return { ok: false, status: res.status };
    } catch (error) {
      if (method === "GET")
        return {
          ok: false,
          status: error.name === "TimeoutError" ? "timeout" : "unreachable",
        };
    }
  }
  return { ok: false, status: "unreachable" };
}

const queue = [...distinct];
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let url = queue.pop(); url; url = queue.pop()) {
      verdict.set(url, await probe(url));
    }
  }),
);

const unhealthy = targets
  .filter((t) => !verdict.get(t.url)?.ok)
  .map((t) => ({ ...t, status: verdict.get(t.url).status }))
  .map((t) => ({ ...t, kind: classify(t.url, t.status) }));

const findings = unhealthy.filter((t) => t.kind === "broken");
const unverifiable = unhealthy.filter((t) => t.kind === "unverifiable");

for (const f of findings)
  console.log(`${String(f.status).padEnd(11)} ${f.slug} -> ${f.url}`);
console.log(
  `\n${distinct.length} distinct link(s) probed across ${new Set(targets.map((t) => t.slug)).size} articles.\n` +
    `${findings.length} broken · ${unverifiable.length} unverifiable (bot-protected host, not a defect).`,
);
if (unverifiable.length) {
  const hosts = [...new Set(unverifiable.map((u) => new URL(u.url).hostname))];
  console.log(`  unverifiable hosts: ${hosts.join(", ")}`);
}

process.stdout.write(
  `\n::detector-json::${JSON.stringify({ detector: "link-health", findings, unverifiable: unverifiable.length })}\n`,
);
// Advisory: never a non-zero exit.
