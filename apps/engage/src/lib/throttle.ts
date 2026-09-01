import "server-only";

/**
 * Paced fetch with 429 backoff.
 *
 * Every Dev.to caller here fired as fast as the event loop allowed, which is how
 * the Google-AI tag feed came back HTTP 429 after a heavy day: the failure is
 * silent at the call site and surfaces as an empty panel that looks like "no
 * data" rather than "we were throttled".
 *
 * One shared gate for the whole process so parallel callers cannot collectively
 * out-run the limit — per-caller pacing would let four routes each behave and
 * still burst 4x together.
 */
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;

const MIN_GAP_MS = Number(process.env.DEVTO_MIN_GAP_MS ?? 350);
const MAX_RETRIES = 4;

export function paced<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastAt));
    if (wait) await sleep(wait);
    lastAt = Date.now();
    return fn();
  });
  // Keep the chain alive even when a call rejects, or one failure stalls every
  // later request behind a permanently rejected promise.
  chain = run.catch(() => {});
  return run as Promise<T>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(
  url: string,
  init?: RequestInit,
): Promise<any> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const r = await paced(() => fetch(url, { ...init, cache: "no-store" }));
    if (r.status === 429 || r.status === 503) {
      // Honour Retry-After when the server sends it; exponential otherwise.
      const ra = Number(r.headers.get("retry-after"));
      const backoff = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2 ** attempt * 1000;
      if (attempt === MAX_RETRIES) throw new Error(`HTTP ${r.status} after ${attempt} retries`);
      await sleep(Math.min(backoff, 30_000));
      continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  throw new Error("unreachable");
}
