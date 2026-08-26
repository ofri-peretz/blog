"use client";

// The Loom's composer — pick threads, pick a form, get a weave that is
// also a permalink.
//
// ## The URL is the only state store
//
// The server page parses `searchParams` into `initialState`, so a
// shared link SSRs the exact weave it describes; from there every
// change mirrors into `history.replaceState` via the loom-url codec
// (URL_PHILOSOPHY — shareable state lives in the address bar). popstate
// re-parses, so back/forward walk the visitor's own composition
// history.
//
// ## Constraint is the product
//
// Five threads, three windows, two forms, two normalizations. A small
// system that generates every view is what makes composing feel like
// play instead of configuration (the In Pieces law) — and every one of
// those views stays readable, because the caps come from what
// `TimeSeries` can honestly draw (five dash+hue pairs, one y domain).
//
// ## No visitor ever costs us a query
//
// Everything here is client-side arithmetic over the corpus the server
// already cached — windowing, indexing, recomposing are array maps.
// Playing harder does not touch Supabase, PostHog, npm, or GitHub.

import * as React from "react";

import { TimeSeries } from "@/components/ui/time-series";
import { Toggle, toggleVariants } from "@/components/ui/toggle";
import { track } from "@/lib/analytics";
import {
  indexTo100,
  windowPoints,
  type LoomCorpus,
  type LoomSeries,
} from "@/lib/loom-data";
import {
  LOOM_GROUP_LABELS,
  LOOM_PRESETS,
  MAX_THREADS,
  parseLoomState,
  serializeLoomState,
  windowCutoff,
  type LoomState,
} from "@/lib/loom-url";
import { cn } from "@/lib/utils";

/** npm packages shown before the native `<details>` expander. */
const NPM_ABOVE_FOLD = 9;

/**
 * The pill look for elements that are NOT toggles (preset buttons, the
 * copy-link action, the `<summary>` expander) — same DS recipe, no fake
 * pressed semantics. Real on/off state renders `<Toggle variant="pill">`
 * instead, and the DS owns aria-pressed. The styling has exactly one
 * home: the toggle variant this borrows (interlace#76).
 */
const PILL_ACTION = toggleVariants({ variant: "pill", size: "xs" });

