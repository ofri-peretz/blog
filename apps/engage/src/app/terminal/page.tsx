"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cachedFetch, cachedAt } from "@/lib/client-cache";
import { Refresh } from "@/components/panels";
import { SeriesChart, type ChartSeries } from "@/components/series-chart";

/**
 * The terminal.
 *
 * Every other panel in this app answers one question with one number. This one
 * exists to answer the questions that need two: does engagement rate track
 * followers, did stars move when downloads did, is the growth RATE rising or
 * just the total. None of those were expressible before `/api/series`.
 */

type Grain = "day" | "week" | "month";
type Transform = "none" | "delta" | "rebase100";

interface Def {
  id: string;
  label: string;
  group: string;
  caveat?: string;
}

interface Loaded {
  id: string;
  label: string;
  points: { t: string; v: number }[];
  last: number | null;
  first: number | null;
  caveat: string | null;
  stale: boolean;
  error?: string;
  trend?: {
    direction: "rising" | "falling" | "flat";
    slope: number;
    tau: number;
    p: number;
    n: number;
    insufficient?: string;
  };
}

interface Pair {
  a: string;
  b: string;
  correlation: { r: number; n: number; insufficient?: string };
  divergence: { diverging: boolean; note: string };
}

/** The ratios worth having on the picker without typing them. */
const PRESET_RATIOS: { id: string; label: string }[] = [
  { id: "ratio(devto.reactions,devto.views)", label: "engagement rate — reactions / views" },
  { id: "ratio(devto.comments,devto.views)", label: "conversation rate — comments / views" },
  { id: "ratio(devto.followers,devto.posts)", label: "followers per article" },
  { id: "ratio(github.stars,devto.views)", label: "stars per view" },
];

const num = (v: number | null | undefined, digits = 0): string =>
  v == null || !Number.isFinite(v)
    ? "—"
    : Math.abs(v) < 1 && v !== 0
      ? v.toFixed(4)
      : v.toLocaleString(undefined, { maximumFractionDigits: digits });

