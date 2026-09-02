// Workflow YAML lock.
//
// A malformed workflow file does not fail loudly. GitHub creates a run with
// zero jobs, marks it `failure`, and serves no log — so the PR shows a red
// check that cannot be opened, and the workflow silently stops running.
//
// That is not hypothetical: adding a `claude_args` key to
// claude-code-review.yml produced a DUPLICATE of one already present further
// down the same `with:` block. The file stopped parsing, two pushes produced
// phantom zero-job runs, and the only symptom was a red check with "log not
// found". A single `yaml.parse` would have caught it before the push.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const WORKFLOWS = resolve(__dirname, "../../../../.github/workflows");

const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));

describe("workflow YAML", () => {
  it("there are workflows to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f] as const))("%s parses", (file) => {
    const src = readFileSync(join(WORKFLOWS, file), "utf-8");
    // yaml@2 rejects duplicate keys by default, which is the case that bit us.
    expect(() => parse(src)).not.toThrow();
  });

  it.each(files.map((f) => [f] as const))("%s declares triggers", (file) => {
    const doc = parse(readFileSync(join(WORKFLOWS, file), "utf-8"));
    // `on` is the YAML 1.1 boolean-true gotcha: some parsers key it as `true`.
    const triggers = doc?.on ?? doc?.[true as unknown as string];
    expect(
      triggers && Object.keys(triggers).length > 0,
      `${file}: no triggers — the workflow can never run`,
    ).toBe(true);
  });

  // claude_args is a command-line argument string, not YAML. A `#` line inside
  // it is not a comment — it is handed to the CLI as arguments. When that
  // happened the run reported SUCCESS in about a second with zero agent turns:
  // a green check on a review that never ran, which is worse than a red one.
  it.each(files.map((f) => [f] as const))(
    "%s keeps comments out of claude_args",
    (file) => {
      const doc = parse(readFileSync(join(WORKFLOWS, file), "utf-8"));
      const offenders: string[] = [];
      for (const [jobName, job] of Object.entries<Record<string, unknown>>(
        doc?.jobs ?? {},
      )) {
        for (const step of (job.steps as Record<string, unknown>[]) ?? []) {
          const args = (step.with as Record<string, unknown> | undefined)
            ?.claude_args;
          if (typeof args !== "string") continue;
          const commented = args
            .split("\n")
            .filter((line) => line.trim().startsWith("#"));
          if (commented.length) {
            offenders.push(
              `${jobName}: ${commented.length} comment line(s) inside claude_args`,
            );
          }
        }
      }
      expect(
        offenders,
        `${file}: move the explanation above the key —\n  ${offenders.join("\n  ")}`,
      ).toEqual([]);
    },
  );

  it.each(files.map((f) => [f] as const))(
    "%s has at least one job with steps",
    (file) => {
      const doc = parse(readFileSync(join(WORKFLOWS, file), "utf-8"));
      const jobs = doc?.jobs ?? {};
      expect(Object.keys(jobs).length, `${file}: no jobs`).toBeGreaterThan(0);
      for (const [name, job] of Object.entries<Record<string, unknown>>(jobs)) {
        const steps = job.steps as unknown[] | undefined;
        expect(
          Array.isArray(steps) && steps.length > 0,
          `${file}: job "${name}" has no steps`,
        ).toBe(true);
      }
    },
  );
});
