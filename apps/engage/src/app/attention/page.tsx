"use client";
import Link from "next/link";
import { useCachedSection } from "@/lib/client-cache";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Attention — who the platform features and engages, who stars us, and the
 * days something outside dev.to sent readers. Intent 2026-09-04-engage-attention.
 */
export default function Attention() {
  const { data, at, busy, refresh } = useCachedSection<any>(
    "attention",
    "/api/attention",
    () => null,
  );
  // The route hands back arrays, but a missing view would hand back nothing;
  // every list guards so one absent table cannot blank the page.
  const d = data;
  const day = (s: string) => String(s ?? "").slice(0, 10);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-10 pb-24">
      <header className="flex flex-col gap-1">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] hover:text-[var(--primary)]"
        >
          ← control room
        </Link>
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="text-[28px] font-semibold tracking-tight">
            Attention
          </h1>
          <button
            onClick={() => refresh()}
            disabled={busy}
            className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--primary)]"
          >
            {busy ? "reading…" : "refresh"}
          </button>
          {at ? (
            <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
              read {new Date(at).toLocaleString()}
            </span>
          ) : null}
        </div>
        <p className="max-w-3xl text-[14px] text-[var(--muted-foreground)]">
          Whom the staff feature and engage, who stars our repos, and the days
          someone outside dev.to sent readers. The founders&rsquo; brief on the
          home page says what they are building; this page says whom they pick.
        </p>
      </header>

      {!d ? (
        <Skeleton variant="data-table" label="Loading attention" />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                [
                  "featured, 120 days",
                  d.featuredUs ? `${d.featuredUs.times}×` : "never",
                  d.featuredUs
                    ? `last ${day(d.featuredUs.last)}`
                    : `${d.featured.length} people were`,
                ],
                [
                  "staff comments on us, 60 days",
                  d.engagedUs ? String(d.engagedUs.comments) : "0",
                  d.engagedUs
                    ? `by ${d.engagedUs.staff.join(", ")}`
                    : `${d.engaged.length} authors got some`,
                ],
                ["stars, 120 days", String(d.stars), "across the three repos"],
                [
                  "promotion events, 120 days",
                  String((d.events ?? []).length),
                  "referrer jumps and star bursts",
                ],
              ] as [string, string, string][]
            ).map(([k, v, s]) => (
              <div
                key={k}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                  {k}
                </div>
                <div className="mt-1 text-xl font-semibold tabular-nums">
                  {v}
                </div>
                <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                  {s}
                </div>
              </div>
            ))}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                who gets featured · 120 days
              </h2>
              <ul className="mt-2 flex flex-col gap-1 text-[12px]">
                {d.featured.map((f: any) => (
                  <li key={f.author} className="flex items-baseline gap-2">
                    <span className="w-8 shrink-0 text-right font-mono tabular-nums">
                      {f.times}×
                    </span>
                    <a
                      href={`https://dev.to/${encodeURIComponent(f.author)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-[var(--primary)]"
                    >
                      @{f.author}
                    </a>
                    <span className="shrink-0 font-mono text-[10px] text-[var(--muted-foreground)]">
                      {f.programs.join(", ")} · {day(f.last)}
                    </span>
                  </li>
                ))}
                {d.featured.length === 0 ? (
                  <li className="text-[var(--muted-foreground)]">
                    no feature posts parsed yet; Top 7 ended 2025-09 and
                    Community Gems started 2026-09-02
                  </li>
                ) : null}
              </ul>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                whom the staff comment on · top articles, 60 days
              </h2>
              <ul className="mt-2 flex flex-col gap-1 text-[12px]">
                {d.engaged.map((e: any) => (
                  <li key={e.author} className="flex items-baseline gap-2">
                    <span className="w-8 shrink-0 text-right font-mono tabular-nums">
                      {e.comments}
                    </span>
                    <a
                      href={`https://dev.to/${encodeURIComponent(e.author)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-[var(--primary)]"
                    >
                      @{e.author}
                    </a>
                    <span className="shrink-0 font-mono text-[10px] text-[var(--muted-foreground)]">
                      {e.staff.join(", ")} · {day(e.last)}
                    </span>
                  </li>
                ))}
                {d.engaged.length === 0 ? (
                  <li className="text-[var(--muted-foreground)]">
                    no staff comments collected yet
                  </li>
                ) : null}
              </ul>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                promotion events · 120 days
              </h2>
              <ul className="mt-2 flex flex-col gap-1 text-[12px]">
                {(d.events ?? []).map((e: any) => (
                  <li
                    // (observed_on, kind, source) is the table's primary key: unique by construction.
                    key={`${e.observed_on}-${e.kind}-${e.source}`}
                    className="flex items-baseline gap-2"
                  >
                    <span className="w-20 shrink-0 font-mono text-[10px] text-[var(--muted-foreground)]">
                      {e.observed_on}
                    </span>
                    <span>
                      {e.kind === "stars"
                        ? `${e.value} stars on ${e.source}`
                        : `+${e.value} views via ${e.source}`}
                    </span>
                    {e.baseline != null ? (
                      <span className="shrink-0 font-mono text-[10px] text-[var(--muted-foreground)]">
                        baseline {e.baseline}
                      </span>
                    ) : null}
                  </li>
                ))}
                {(d.events ?? []).length === 0 ? (
                  <li className="text-[var(--muted-foreground)]">
                    none yet; referrer deltas need two days of rows, star bursts
                    need more than three in a day
                  </li>
                ) : null}
              </ul>
              <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                Also drawn as markers on the{" "}
                <Link href="/terminal" className="text-[var(--primary)]">
                  terminal
                </Link>
                , on the followers and views series.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                staff posts · 60 days
                {d.programs.length
                  ? ` · ${d.programs.map((p: any) => `${p.program} ${p.n}`).join(", ")}`
                  : ""}
              </h2>
              <ul className="mt-2 flex flex-col gap-1 text-[12px]">
                {d.posts.slice(0, 25).map((p: any) => (
                  <li key={p.article_id} className="flex items-baseline gap-2">
                    <span className="w-20 shrink-0 font-mono text-[10px] text-[var(--muted-foreground)]">
                      {day(p.published_at)}
                    </span>
                    <a
                      href={`https://dev.to/${encodeURIComponent(p.author)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-[var(--primary)]"
                    >
                      @{p.author}
                    </a>
                    <span className="truncate" title={p.title}>
                      {p.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-[var(--muted-foreground)]">
                      {p.reactions}rx{p.program ? ` · ${p.program}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <p className="text-[12px] text-[var(--muted-foreground)]">
            {d.caveat}
          </p>
        </>
      )}
    </main>
  );
}