export default function Terminal() {
  const [catalog, setCatalog] = useState<Def[]>([]);
  const [ids, setIds] = useState<string[]>(["devto.followers", "devto.views"]);
  const [grain, setGrain] = useState<Grain>("week");
  const [transform, setTransform] = useState<Transform>("none");
  const [data, setData] = useState<{ series: Loaded[]; pairs: Pair[]; asOf: string | null } | null>(
    null,
  );
  const [at, setAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    cachedFetch<{ catalog: Def[] }>("series:catalog", "/api/series")
      .then((j) => setCatalog(j.catalog ?? []))
      .catch(() => setCatalog([]));
  }, []);

  const url = useMemo(
    () =>
      `/api/series?ids=${encodeURIComponent(ids.join(","))}&grain=${grain}` +
      (transform === "none" ? "" : `&transform=${transform}`),
    [ids, grain, transform],
  );

  const load = useCallback(
    (force: boolean) => {
      if (!ids.length) {
        setData(null);
        return;
      }
      setBusy(true);
      // Keyed by the full request, not by "series": the whole point is that the
      // same panel shows different data per selection, and a single key would
      // serve the previous selection from cache — the bug that made switching
      // trend grain silently show the wrong series.
      cachedFetch<any>(`series:${url}`, url, { force })
        .then(setData)
        .catch(() => setData(null))
        .finally(() => {
          setAt(cachedAt(`series:${url}`) ?? Date.now());
          setBusy(false);
        });
    },
    [url, ids.length],
  );

  useEffect(() => load(false), [load]);

  const chartSeries: ChartSeries[] = useMemo(
    () =>
      (data?.series ?? [])
        .filter((s) => !s.error && s.points?.length)
        .map((s) => ({
          id: s.id,
          label: s.label,
          points: s.points,
          asBars: transform === "delta",
        })),
    [data, transform],
  );

  const toggle = (id: string) =>
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, 6)));

  const groups = [...new Set(catalog.map((d) => d.group))];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 pb-24">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
          >
            ← control room
          </Link>
          <Refresh onClick={() => load(true)} at={at} busy={busy} />
        </div>
        <h1 className="text-[28px] font-semibold tracking-tight">Terminal</h1>
        <p className="max-w-[72ch] text-[14px] text-[var(--color-ink-2)]">
          Any series against any other, on one axis. Trend is measured on the{" "}
          <strong>rate of change</strong>, not the total — a cumulative metric climbs forever
          and would otherwise read as &ldquo;rising&rdquo; the month after it died.
        </p>
      </header>

      {/* ── picker ─────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
        {groups.map((g) => (
          <div key={g} className="flex flex-wrap items-center gap-2">
            <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
              {g}
            </span>
            {catalog
              .filter((d) => d.group === g)
              .map((d) => (
                <button
                  key={d.id}
                  onClick={() => toggle(d.id)}
                  title={d.caveat ?? undefined}
                  className={`rounded-md border px-2 py-1 font-mono text-[11px] ${
                    ids.includes(d.id)
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-[var(--color-line)] text-[var(--color-ink-2)] hover:border-[var(--color-accent)]"
                  }`}
                >
                  {d.label}
                </button>
              ))}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
            Ratios
          </span>
          {PRESET_RATIOS.map((r) => (
            <button
              key={r.id}
              onClick={() => toggle(r.id)}
              className={`rounded-md border px-2 py-1 font-mono text-[11px] ${
                ids.includes(r.id)
                  ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "border-[var(--color-line)] text-[var(--color-ink-2)] hover:border-[var(--color-accent)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-[var(--color-line)] pt-3">
          <Seg label="grain" value={grain} onChange={(v) => setGrain(v as Grain)} options={["day", "week", "month"]} />
          <Seg
            label="transform"
            value={transform}
            onChange={(v) => setTransform(v as Transform)}
            options={["none", "delta", "rebase100"]}
          />
          {data?.asOf && (
            <span className="font-mono text-[10px] text-[var(--color-ink-3)]">
              data through {data.asOf}
              {grain !== "day" && (
                // The current week/month is still accumulating, so its bucket
                // sits below a full one and every series appears to fall off a
                // cliff at the right edge. A terminal treats the live candle
                // as partial; say so rather than let the last point read as a
                // collapse.
                <span className="text-[var(--color-warn)]">
                  {" "}
                  · final {grain} is partial
                </span>
              )}
            </span>
          )}
        </div>
      </section>

      {/* ── chart ──────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-3">
        {chartSeries.length ? (
          <SeriesChart series={chartSeries} />
        ) : (
          <p className="px-2 py-10 text-center text-[13px] text-[var(--color-ink-3)]">
            {ids.length ? "no points for this selection" : "pick a series"}
          </p>
        )}
        <div className="flex flex-wrap gap-4 px-2 pt-3">
          {(data?.series ?? []).map((s, i) => (
            <span key={s.id} className="flex items-center gap-2 font-mono text-[11px]">
              <span
                className="inline-block h-2 w-4 rounded-sm"
                style={{ background: ["#f4794a", "#0d9460", "#5b8def", "#c9a227", "#a259c4", "#39b8b0"][i % 6] }}
              />
              <span className="text-[var(--color-ink-2)]">{s.label}</span>
              <span className="text-[var(--color-ink)]">{num(s.last, 2)}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ── detection ──────────────────────────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
            Trend — on the rate of change
          </h2>
          {(data?.series ?? []).map((s) => (
            <div key={s.id} className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 flex-1 truncate text-[var(--color-ink-2)]">{s.label}</span>
              {s.error ? (
                <span className="font-mono text-[11px] text-[var(--color-accent)]">{s.error}</span>
              ) : s.trend?.insufficient ? (
                <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
                  {s.trend.insufficient}
                </span>
              ) : (
                <span className="flex items-center gap-2 font-mono text-[11px]">
                  <Dir d={s.trend?.direction ?? "flat"} />
                  <span className="text-[var(--color-ink-3)]">
                    τ={s.trend ? s.trend.tau.toFixed(2) : "—"} · p=
                    {s.trend ? s.trend.p.toFixed(3) : "—"} · n={s.trend?.n ?? 0}
                  </span>
                </span>
              )}
            </div>
          ))}
          {(data?.series ?? []).some((s) => s.caveat) && (
            <p className="mt-1 border-l-2 border-[var(--color-warn)] pl-2 text-[11px] text-[var(--color-ink-3)]">
              {(data?.series ?? []).find((s) => s.caveat)?.caveat}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
            Correlation — on daily change, never on totals
          </h2>
          {(data?.pairs ?? []).length ? (
            (data?.pairs ?? []).map((p) => (
              <div key={`${p.a}|${p.b}`} className="flex flex-col gap-0.5 text-[13px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-[var(--color-ink-2)]">
                    {p.a} × {p.b}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--color-ink)]">
                    {p.correlation.insufficient ? "—" : `r=${p.correlation.r.toFixed(2)}`}
                    <span className="text-[var(--color-ink-3)]"> · n={p.correlation.n}</span>
                  </span>
                </div>
                {p.divergence.diverging && (
                  <span className="font-mono text-[11px] text-[var(--color-accent)]">
                    ⚠ diverging — {p.divergence.note}
                  </span>
                )}
              </div>
            ))
          ) : (
            <p className="text-[12px] text-[var(--color-ink-3)]">pick two or more series</p>
          )}
        </div>
      </section>
    </main>
  );
}

function Dir({ d }: { d: "rising" | "falling" | "flat" }) {
  const map = {
    rising: ["↑ rising", "var(--color-good)"],
    falling: ["↓ falling", "var(--color-accent)"],
    flat: ["→ flat", "var(--color-ink-3)"],
  } as const;
  const [text, colour] = map[d];
  return <span style={{ color: colour }}>{text}</span>;
}

function Seg({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
        {label}
      </span>
      <span className="flex">
        {options.map((o, i) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`border px-2 py-1 font-mono text-[11px] ${
              i === 0 ? "rounded-l-md" : i === options.length - 1 ? "rounded-r-md border-l-0" : "border-l-0"
            } ${
              value === o
                ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-panel)]"
                : "border-[var(--color-line)] text-[var(--color-ink-2)] hover:border-[var(--color-accent)]"
            }`}
          >
            {o}
          </button>
        ))}
      </span>
    </span>
  );
}
