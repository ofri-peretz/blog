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
import { readFileSync } from "node:fs";
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
    expect(WORKFLOW).toContain("--article ${{ inputs.article }}");
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
