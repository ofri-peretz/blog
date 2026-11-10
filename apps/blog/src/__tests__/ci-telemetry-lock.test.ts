// CI telemetry lock.
//
// The build always carries the PostHog project token (next.config.ts commits
// a fallback), so any server started from it exports OTel spans to the
// production project as `service.name = blog`. CI's browser-audit serves the
// build with `next start` and has no Supabase credentials, so
// /api/homepage-stats answers 503 there by design. Those spans read as a
// production error rate on the endpoint, and an APM scout reported them as
// one (2026-11-10). Every 503 in that window sat inside a CI run.
//
// Two halves, both pinned: register() honours OTEL_SDK_DISABLED, and every
// workflow step that serves a build sets it.
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

const WORKFLOWS = resolve(__dirname, "../../../../.github/workflows");

type Env = Record<string, unknown> | undefined;
type Job = { env?: Env; steps?: Record<string, unknown>[] };

function disabled(...envs: Env[]): boolean {
  return envs.some((env) => String(env?.OTEL_SDK_DISABLED) === "true");
}

/** Every `next start` step as `[label, OTel disabled?]`. */
function serverSteps(): [string, boolean][] {
  const found: [string, boolean][] = [];
  const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
  for (const file of files) {
    const doc = parse(readFileSync(join(WORKFLOWS, file), "utf-8"));
    const jobs = Object.entries<Job>(doc?.jobs ?? {});
    for (const [jobName, job] of jobs) {
      const servers = (job.steps ?? []).filter(
        (step) =>
          typeof step.run === "string" && step.run.includes("next start"),
      );
      for (const step of servers) {
        found.push([
          `${file} › ${jobName} › ${String(step.name ?? step.run)}`,
          disabled(doc.env as Env, job.env, step.env as Env),
        ]);
      }
    }
  }
  return found;
}

describe("CI telemetry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("register() exports nothing when OTEL_SDK_DISABLED=true", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("OTEL_SDK_DISABLED", "true");
    const otel = await import("../instrumentation");
    otel.register();
    expect(otel.tracerProvider).toBeUndefined();
    expect(otel.loggerProvider).toBeUndefined();
  });

  it("register() still exports when the switch is absent", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_test");
    vi.stubEnv("OTEL_SDK_DISABLED", "");
    const otel = await import("../instrumentation");
    otel.register();
    expect(otel.tracerProvider).toBeDefined();
    await otel.tracerProvider?.shutdown();
    await otel.loggerProvider?.shutdown();
  });

  it("every workflow step that runs `next start` disables OTel export", () => {
    const steps = serverSteps();
    expect(
      steps.length,
      "no workflow serves a build — this lock checks nothing",
    ).toBeGreaterThan(0);
    expect(steps.filter(([, off]) => !off).map(([label]) => label)).toEqual([]);
  });
});
