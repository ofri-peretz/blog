"use client";
import Link from "next/link";
import { useCachedSection } from "@/lib/client-cache";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The climb. Where we rank among every author who mattered this month, who
 * is next, and what passing them takes — in articles at our rate and at the
 * top-10 rate. Reactions are the currency dev.to ranks by; comments and
 * articles are printed beside them, never blended in. Intent:
 * docs/sdlc/intents/2026-09-04-engage-climb.
 */
export default function League() {
  const { data, at, busy, refresh } = useCachedSection<any>(
    "league",
    "/api/league",
    () => ({ climb: null, tables: [] }),
  );
  // The forecast rides on /api/impact: the league chunk cannot load node:sqlite.
  const { data: impact } = useCachedSection<any>(
    "impact",
    "/api/impact",
    () => null,
  );
  const f = impact?.forecast;
  const c = data?.climb;
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
            The climb
          </h1>
          <button
            onClick={() => refresh()}
            disabled={busy}
            className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--primary)]"
          >
            {busy ? "crawling…" : "refresh"}
          </button>
          {at ? (
            <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
              read {new Date(at).toLocaleString()}
            </span>
          ) : null}
        </div>
        <p className="max-w-3xl text-[14px] text-[var(--muted-foreground)]">
          Every author with an article in dev.to&rsquo;s top 500 of the last 30
          days, plus the top 300 in #security, #javascript, #node and #ai,
          ranked by reactions. dev.to publishes no author score; this is the one
          it does publish, article by article, added up.
        </p>
      </header>

      {!c ? (
        <Skeleton variant="data-table" label="Loading the league" />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[...tiles(c), forecastTile(f)].map(([k, v, s]) => (
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

          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              The bar at each level, in reactions this month
            </h2>
            <div className="mt-2 flex flex-wrap gap-2 font-mono text-[12px]">
              {Object.entries(c.thresholds).map(([L, v]) => (
                <span
                  key={L}
                  className={`rounded border px-2 py-1 ${c.level === Number(L) ? "border-[var(--primary)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}
                >
                  top {L}: {String(v ?? "—")}
                </span>
              ))}
            </div>
          </section>

          {c.nextUp.length ? (
            <section>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                Next up — the five directly above us
              </h2>
              <Table rows={c.nextUp} gap />
            </section>
          ) : null}

          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              The top 25
            </h2>
            <Table rows={c.top} />
          </section>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(data.tables ?? []).map((t: any) => (
              <div
                key={t.tag}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em]">
                    #{t.tag}
                  </span>
                  <span className="text-[12px] text-[var(--muted-foreground)]">
                    {t.rank
                      ? `we are ${t.rank} of ${t.authors}`
                      : `absent from ${t.authors} authors`}
                  </span>
                </div>
                <ul className="mt-2 text-[12px]">
                  {t.top.slice(0, 5).map((l: any, i: number) => (
                    <li key={l.author} className="flex gap-2">
                      <span className="w-4 font-mono text-[var(--muted-foreground)]">
                        {i + 1}
                      </span>
                      <a
                        className="font-mono"
                        href={`https://dev.to/${encodeURIComponent(l.author)}`}
                        target="_blank"
                        rel="noopener"
                      >
                        @{l.author}
                      </a>
                      <span className="ml-auto tabular-nums">
                        {l.reactions} rx · {l.comments} cm · {l.articles} art
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
          <p className="text-[12px] text-[var(--muted-foreground)]">
            Sample-bound: an article outside these pages is invisible here. A
            single viral post moves an author a hundred places in a week, which
            is why articles and reactions per article print beside rank.
          </p>
        </>
      )}
    </main>
  );
}

/** One tile: a date once seven daily rank rows exist, "collecting" until then. */
function forecastTile(f: any): [string, string, string] {
  if (!f) return ["Forecast", "—", "reading"];
  if (f.days < f.need)
    return [
      "Forecast",
      `collecting ${f.days} of ${f.need} days`,
      "a straight line through the daily rank",
    ];
  if (f.etaNext)
    return [
      "Forecast",
      `top ${f.nextLevel} by ${f.etaNext}`,
      `${f.slopePerDay} places a day over ${f.days} days`,
    ];
  return [
    "Forecast",
    "not climbing",
    `${f.slopePerDay ?? 0} places a day over ${f.days} days`,
  ];
}

function tiles(c: any): [string, string, string][] {
  return [
    [
      "Rank",
      c.rank ? `${c.rank} / ${c.authors}` : "absent",
      `${c.articles} articles sampled`,
    ],
    [
      "Level",
      c.level ? `top ${c.level}` : "outside the top 500",
      c.next ? `next: top ${c.next.level}` : "the top",
    ],
    [
      "To the next level",
      c.next ? `+${c.next.reactionsNeeded} reactions` : "—",
      c.ours
        ? `we have ${c.ours.reactions} from ${c.ours.articles} articles`
        : "",
    ],
    [
      "In articles",
      c.plan.articlesAtOurRate != null
        ? `${c.plan.articlesAtOurRate} at our ${c.plan.ourRxPerArticle}/article`
        : "—",
      c.plan.articlesAtTop10Rate != null
        ? `or ${c.plan.articlesAtTop10Rate} at the top-10 rate of ${c.plan.top10RxPerArticle}`
        : "",
    ],
  ];
}

function Table({ rows, gap = false }: { rows: any[]; gap?: boolean }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
            <th className="px-2 py-1.5 text-right">#</th>
            <th className="px-2 py-1.5 text-left">author</th>
            <th className="px-2 py-1.5 text-right">reactions</th>
            <th className="px-2 py-1.5 text-right">comments</th>
            <th className="px-2 py-1.5 text-right">articles</th>
            <th className="px-2 py-1.5 text-right">
              {gap ? "gap to us" : "rx / article"}
            </th>
            <th className="px-2 py-1.5 text-left">{gap ? "" : "tags"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.author} className="border-t border-[var(--border)]">
              <td className="px-2 py-1 text-right font-mono tabular-nums text-[var(--muted-foreground)]">
                {l.rank}
              </td>
              <td className="px-2 py-1">
                <a
                  className="font-mono"
                  href={`https://dev.to/${encodeURIComponent(l.author)}`}
                  target="_blank"
                  rel="noopener"
                >
                  @{l.author}
                </a>
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {l.reactions}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {l.comments}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {l.articles}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {gap ? `+${l.gap}` : l.rxPerArticle}
              </td>
              <td className="px-2 py-1 text-[11px] text-[var(--muted-foreground)]">
                {gap
                  ? ""
                  : (l.tags ?? []).map((t: string) => `#${t}`).join(" ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
