"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCachedSection } from "@/lib/client-cache";
import { Refresh } from "@/components/panels";

/**
 * The conquest map.
 *
 * Plotted as value × odds rather than as a node-and-edge hairball, because the
 * question this answers is a portfolio one — "where is a landed PR worth the
 * week" — and a force layout puts that answer nowhere in particular. The
 * dev.to network is a hairball because *there* the shape of the community is
 * the information. Here the shape is a decision.
 *
 * Read it like a quadrant: top-right is where to spend the next PR.
 */

interface Repo {
  slug: string;
  state: string;
  depth: string;
  ecosystem?: string;
  note?: string;
  pr?: number;
  signals: {
    stars: number | null;
    externalPrs: number;
    externalMergeRate: number | null;
    medianDaysToMergeExternal: number | null;
    botShare: number | null;
    daysSinceHumanCommit: number | null;
  } | null;
  odds: {
    band: string;
    score: number | null;
    value: number;
    reach: number;
    components: string[];
    blockers: string[];
  } | null;
}

const BAND_COLOUR: Record<string, string> = {
  held: "var(--success)",
  likely: "var(--primary)",
  plausible: "var(--warning)",
  "long shot": "var(--muted-foreground)",
  dead: "var(--muted-foreground)",
  unknown: "var(--muted-foreground)",
};

