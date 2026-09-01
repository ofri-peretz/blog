// The main-thread side of the playground's analyzer: one lazy worker,
// id-matched request/response, and a per-embed `lint` function shaped
// exactly for the DS LintPlayground's injected seam.
//
// The worker (and the 362 KB brotli linter+plugins bundle inside it)
// is created on the FIRST lint call — which only happens after the
// reader clicks the article's "Try it live" gate — so article pages pay
// nothing for the playground until someone wants it.

import type {
  LintFinding,
  LintRequest,
  LintResponse,
  PlaygroundPluginId,
} from "./lint-embeds";
import type { Linter } from "eslint";

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (f: LintFinding[]) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker {
  if (worker) return worker;
  // A STATIC asset (public/lint-worker.js, built by
  // scripts/build-lint-worker.mjs from src/workers/lint.worker.ts) —
  // deliberately outside Next's bundlers; see the build script's header.
  worker = new Worker("/lint-worker.js");
  worker.onmessage = (event: MessageEvent<LintResponse>) => {
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    if (event.data.ok) entry.resolve(event.data.findings);
    else entry.reject(new Error(event.data.error));
  };
  // A dead worker fails every in-flight request loudly — the DS surface
  // renders "unknown, not clean", never a silent empty list — and NULLS
  // the singleton (review): keeping the terminated handle would make
  // every later lint post into a corpse. The next keystroke gets a
  // fresh worker instead — the playground self-heals.
  worker.onerror = () => {
    const entries = [...pending.values()];
    pending.clear();
    worker?.terminate();
    worker = null;
    for (const entry of entries) entry.reject(new Error("lint worker failed"));
  };
  return worker;
}

/** A configured analyzer for one embed — the LintPlayground `lint` prop. */
export function makeBrowserLint(
  pluginId: PlaygroundPluginId,
  rules: Linter.RulesRecord,
): (code: string) => Promise<LintFinding[]> {
  return (code) =>
    new Promise<LintFinding[]>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      const request: LintRequest = { id, code, pluginId, rules };
      try {
        getWorker().postMessage(request);
      } catch (error) {
        // postMessage on a just-died worker throws synchronously; clean
        // this request up and let the next call recreate the worker.
        pending.delete(id);
        worker = null;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
}
