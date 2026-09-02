"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCachedSection } from "@/lib/client-cache";
import { Refresh } from "@/components/panels";
import { Callout } from "@/components/ui/callout";
import { Skeleton } from "@/components/ui/skeleton";
import { StatStrip } from "@/components/ui/stat-strip";
import { DataTable } from "@/components/ui/patterns/data-table";

type Gate = "pass" | "below-bar" | "unscored";

const TONE: Record<Gate, string> = {
  pass: "text-[var(--success)]",
  "below-bar": "text-[var(--warning)]",
  unscored: "text-[var(--muted-foreground)]",
};

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
        <Skeleton variant="data-table" label="Loading the release queue" />
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
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] hover:text-[var(--primary)]"
          >
            ← control room
          </Link>
          <Refresh onClick={refresh} at={at} busy={busy} />
        </div>
        <h1 className="text-[28px] font-semibold tracking-tight">
          Release queue
        </h1>
        <p className="max-w-[70ch] text-[14px] text-[var(--muted-foreground)]">
          Every article, its gate score, and when the next one ships. The
          cadence comes from the publisher itself — mirroring it here is how it
          drifted in two places last time.
        </p>
      </header>

      <StatStrip
        cols={6}
        announce={{ noun: "queue totals" }}
        items={[
          { key: "articles", label: "articles", value: t.articles ?? null },
          { key: "published", label: "published", value: t.published ?? null },
          { key: "median", label: "median score", value: t.median ?? null },
          { key: "below", label: `below ${d.scoreBar}`, value: t.belowBar ?? null },
          { key: "unscored", label: "unscored", value: t.unscored ?? null },
          { key: "cover", label: "no cover", value: t.missingCover ?? null },
        ]}
      />

      {/* Schedule */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]">
          Schedule · every {s.minDays ?? "?"} days
        </div>
        {s.error ? (
          <div className="p-4">
            <Callout tone="warn" title="Publisher did not answer">
              {s.error}
            </Callout>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap gap-2">
              {(s.fires ?? []).map((f: string, i: number) => (
                <span
                  key={f}
                  className={`rounded-lg border px-2.5 py-1 font-mono text-[11.5px] ${
                    i === 0
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)]"
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
            <p className="text-[13px] text-[var(--muted-foreground)]">
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
                <span className="text-[var(--warning)]">
                  {s.stranded.length} stranded (written, never scheduled).
                </span>
              )}
            </p>
            {(s.fires ?? []).length > (s.queue ?? []).length && (
              <Callout tone="warn" title="The queue is shorter than the schedule">
                {(s.fires ?? []).length - (s.queue ?? []).length} of the next{" "}
                {(s.fires ?? []).length} slots have nothing to publish.
              </Callout>
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
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-[var(--border)] text-[var(--muted-foreground)]"
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
          className="min-w-[160px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 font-mono text-[12px]"
        />
        <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
          {rows.length} shown
        </span>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <DataTable
          caption="Every article, its gate score and its publish status"
          captionHidden
          dense
          rows={rows}
          rowKey={(a: any) => a.slug}
          empty="Nothing matches this filter."
          columns={[
            {
              id: "article",
              header: "Article",
              className: "max-w-[380px]",
              cell: (a: any) => (
                <>
                  <div className="truncate">{a.title}</div>
                  <div className="truncate font-mono text-[10.5px] text-[var(--muted-foreground)]">
                    {a.slug}
                  </div>
                </>
              ),
            },
            {
              id: "score",
              header: "Score",
              align: "end",
              cell: (a: any) => (
                <span className={TONE[a.gate as Gate]}>{a.score ?? "—"}</span>
              ),
            },
            {
              id: "status",
              header: "Status",
              className: "font-mono text-[11px] text-[var(--muted-foreground)]",
              cell: (a: any) => (
                <>
                  {a.published ? "published" : (a.status ?? "draft")}
                  {!a.hasCover && (
                    <span className="ml-1.5 text-[var(--warning)]">no cover</span>
                  )}
                </>
              ),
            },
            {
              id: "words",
              header: "Words",
              align: "end",
              className: "text-[var(--muted-foreground)]",
              cell: (a: any) => a.words.toLocaleString(),
            },
            {
              id: "links",
              header: "Links",
              cell: (a: any) => (
                <span className="flex gap-1.5 font-mono text-[10px] uppercase">
                  <a
                    href={`https://ofriperetz.dev/articles/${a.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                  >
                    live
                  </a>
                  {a.devtoUrl && (
                    <a
                      href={a.devtoUrl}
                      target="_blank"
                      rel="noopener"
                      className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    >
                      dev.to
                    </a>
                  )}
                </span>
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}