const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${Math.round(v * 100)}%`;

export default function Conquest() {
  const { data, at, busy, refresh } = useCachedSection<any>(
    "repos",
    "/api/repos",
    () => ({ repos: [], edges: [], error: "unreachable" }),
  );
  const [sel, setSel] = useState<string | null>(null);

  const repos: Repo[] = data?.repos ?? [];
  const held = repos.filter((r) => r.odds?.band === "held");

  // Only nodes with a score can be placed; held and dead ones are listed
  // separately rather than parked at x=0, which would read as "terrible odds"
  // for something we already own.
  const plotted = useMemo(
    () =>
      repos.filter(
        (r) => r.odds?.score != null && r.odds.band !== "held" && r.odds.band !== "dead",
      ),
    [repos],
  );
  const maxValue = Math.max(...plotted.map((r) => r.odds!.value), 1);

  const selected = repos.find((r) => r.slug === sel) ?? null;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 pb-24">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] hover:text-[var(--primary)]"
          >
            ← control room
          </Link>
          <Refresh onClick={refresh} at={at} busy={busy} />
        </div>
        <h1 className="text-[28px] font-semibold tracking-tight">Conquest map</h1>
        <p className="max-w-[74ch] text-[14px] text-[var(--muted-foreground)]">
          Every repository worth landing in, placed by <strong>value</strong> against{" "}
          <strong>odds</strong>. Value is adoption depth, not stars — a config that runs our
          rules on every install outweighs a listing with twenty times the stars. Odds are a
          scorecard from measured GitHub behaviour, never a fitted probability.
        </p>
        {data?.ageHours != null && (
          <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
            signals measured {data.ageHours}h ago
            {data.stale && (
              <span className="text-[var(--warning)]">
                {" "}
                · stale, re-run scripts/gh-signals.ts
              </span>
            )}
          </p>
        )}
        {data?.error && (
          <p className="font-mono text-[11px] text-[var(--primary)]">
            {data.error}
            {data.hint ? ` — ${data.hint}` : ""}
          </p>
        )}
      </header>

      {/* ── held ───────────────────────────────────────────────────────────── */}
      {held.length > 0 && (
        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--success)] bg-[var(--card)] p-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--success)]">
            held · {held.length}
          </span>
          {held.map((r) => (
            <button
              key={r.slug}
              onClick={() => setSel(r.slug)}
              className="rounded-md border border-[var(--success)] px-2 py-1 font-mono text-[11px] text-[var(--success)]"
              title={r.note}
            >
              {r.slug}
              <span className="ml-1 text-[var(--muted-foreground)]">{r.depth}</span>
            </button>
          ))}
        </section>
      )}

      {/* ── the board ──────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
          <span>← lower odds · higher odds →</span>
          <span>↑ higher value</span>
        </div>
        <div className="relative h-[420px] w-full border border-[var(--border)]">
          {/* quadrant guides at the band thresholds the scorecard actually uses */}
          <div className="absolute inset-y-0 left-[45%] w-px bg-[var(--border)]" />
          <div className="absolute inset-y-0 left-[70%] w-px bg-[var(--border)]" />
          <span className="absolute bottom-1 left-[45.5%] font-mono text-[9px] text-[var(--muted-foreground)]">
            plausible
          </span>
          <span className="absolute bottom-1 left-[70.5%] font-mono text-[9px] text-[var(--muted-foreground)]">
            likely
          </span>

          {plotted.map((r) => {
            const o = r.odds!;
            const x = Math.min(97, Math.max(2, o.score!));
            const y = 96 - (o.value / maxValue) * 90;
            const size = 8 + Math.min(18, (r.signals?.stars ?? 0) > 0 ? Math.log10(r.signals!.stars!) * 4 : 4);
            return (
              <button
                key={r.slug}
                onClick={() => setSel(r.slug)}
                title={`${r.slug} — ${o.band}, score ${o.score}, value ${o.value}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-transform hover:scale-125"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: size,
                  height: size,
                  borderColor: BAND_COLOUR[o.band] ?? "var(--muted-foreground)",
                  background:
                    sel === r.slug ? (BAND_COLOUR[o.band] ?? "var(--muted-foreground)") : "transparent",
                }}
              />
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10px] text-[var(--muted-foreground)]">
          {["likely", "plausible", "long shot"].map((b) => (
            <span key={b} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full border"
                style={{ borderColor: BAND_COLOUR[b] }}
              />
              {b}
            </span>
          ))}
          <span>· dot size = stars (log) · position = score × value</span>
        </div>
      </section>

      {/* ── the ranked list, which is what you actually act from ───────────── */}
      <section className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
              <th className="px-3 py-2 text-left">repo</th>
              <th className="px-3 py-2 text-left">state</th>
              <th className="px-3 py-2 text-left">depth</th>
              <th className="px-3 py-2 text-right">ext merges</th>
              <th className="px-3 py-2 text-right">median</th>
              <th className="px-3 py-2 text-right">human</th>
              <th className="px-3 py-2 text-right">score</th>
              <th className="px-3 py-2 text-right">value</th>
            </tr>
          </thead>
          <tbody>
            {repos.map((r) => (
              <tr
                key={r.slug}
                onClick={() => setSel(r.slug)}
                className={`cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)] ${
                  sel === r.slug ? "bg-[var(--background)]" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono text-[12px]">{r.slug}</td>
                <td className="px-3 py-2">
                  <span style={{ color: BAND_COLOUR[r.odds?.band ?? "unknown"] }}>
                    {r.odds?.band ?? r.state}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-[var(--muted-foreground)]">
                  {r.depth}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[11px]">
                  {r.signals?.externalMergeRate == null
                    ? `n/a (${r.signals?.externalPrs ?? 0})`
                    : `${pct(r.signals.externalMergeRate)} of ${r.signals.externalPrs}`}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[11px]">
                  {r.signals?.medianDaysToMergeExternal ?? "—"}d
                </td>
                <td className="px-3 py-2 text-right font-mono text-[11px]">
                  {r.signals?.daysSinceHumanCommit ?? "—"}d
                </td>
                <td className="px-3 py-2 text-right font-mono text-[11px]">
                  {r.odds?.score ?? "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[11px]">
                  {r.odds?.value ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── breakdown: the score is never shown without its reasons ─────────── */}
      {selected && (
        <section className="flex flex-col gap-2 rounded-xl border border-[var(--primary)] bg-[var(--card)] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <a
              href={`https://github.com/${selected.slug}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[13px] text-[var(--primary)]"
            >
              {selected.slug} ↗
            </a>
            <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
              {selected.odds?.band} · score {selected.odds?.score ?? "—"} · value{" "}
              {selected.odds?.value ?? "—"} · reach {selected.odds?.reach ?? 0}
            </span>
          </div>
          {selected.note && (
            <p className="border-l-2 border-[var(--border)] pl-2 text-[12px] text-[var(--muted-foreground)]">
              {selected.note}
            </p>
          )}
          <ul className="flex flex-col gap-0.5">
            {(selected.odds?.components ?? []).map((c) => (
              <li key={c} className="font-mono text-[11px] text-[var(--muted-foreground)]">
                {c}
              </li>
            ))}
            {(selected.odds?.blockers ?? []).map((b) => (
              <li key={b} className="font-mono text-[11px] text-[var(--primary)]">
                ⚠ {b}
              </li>
            ))}
          </ul>
          <p className="font-mono text-[10px] text-[var(--muted-foreground)]">
            bots {pct(selected.signals?.botShare)} of sampled PRs · {selected.signals?.stars ?? "—"}★
          </p>
        </section>
      )}
    </main>
  );
}
