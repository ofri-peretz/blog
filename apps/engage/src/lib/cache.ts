import "server-only";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "./footprint";

const DIR = join(FOOTPRINT, "engagement", ".cache");

/**
 * Disk cache for answers that are expensive to produce.
 *
 * The specific problem: `/queue` and `/calendar` each shelled out to
 * `npx tsx scripts/publish-next.ts --json` on every single page view — a fresh
 * Node process, a TypeScript compile, and a Dev.to round-trip, ~60-90s, to
 * recompute a schedule that changes when an article is published. Navigating
 * between two pages paid it twice.
 *
 * Disk rather than memory because `next start` serves each route in a context
 * that does not reliably share module state, and because the answer should
 * survive a restart — the schedule is the same schedule.
 *
 * Only two things cause a miss, which is the whole contract:
 *   1. the entry is older than its TTL, or
 *   2. the caller explicitly forced it (the section's own refresh button).
 */
/**
 * Async twin of `cached`, for producers that await (a network crawl).
 *
 * Kept as a separate function rather than making `cached` generic over
 * sync/async: the sync one is called in places that use its return value
 * immediately, and quietly turning those into promises would leave `[object
 * Promise]` rendering as a number.
 *
 * A failed produce does NOT overwrite a good entry — on error the stale value
 * is returned with `fresh: false` if one exists. An inbox that empties itself
 * because Dev.to rate-limited us for ten seconds is exactly the "silence looks
 * like success" failure this app keeps finding.
 */
export async function cachedAsync<T>(
  key: string,
  ttlMs: number,
  force: boolean,
  produce: () => Promise<T>,
): Promise<{ value: T; at: number; fresh: boolean; error?: string }> {
  const file = join(DIR, `${key}.json`);
  const readHit = (): { value: T; at: number } | null => {
    if (!existsSync(file)) return null;
    try {
      const hit = JSON.parse(readFileSync(file, "utf8"));
      return { value: hit.value as T, at: hit.at };
    } catch {
      return null;
    }
  };

  const hit = readHit();
  if (!force && hit && Date.now() - hit.at < ttlMs)
    return { value: hit.value, at: hit.at, fresh: false };

  try {
    const value = await produce();
    const at = Date.now();
    try {
      mkdirSync(DIR, { recursive: true });
      writeFileSync(file, JSON.stringify({ at, value }));
    } catch {
      /* an unwritable cache is a slow app, not a broken one */
    }
    return { value, at, fresh: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (hit) return { value: hit.value, at: hit.at, fresh: false, error: message };
    throw e;
  }
}

export function cached<T>(
  key: string,
  ttlMs: number,
  force: boolean,
  produce: () => T,
): { value: T; at: number; fresh: boolean } {
  const file = join(DIR, `${key}.json`);
  if (!force && existsSync(file)) {
    try {
      const hit = JSON.parse(readFileSync(file, "utf8"));
      if (Date.now() - hit.at < ttlMs)
        return { value: hit.value as T, at: hit.at, fresh: false };
    } catch {
      /* a corrupt entry is a miss, never a crash */
    }
  }
  const value = produce();
  const at = Date.now();
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(file, JSON.stringify({ at, value }));
  } catch {
    /* an unwritable cache must not fail the request it was meant to speed up */
  }
  return { value, at, fresh: true };
}

/**
 * The publisher's own schedule JSON, cached.
 *
 * Never re-derive this: cadence lives in publish-next.ts and a local copy has
 * already drifted once. Caching the SUBPROCESS is the way to make it cheap
 * without making it a second source of truth.
 *
 * 10 minutes: the schedule only moves when something is published, and a
 * publish is a deliberate act that can afford to press refresh.
 */
export function publisherSchedule(force = false) {
  return cached("publish-next", 10 * 60_000, force, () => {
    try {
      const raw = execFileSync(
        "npx",
        ["tsx", "scripts/publish-next.ts", "--json"],
        { cwd: FOOTPRINT, encoding: "utf8", timeout: 120_000, maxBuffer: 8 << 20 },
      );
      // A tsx compile error prints no `{` at all; indexOf returns -1 and
      // slice(-1) hands JSON.parse the final character, which fails with a
      // message about that character instead of about the real failure.
      const brace = raw.indexOf("{");
      if (brace === -1)
        throw new Error(`publish-next produced no JSON: ${raw.trim().slice(0, 160)}`);
      return JSON.parse(raw.slice(brace));
    } catch (e: any) {
      // Cache the failure too, briefly — otherwise a broken publisher turns
      // every page view into another 120s timeout.
      return {
        error: String(e?.message ?? e).split("\n")[0].slice(0, 200),
        fires: [],
        queue: [],
        minDays: null,
      };
    }
  });
}
