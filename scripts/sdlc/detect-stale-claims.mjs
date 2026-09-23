#!/usr/bin/env node
// Stage-6 detector: a claim that was true when written and is false now.
//
// This is the detector no review pass can replace. When a plugin ships four
// more rules, an article saying "27 rules" becomes wrong without anything in
// the article changing — so there is no diff to review and no author to catch
// it. The only way to see it is to re-run the command the spec committed.
//
// SAFETY: this executes the commands recorded in sdlc/spec/*.md. Those are
// first-party files that go through PR review like any other code; treat a PR
// that adds a spec command with the same scrutiny as one that adds an npm
// script. It is never run against untrusted input.
import { execSync } from "node:child_process";
import { specs, ROOT, isNumericValue } from "./lib.mjs";

const findings = [];
let manual = 0;

for (const spec of specs()) {
  for (const claim of spec.claims) {
    if (!isNumericValue(claim.value)) continue;
    // A prose procedure is evidence for a reviewer, never input for a shell.
    if (!claim.command) {
      if (claim.evidence) manual += 1;
      continue;
    }

    let actual;
    try {
      // `set -u`: an unset variable aborts the command instead of expanding to
      // "" — `npx "vercel@$VERCEL_CLI_VERSION"` must fail, not run `npx vercel@`.
      actual = execSync(`set -u; ${claim.command}`, {
        cwd: ROOT,
        encoding: "utf-8",
        timeout: 60_000,
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch (error) {
      findings.push({
        slug: spec.slug,
        claim: claim.claim,
        kind: "command-failed",
        expected: claim.value,
        actual: (error.stderr || error.message || "")
          .toString()
          .trim()
          .split("\n")[0],
        command: claim.command,
      });
      continue;
    }

    // Compare the recorded value against the command's output loosely: a spec
    // may record "27 rules" where the command prints "27".
    const expected = String(claim.value).replace(/[^\d.]/g, "");
    const got = actual.replace(/[^\d.]/g, "");
    if (expected && got && expected !== got) {
      findings.push({
        slug: spec.slug,
        claim: claim.claim,
        kind: "drifted",
        expected: claim.value,
        actual,
        command: claim.command,
        version: claim.version,
      });
    }
  }
}

for (const f of findings) {
  const label = f.kind === "drifted" ? "DRIFTED" : "COMMAND FAILED";
  console.log(`${label}  ${f.slug} — ${f.claim}`);
  console.log(`  expected ${f.expected}   now ${f.actual}`);
  console.log(`  ${f.command}`);
}
console.log(
  findings.length
    ? `\n${findings.length} stale claim(s). Each affects every article built on that spec.`
    : "All spec claims still hold.",
);
if (manual) {
  console.log(
    `${manual} claim(s) record a prose procedure rather than one runnable command; they are not re-run here.`,
  );
}

process.stdout.write(
  `\n::detector-json::${JSON.stringify({ detector: "stale-claim", findings })}\n`,
);
process.exitCode = findings.length ? 1 : 0;
