"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cachedFetch } from "@/lib/client-cache";
import { Callout } from "@/components/ui/callout";
import { RankedBarList } from "@/components/ui/meter";
import { Skeleton } from "@/components/ui/skeleton";
import { StatStrip } from "@/components/ui/stat-strip";

const APP_TONE: Record<string, string> = {
  eslint_docs: "var(--primary)",
  blog: "var(--success)",
  ds: "var(--warning)",
};

function fmt(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60}m`;
}

/**
 * Who came, where from, and what they actually read.
 *
 * The reason this page exists rather than another chart: aggregates say "the
 * docs homepage got 68 views", which cannot tell you whether that was 68 people
 * glancing or one person reading. A path can. The single most useful row here so
 * far was one visitor from npm reading ten rule pages over five minutes — a
 * fact no bar chart would ever have shown.
 *
 * Bounces are counted, never hidden. 90% of sessions are one page, and a page
 * that quietly dropped them would make every other number look better than it is.
 */
export default function Journeys() {
  const [d, setD] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [app, setApp] = useState<string>("all");

  useEffect(() => {
    setD(null);
    // Reset the property filter with the window. A property present in 30 days
    // may have no sessions in 7, and a filter that silently survives leaves you
    // staring at an empty list with no clue why.
    setApp("all");
    cachedFetch(`journeys:${days}`, `/api/journeys?days=${days}`)
      .then(setD)
      .catch(() => setD({ error: "unreachable", sessions: [] }));
  }, [days]);

  const apps = useMemo(
    () => [...new Set((d?.sessions ?? []).map((s: any) => s.app))] as string[],
    [d],
  );
  const rows = useMemo(
    () =>
      (d?.sessions ?? []).filter((s: any) => app === "all" || s.app === app),
    [d, app],
  );

  const s = d?.summary ?? {};

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 pb-24">
      <header className="flex flex-col gap-1">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] hover:text-[var(--primary)]"
        >
          ← control room
        </Link>
        <h1 className="text-[28px] font-semibold tracking-tight">Journeys</h1>
        <p className="max-w-[74ch] text-[14px] text-[var(--muted-foreground)]">
          Individual sessions as ordered paths. Aggregates cannot tell you
          whether 68 views were 68 glances or one person reading — a path can.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
        {[7, 14, 30].map((n) => (
          <button
            key={n}
            onClick={() => setDays(n)}
            className={`border px-2 py-0.5 ${
              days === n
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--card)]"
                : "border-[var(--border)] text-[var(--muted-foreground)]"
            }`}
          >
            {n}d
          </button>
        ))}
        <span className="mx-1 text-[var(--border)]">|</span>
        {["all", ...apps].map((a) => (
          <button
            key={a}
            onClick={() => setApp(a)}
            className={`border px-2 py-0.5 ${
              app === a
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-[var(--border)] text-[var(--muted-foreground)]"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {!d ? (
        <Skeleton variant="stat-strip" count={8} label="Loading session journeys" />
      ) : d.error ? (
        <Callout tone="danger" title="Journeys unavailable">
          {d.error}
        </Callout>
      ) : (
        <>
          {/* These four come from a server-side aggregate over EVERY session.
              The property filter below only narrows the LIST, so with a filter
              active the two describe different populations — exactly the
              denominator mismatch that made this endpoint report "0 bounced".
              Label it rather than letting the numbers imply a scope they do
              not have. */}
          {app !== "all" && (
            <Callout tone="warn" title="Two different populations">
              Totals below cover <b>all properties</b>; the session list is
              filtered to <b>{app}</b>.
            </Callout>
          )}
          <StatStrip
            cols={4}
            announce={{ noun: "session totals" }}
            items={[
              { key: "sessions", label: "sessions", value: s.sessions ?? null },
              { key: "multi", label: "read more than one page", value: s.multiStep ?? null },
              {
                key: "bounce",
                label: "bounced",
                value: s.bounceRate != null ? Math.round(s.bounceRate * 100) : null,
                unit: "%",
              },
              {
                key: "median",
                label: "median time (multi-page)",
                value: s.medianSeconds != null ? fmt(s.medianSeconds) : null,
              },
            ]}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              {/*
                These were two bare label/number rows with no visual magnitude
                at all. `<RankedBarList>` gives each row a `role="meter"` bar
                against a shared denominator, so "where they come from" is
                readable as a shape and not just as a column of integers.
              */}
              <RankedBarList
                caption="Where they come from"
                size="sm"
                rows={(d.referrers ?? []).map((r: any) => ({
                  key: r.source,
                  // `RankedBarList` sets `uppercase` on its own label span and
                  // exposes no way to opt out, so a URL or a hostname has to
                  // re-assert its casing from inside the node. Left alone it
                  // renders `/DOCS/SECURITY/...` for a case-sensitive path.
                  label: (
                    <span className="normal-case">
                      {r.source === "$direct" ? "direct / unknown" : r.source}
                    </span>
                  ),
                  value: r.n ?? null,
                }))}
              />
              <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                Scope differs from &ldquo;doors&rdquo; on purpose: referrers are
                counted over the <b>deep sessions listed below</b> (a one-page
                bounce&apos;s referrer says little about intent), while doors are a
                server-side aggregate over <b>every</b> session.
              </p>
            </div>

            <RankedBarList
              caption="The doors people come through"
              size="sm"
              rows={(d.doors ?? []).slice(0, 10).map((x: any) => ({
                key: `${x.app}${x.landing}`,
                label: (
                  <span className="min-w-0 truncate">
                    <span
                      className="mr-1.5 font-mono text-[10px] uppercase"
                      style={{ color: APP_TONE[x.app] ?? "var(--muted-foreground)" }}
                    >
                      {x.app}
                    </span>
                    <span className="font-mono text-[11.5px] normal-case">
                      {x.landing || "/"}
                    </span>
                  </span>
                ),
                value: x.n ?? null,
              }))}
            />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] pb-2 font-mono text-[12px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              <span>Deepest sessions · {rows.length}</span>
              {d.note && (
                <span className="normal-case tracking-normal text-[var(--muted-foreground)]">
                  {d.note}
                </span>
              )}
            </h2>
            <div className="flex flex-col gap-2">
              {rows.map((x: any) => (
                <div
                  key={x.sid + x.started}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--muted-foreground)]">
                    <span
                      className="uppercase"
                      style={{ color: APP_TONE[x.app] ?? "var(--muted-foreground)" }}
                    >
                      {x.app}
                    </span>
                    <span className="text-[var(--muted-foreground)]">
                      {x.steps} pages · {fmt(x.seconds)}
                    </span>
                    <span>{x.country}</span>
                    <span>{x.device}</span>
                    <span className="truncate">
                      via{" "}
                      {x.referrer === "$direct" ? "direct" : x.referrer}
                    </span>
                    <span className="ml-auto">
                      {new Date(x.started).toLocaleDateString()}
                    </span>
                  </div>
                  {/* The path is the point. Steps are separated so a long one
                      wraps into readable chunks rather than one wide line the
                      page has to scroll sideways for. */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    {x.path.split(" → ").map((step: string, i: number) => (
                      <span key={i} className="flex items-center gap-1.5">
                        {i > 0 && (
                          <span className="text-[var(--muted-foreground)]">→</span>
                        )}
                        <span className="rounded bg-[var(--background)] px-1.5 py-0.5 font-mono text-[11.5px] text-[var(--muted-foreground)]">
                          {step}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