export function LoomComposer({
  corpus,
  initialState,
}: {
  corpus: LoomCorpus;
  initialState: LoomState;
}) {
  const [state, setState] = React.useState(initialState);
  const [copied, setCopied] = React.useState(false);

  const byId = React.useMemo(
    () => new Map(corpus.series.map((s) => [s.id, s])),
    [corpus],
  );
  const validIds = React.useMemo(() => new Set(byId.keys()), [byId]);

  // Back/forward re-parse the URL — the visitor walks their own
  // composition history exactly as they walked it forward.
  React.useEffect(() => {
    const onPop = () =>
      setState(
        parseLoomState(new URLSearchParams(window.location.search), validIds),
      );
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [validIds]);

  const apply = (next: LoomState) => {
    setState(next);
    const qs = serializeLoomState(next);
    window.history.replaceState(null, "", qs ? `/loom?${qs}` : "/loom");
    track("loom:weave_change", {
      series: next.series.join(","),
      form: next.form,
      window: next.window,
      normalize: next.normalize,
    });
  };

  const toggleThread = (id: string) => {
    const has = state.series.includes(id);
    // The last thread cannot be removed — an empty loom teaches nothing
    // and every downstream surface assumes at least one series.
    if (has && state.series.length === 1) return;
    if (!has && state.series.length >= MAX_THREADS) return;
    apply({
      ...state,
      series: has
        ? state.series.filter((s) => s !== id)
        : [...state.series, id],
    });
  };

  const copyPermalink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      return; // no clipboard, no claim — the button simply does nothing
    }
    track("loom:permalink_copy", { series: state.series.join(",") });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const active = state.series
    .map((id) => byId.get(id))
    .filter((s): s is LoomSeries => s != null);
  const cutoff = windowCutoff(state.window, corpus.observedThrough);
  const woven = active.map((s) => {
    const windowed = windowPoints(s.points, cutoff);
    return {
      series: s,
      points:
        state.normalize === "idx" ? indexTo100(windowed) : windowed,
      unit: state.normalize === "idx" ? "indexed" : s.unit,
    };
  });
  const mixedUnits =
    state.normalize === "abs" &&
    new Set(active.map((s) => s.unit)).size > 1;

  // Chart identity: remount when the composition changes, so the
  // crosshair cursor never carries over between different weaves.
  const chartKey = [state.series.join(","), state.window, state.normalize].join(
    "|",
  );

  const groups = ["npm", "devto", "github", "site"] as const;

  return (
    <div data-testid="loom-composer" className="flex flex-col gap-8">
      {/* Presets — the guided entry. Each is just a URL state. */}
      <div
        role="group"
        aria-label="Preset weaves"
        className="flex flex-wrap items-center gap-1.5"
      >
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Start from
        </span>
        {LOOM_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            data-testid={`loom-preset-${preset.id}`}
            className={PILL_ACTION}
            onClick={() => {
              track("loom:preset_click", { preset: preset.id });
              // A preset thread the corpus no longer carries is dropped;
              // if none survive, the current weave stays — never zero.
              const survivors = preset.state.series.filter((id) =>
                validIds.has(id),
              );
              apply({
                ...preset.state,
                series: survivors.length > 0 ? survivors : state.series,
              });
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* The thread picker, grouped by source. */}
      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const threads = corpus.series.filter((s) => s.group === group);
          if (threads.length === 0) return null;
          const above =
            group === "npm" ? threads.slice(0, NPM_ABOVE_FOLD) : threads;
          const below = group === "npm" ? threads.slice(NPM_ABOVE_FOLD) : [];
          const chip = (s: LoomSeries) => {
            const isActive = state.series.includes(s.id);
            const capped =
              !isActive && state.series.length >= MAX_THREADS;
            return (
              <Toggle
                key={s.id}
                variant="pill"
                size="xs"
                data-testid={`loom-thread-${s.id}`}
                pressed={isActive}
                aria-disabled={capped || undefined}
                title={
                  capped
                    ? `${MAX_THREADS} threads max — a weave you can still read`
                    : undefined
                }
                className={cn(
                  capped &&
                    "cursor-not-allowed opacity-50 hover:text-muted-foreground",
                )}
                onPressedChange={() => toggleThread(s.id)}
              >
                {s.label}
              </Toggle>
            );
          };
          return (
            <div
              key={group}
              role="group"
              aria-label={LOOM_GROUP_LABELS[group]}
              className="flex flex-wrap items-baseline gap-1.5"
            >
              <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {LOOM_GROUP_LABELS[group]}
              </span>
              {above.map(chip)}
              {below.length > 0 && (
                <details className="contents">
                  {/* `contents` on <details> keeps the expanded pills in
                      the same wrapping row instead of a new block. */}
                  <summary
                    className={cn(
                      PILL_ACTION,
                      "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
                    )}
                  >
                    +{below.length} more
                  </summary>
                  {below.map(chip)}
                </details>
              )}
            </div>
          );
        })}
      </div>

      {/* Form · window · normalization. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {(
          [
            ["Form", "form", [["weave", "One weave"], ["grid", "Small multiples"]]],
            ["Window", "window", [["90d", "90 days"], ["1y", "1 year"], ["all", "All time"]]],
            ["Scale", "normalize", [["abs", "Absolute"], ["idx", "Indexed (start = 100)"]]],
          ] as const
        ).map(([label, key, options]) => (
          <div
            key={key}
            role="group"
            aria-label={label}
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            {options.map(([value, text]) => (
              <Toggle
                key={value}
                variant="pill"
                size="xs"
                pressed={state[key] === value}
                onPressedChange={() =>
                  state[key] !== value && apply({ ...state, [key]: value })
                }
              >
                {text}
              </Toggle>
            ))}
          </div>
        ))}
        <button
          type="button"
          data-testid="loom-permalink-copy"
          className={PILL_ACTION}
          onClick={copyPermalink}
        >
          {copied ? "Copied — this weave is a link" : "Copy link to this weave"}
        </button>
      </div>

      {mixedUnits && (
        <p className="text-sm text-muted-foreground">
          These threads have different units, and one honest y-axis can
          hold only one of them at native scale.{" "}
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={() => apply({ ...state, normalize: "idx" })}
          >
            Index every thread to 100
          </button>{" "}
          to weave them by shape instead.
        </p>
      )}

      {/* The weave itself. */}
      {state.form === "weave" ? (
        <TimeSeries
          key={chartKey}
          data-testid="loom-weave"
          points={woven[0]?.points ?? []}
          label={woven[0]?.series.label}
          unit={woven[0]?.unit}
          compare={woven.slice(1).map((w) => ({
            points: w.points,
            label: w.series.label,
            unit: w.unit,
          }))}
          height={260}
        />
      ) : (
        <div
          data-testid="loom-grid"
          className="grid grid-cols-1 gap-6 md:grid-cols-2"
        >
          {woven.map((w) => (
            <TimeSeries
              key={`${chartKey}-${w.series.id}`}
              data-testid={`loom-grid-${w.series.id}`}
              points={w.points}
              label={w.series.label}
              unit={w.unit}
              height={200}
            />
          ))}
        </div>
      )}

      {/* Provenance — the audit chain, rendered. */}
      <footer
        data-testid="loom-provenance"
        className="border-t pt-4 text-xs text-muted-foreground"
      >
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {[...new Set(active.map((s) => s.provenance))].map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mt-2">
          Observed through {corpus.observedThrough} · corpus assembled at
          most twice a day — playing with it costs nothing and touches no
          upstream API.{" "}
          <a href="/scorecard" className="underline hover:text-foreground">
            How these numbers are made →
          </a>
        </p>
      </footer>
    </div>
  );
}
