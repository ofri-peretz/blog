"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCachedSection } from "@/lib/client-cache";
import { Refresh } from "@/components/panels";

type Gate = "pass" | "below-bar" | "unscored";

const TONE: Record<Gate, string> = {
  pass: "text-[var(--color-good)]",
  "below-bar": "text-[var(--color-warn)]",
  unscored: "text-[var(--color-ink-3)]",
};

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <div className={`text-2xl font-semibold tabular-nums ${tone ?? ""}`}>
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
        {label}
      </div>
    </div>
  );
}

/**
 * The release queue, in the control room.
 *
 * It already existed as a generated HTML artifact, but an artifact is a
 * snapshot you have to regenerate and then go find. Decisions get made here, so
 * the queue lives here — reading the same review logs and the same publisher,
 * never a second copy of the cadence rule.
 */
export default function Queue() {
  const { data: d, at, busy, refresh } = useCachedSection<any>(
    "queue",
    "/api/queue",
    () => ({ error: "unreachable", articles: [], totals: {} }),
  );
  const [filter, setFilter] = useState<"all" | Gate | "unpublished">("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    if (!d?.articles) return [];
    const needle = q.trim().toLowerCase();
    return d.articles.filter((a: any) => {
      if (filter === "unpublished" && a.published) return false;
      if (filter !== "all" && filter !== "unpublished" && a.gate !== filter)
        return false;
      return !needle || a.slug.includes(needle) || (a.title ?? "").toLowerCase().includes(needle);
    });
  }, [d, filter, q]);

  if (!d)
    return (
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton mb-2 h-8 w-full" />
          ))}
        </div>
      </main>
    );

  const t = d.totals ?? {};
  const s = d.schedule ?? {};

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
          <Refresh onClick={refresh} at={at} busy={busy} />
        </div>
        <h1 className="text-[28px] font-semibold tracking-tight">
          Release queue
        </h1>
        <p className="max-w-[70ch] text-[14px] text-[var(--color-ink-2)]">
          Every article, its gate score, and when the next one ships. The
          cadence comes from the publisher itself — mirroring it here is how it
          drifted in two places last time.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="articles" value={t.articles ?? "—"} />
        <Stat label="published" value={t.published ?? "—"} />
        <Stat label="median score" value={t.median ?? "—"} />
        <Stat
          label={`below ${d.scoreBar}`}
          value={t.belowBar ?? "—"}
          tone={t.belowBar ? "text-[var(--color-warn)]" : undefined}
        />
        <Stat
          label="unscored"
          value={t.unscored ?? "—"}
          tone={t.unscored ? "text-[var(--color-warn)]" : undefined}
        />
        <Stat label="no cover" value={t.missingCover ?? "—"} />
      </div>

      {/* Schedule */}
      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
        <div className="border-b border-[var(--color-line)] px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
          Schedule · every {s.minDays ?? "?"} days
        </div>
        {s.error ? (
          <p className="p-4 text-[13px] text-[var(--color-warn)]">
            Publisher did not answer: {s.error}
          </p>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap gap-2">
              {(s.fires ?? []).map((f: string, i: number) => (
                <span
                  key={f}
                  className={`rounded-lg border px-2.5 py-1 font-mono text-[11.5px] ${
                    i === 0
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-[var(--color-line)] text-[var(--color-ink-2)]"
                  }`}
                >
                  {new Date(f).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ))}
            </div>
            <p className="text-[13px] text-[var(--color-ink-2)]">
              {(s.queue ?? []).length} article
              {(s.queue ?? []).length === 1 ? "" : "s"} queued
              {(s.queue ?? []).length > 0 && (
                <>
                  {" "}
                  — next up{" "}
                  <b>{s.queue[0].title ?? s.queue[0].slug}</b>
                </>
              )}
              . {(s.stranded ?? []).length > 0 && (
                <span className="text-[var(--color-warn)]">
                  {s.stranded.length} stranded (written, never scheduled).
                </span>
              )}
            </p>
            {(s.fires ?? []).length > (s.queue ?? []).length && (
              <p className="text-[12.5px] text-[var(--color-warn)]">
                The queue is shorter than the schedule — {(s.fires ?? []).length - (s.queue ?? []).length} of the next{" "}
                {(s.fires ?? []).length} slots have nothing to publish.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "below-bar", "unscored", "pass", "unpublished"] as const).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md border px-2.5 py-1 font-mono text-[11px] ${
                filter === f
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                  : "border-[var(--color-line)] text-[var(--color-ink-2)]"
              }`}
            >
              {f}
            </button>
          ),
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter…"
          className="min-w-[160px] flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-ground)] px-3 py-1.5 font-mono text-[12px]"
        />
        <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
          {rows.length} shown
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">
              <th className="p-2.5 font-medium">Article</th>
              <th className="p-2.5 text-right font-medium">Score</th>
              <th className="p-2.5 font-medium">Status</th>
              <th className="p-2.5 text-right font-medium">Words</th>
              <th className="p-2.5 font-medium">Links</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a: any) => (
              <tr
                key={a.slug}
                className="border-b border-[var(--color-line)] last:border-0"
              >
                <td className="max-w-[380px] p-2.5">
                  <div className="truncate">{a.title}</div>
                  <div className="truncate font-mono text-[10.5px] text-[var(--color-ink-3)]">
                    {a.slug}
                  </div>
                </td>
                <td
                  className={`p-2.5 text-right tabular-nums ${TONE[a.gate as Gate]}`}
                >
                  {a.score ?? "—"}
                </td>
                <td className="p-2.5 font-mono text-[11px] text-[var(--color-ink-2)]">
                  {a.published ? "published" : (a.status ?? "draft")}
                  {!a.hasCover && (
                    <span className="ml-1.5 text-[var(--color-warn)]">
                      no cover
                    </span>
                  )}
                </td>
                <td className="p-2.5 text-right tabular-nums text-[var(--color-ink-3)]">
                  {a.words.toLocaleString()}
                </td>
                <td className="p-2.5">
                  <span className="flex gap-1.5 font-mono text-[10px] uppercase">
                    <a
                      href={`https://ofriperetz.dev/articles/${a.slug}`}
                      target="_blank"
                      rel="noopener"
                      className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      live
                    </a>
                    {a.devtoUrl && (
                      <a
                        href={a.devtoUrl}
                        target="_blank"
                        rel="noopener"
                        className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                      >
                        dev.to
                      </a>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
