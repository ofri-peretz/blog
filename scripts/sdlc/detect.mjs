#!/usr/bin/env node
// Stage-6 orchestrator: run every detector, and turn a 3σ / drifted finding
// into a committed incident plus the intent that reopens the loop.
//
// This is the step that makes the chain a loop rather than a pipeline. No
// person is in the invocation path — a scheduled workflow runs it, and what
// lands is an intent in the triage queue with the evidence already attached.
import { execFileSync } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, INCIDENT_DIR, INTENT_DIR } from "./lib.mjs";

const WRITE = !process.argv.includes("--dry-run");
const TODAY = (process.env.SDLC_TODAY || new Date().toISOString()).slice(0, 10);

const DETECTORS = [
  { name: "stale-claim", script: "detect-stale-claims.mjs" },
  { name: "link-health", script: "check-links.mjs" },
  { name: "reception-band", script: "reception-band.mjs" },
];

/** Detectors print a `::detector-json::` line so the orchestrator reads
 *  structured results without re-implementing each detector's logic. */
function run({ name, script }) {
  let out = "";
  try {
    out = execFileSync(process.execPath, [join(ROOT, "scripts/sdlc", script)], {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 10 * 60_000,
      stdio: ["ignore", "pipe", "inherit"],
    });
  } catch (error) {
    // A detector exiting non-zero still reports; only a crash loses its output.
    out = error.stdout?.toString() ?? "";
  }
  console.log(out.replace(/\n?::detector-json::.*\n?/, "\n"));
  const line = out.split("\n").find((l) => l.startsWith("::detector-json::"));
  if (!line) {
    console.error(`  ${name}: produced no structured result`);
    return { detector: name, findings: [] };
  }
  try {
    return JSON.parse(line.slice("::detector-json::".length));
  } catch {
    return { detector: name, findings: [] };
  }
}

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

function writeIncident({
  detector,
  severity,
  articles,
  summary,
  evidence,
  intentPath,
}) {
  mkdirSync(INCIDENT_DIR, { recursive: true });
  const name = `${TODAY}-${slugify(`${detector}-${articles[0] ?? "corpus"}`)}.md`;
  const file = join(INCIDENT_DIR, name);
  if (existsSync(file)) return { file, created: false };

  const body = `---
stage: incident
detected: ${TODAY}
detector: ${detector}
severity: ${severity}
articles: [${articles.map((a) => `"${a}"`).join(", ")}]
intent: ${intentPath ?? ""}
status: open
---

## What the detector saw

${summary}

\`\`\`
${evidence}
\`\`\`

## Class

${
  detector === "stale-claim"
    ? "A claim that was true when written and is false now. No review pass can catch this class — nothing in the article changed. If this recurs for the same spec, the spec's command is not specific enough, and that is an eval gap rather than an author mistake."
    : detector === "link-health"
      ? "A referenced URL stopped resolving. Upstream 404s are not always ours to fix; the triage decision is whether to repoint, remove, or accept."
      : "Reception below the corpus control band. Distribution and title are the usual causes before content quality — check the title formula before rewriting the body."
}

## Triage

_Pending. Rewrite | retire | ignore — and why._
`;
  if (WRITE) writeFileSync(file, body);
  return { file: file.replace(`${ROOT}/`, ""), created: true };
}

function writeIntent({ detector, articles, summary, incidentFile }) {
  mkdirSync(INTENT_DIR, { recursive: true });
  const slug = slugify(`fix-${detector}-${articles[0] ?? "corpus"}`);
  const file = join(INTENT_DIR, `${slug}.md`);
  if (existsSync(file)) return { file, created: false };

  const body = `---
id: I-AUTO-${TODAY.replace(/-/g, "")}
slug: ${slug}
stage: intent
status: proposed
visibility: public
opened: ${TODAY}
opened_by: detector
approved_by:
---

## Claim

${summary}

## Audience

Readers of ${articles.map((a) => `\`${a}\``).join(", ")}, and anyone who has linked to them.

## Why us

These are our published claims. A claim we made and no longer verify is worse
than one we never made — it is the corpus arguing against its own thesis, which
is that a checked fact outlives a remembered one.

## Evidence we believe exists

- [x] Detector output, attached in ${incidentFile}

## Kill criterion

If the drift is cosmetic — a version bump that does not change the number a
reader acts on — this is closed as \`ignored\` with that reasoning recorded,
not silently dropped.

## Title candidates

n/a — corrective work on published articles.

## Tier

n/a
`;
  if (WRITE) writeFileSync(file, body);
  return { file: file.replace(`${ROOT}/`, ""), created: true };
}

const opened = [];
for (const detector of DETECTORS) {
  console.log(`\n=== ${detector.name} ===`);
  const result = run(detector);
  const findings = result.findings ?? [];
  if (!findings.length) continue;

  // Only these two rise to opening an intent. 1σ and 2σ reception, and every
  // link finding, are logged — a detector that opens an intent for routine
  // variance trains everyone to close intents without reading them.
  const escalate = findings.filter(
    (f) => detector.name === "stale-claim" || f.severity === "3sigma",
  );
  if (!escalate.length) {
    console.log(
      `  ${findings.length} finding(s), none at escalation threshold — logged only.`,
    );
    continue;
  }

  const articles = [...new Set(escalate.map((f) => f.slug))];
  const summary =
    detector.name === "stale-claim"
      ? `${escalate.length} committed claim(s) no longer match the command that produced them.`
      : `${escalate.length} article(s) fell 3σ below the corpus reception band.`;
  const evidence = escalate
    .map((f) =>
      detector.name === "stale-claim"
        ? `${f.slug} — ${f.claim}\n  expected ${f.expected}   now ${f.actual}\n  ${f.command}`
        : `${f.slug}  ${f.sigma}σ  ${f.views} views`,
    )
    .join("\n");

  const incident = writeIncident({
    detector: detector.name,
    severity: detector.name === "stale-claim" ? "3sigma" : "3sigma",
    articles,
    summary,
    evidence,
  });
  const intent = writeIntent({
    detector: detector.name,
    articles,
    summary,
    incidentFile: incident.file,
  });
  opened.push({ incident: incident.file, intent: intent.file });
}

console.log("\n=== stage 6 ===");
if (!opened.length) {
  console.log("No breach. Nothing entered the triage queue.");
} else {
  for (const o of opened)
    console.log(`opened  ${o.intent}\n        ${o.incident}`);
  console.log(
    `\n${opened.length} intent(s) in the triage queue. They are \`proposed\` — a detector may open an intent, only Ofri approves one into stage 2.`,
  );
}
if (!WRITE) console.log("\n(--dry-run: nothing was written)");
