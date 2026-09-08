"use client";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useCachedSection } from "@/lib/client-cache";
import { Skeleton } from "@/components/ui/skeleton";
import { ME } from "@/lib/me";

/**
 * The climb — exact, interactive. Every member's window comes from their own
 * feed (engage-league.ts); this page pins our row, names the one author to
 * pass and what it costs, and lets every row open into its articles.
 */
type Art = {
  id: number;
  title: string;
  url: string;
  published_at: string;
  reactions: number;
  comments: number;
  tags: string[];
};
type Member = {
  author: string;
  name: string;
  reactions: number;
  comments: number;
  via: string[];
  articles: Art[];
  exact?: boolean;
};
type SortKey = "reactions" | "comments" | "articles" | "rx";

const day = (s: string) => String(s ?? "").slice(0, 10);

export default function League() {
  const { data, at, busy, refresh } = useCachedSection<any>(
    "league",
    "/api/league",
    () => ({ climb: null, tables: [], members: [] }),
  );
  const { data: impact } = useCachedSection<any>(
    "impact",
    "/api/impact",
    () => null,
  );
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<SortKey>("reactions");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);

  const c = data?.climb;
  const members: Member[] = data?.members ?? [];
  const ranked = useMemo(() => {
    const rx = (m: Member) => m.reactions / Math.max(1, m.articles.length);
    const key = (m: Member) =>
      sort === "reactions"
        ? m.reactions
        : sort === "comments"
          ? m.comments
          : sort === "articles"
            ? m.articles.length
            : rx(m);
    return members
      .map((m, i) => ({ ...m, rank: i + 1, rx: Math.round(10 * rx(m)) / 10 }))
      .sort((a, b) => key(b) - key(a) || a.rank - b.rank);
  }, [members, sort]);
  const shown = ranked.filter(
    (m) =>
      !q ||
      m.author.includes(q.toLowerCase()) ||
      m.name.toLowerCase().includes(q.toLowerCase()),
  );
  const ours = ranked.find((m) => m.author === ME) ?? null;
  const above = ours
    ? (ranked.filter((m) => m.rank === ours.rank - 1)[0] ?? null)
    : null;
  const below = ours
    ? (ranked.filter((m) => m.rank === ours.rank + 1)[0] ?? null)
    : null;
  const f = impact?.forecast;
  const hist: { day: string; rank: number | null; reactions: number | null }[] =
    impact?.leagueHistory ?? [];
  const yday = hist.length >= 2 ? hist[hist.length - 2] : null;
  const toggle = (a: string) => setOpen((o) => ({ ...o, [a]: !o[a] }));

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
            {busy ? "reading…" : "refresh"}
          </button>
          {at ? (
            <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
              read {new Date(at).toLocaleString()} ·{" "}
              {data?.source === "exact"
                ? "exact: every member's own feed"
                : "sample: top pages only"}
            </span>
          ) : null}
        </div>
        <p className="max-w-3xl text-[14px] text-[var(--muted-foreground)]">
          Every author with an article in dev.to&rsquo;s top 500 of the last 30
          days or the top 300 in #security, #javascript, #node or #ai. Their
          score is every reaction on every article they published in those 30
          days, read from their own feed. dev.to publishes no author score; this
          is the one it does publish, added up.
        </p>
      </header>

      {!c ? (
        <Skeleton variant="data-table" label="Loading the league" />
      ) : (
        <>
          {/* ── our line, and the one to pass ─────────────────────────────── */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                [
                  "Our rank",
                  ours ? `${ours.rank} / ${ranked.length}` : "absent",
                  yday?.rank != null && ours
                    ? `${yday.day.slice(5)}: ${yday.rank} · ${ours.rank < yday.rank ? `up ${yday.rank - ours.rank}` : ours.rank > yday.rank ? `down ${ours.rank - yday.rank}` : "unchanged"}`
                    : "first reading",
                ],
                [
                  "Our reactions, 30 days",
                  ours ? String(ours.reactions) : "—",
                  ours
                    ? `${ours.articles.length} articles · ${ours.rx} each${yday?.reactions != null ? ` · ${ours.reactions - yday.reactions >= 0 ? "+" : ""}${ours.reactions - yday.reactions} since ${yday.day.slice(5)}` : ""}`
                    : "",
                ],
                [
                  "To pass the one above",
                  above && ours
                    ? `+${above.reactions - ours.reactions + 1}`
                    : "—",
                  above
                    ? `@${above.author} · ${above.reactions} from ${above.articles.length} articles`
                    : "nobody above",
                ],
                [
                  "Holding off the one below",
                  below && ours
                    ? `${ours.reactions - below.reactions} ahead`
                    : "—",
                  below ? `@${below.author} · ${below.reactions}` : "",
                ],
                [
                  "To the next level",
                  c.next
                    ? `+${c.next.reactionsNeeded} → top ${c.next.level}`
                    : "—",
                  c.plan.articlesAtOurRate != null
                    ? `${c.plan.articlesAtOurRate} articles at our rate, ${c.plan.articlesAtTop10Rate} at the top-10 rate of ${c.plan.top10RxPerArticle}`
                    : "",
                ],
                [
                  "Thresholds",
                  `top 100 · ${c.thresholds[100] ?? "—"}`,
                  `top 50 · ${c.thresholds[50] ?? "—"} · top 20 · ${c.thresholds[20] ?? "—"} · top 10 · ${c.thresholds[10] ?? "—"} · top 5 · ${c.thresholds[5] ?? "—"}`,
                ],
                forecastTile(f),
                [
                  "Members",
                  String(ranked.length),
                  `${c.articles} articles in the window`,
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

          {ours ? (
            <section className="rounded-lg border border-[var(--primary)] bg-[var(--card)] p-4">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                What counts for us right now · {ours.articles.length} articles
                in the window
              </h2>
              <Articles arts={ours.articles} />
              <p className="mt-2 text-[12px] text-[var(--muted-foreground)]">
                Each article leaves the window 30 days after publish and takes
                its reactions with it.{" "}
                {above
                  ? `Passing @${above.author} takes +${above.reactions - ours.reactions + 1} on any of these, or a new article that earns it.`
                  : ""}
              </p>
            </section>
          ) : null}

          {hist.length >= 2 ? (
            <section className="text-[12px] text-[var(--muted-foreground)]">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
                daily ·{" "}
              </span>
              {hist
                .slice(-7)
                .map(
                  (h) =>
                    `${h.day.slice(5)} rank ${h.rank ?? "—"} · ${h.reactions ?? "—"} rx`,
                )
                .join("  →  ")}
            </section>
          ) : null}

          {/* ── the ladder around us ───────────────────────────────────────── */}
          {ours ? (
            <section>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                The ladder around us · five above, us, three below · click a row
                for their articles
              </h2>
              <Rows
                rows={ranked.filter(
                  (m) => m.rank >= ours.rank - 5 && m.rank <= ours.rank + 3,
                )}
                ours={ours}
                open={open}
                toggle={toggle}
              />
            </section>
          ) : null}

          {/* ── everyone ──────────────────────────────────────────────────── */}
          <section>
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                Everyone · {shown.length} of {ranked.length}
              </h2>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="find an author"
                className="rounded border border-[var(--border)] bg-transparent px-2 py-0.5 font-mono text-[11px]"
              />
              <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                sort:
              </span>
              {(["reactions", "comments", "articles", "rx"] as SortKey[]).map(
                (k) => (
                  <button
                    key={k}
                    onClick={() => setSort(k)}
                    className={`font-mono text-[10px] uppercase tracking-wider ${sort === k ? "text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:text-[var(--primary)]"}`}
                  >
                    {k === "rx" ? "rx / article" : k}
                  </button>
                ),
              )}
            </div>
            <Rows
              rows={shown.slice(0, limit)}
              ours={ours}
              open={open}
              toggle={toggle}
            />
            {shown.length > limit ? (
              <button
                onClick={() => setLimit((l) => l + 100)}
                className="mt-2 font-mono text-[11px] uppercase tracking-wider text-[var(--primary)]"
              >
                show {Math.min(100, shown.length - limit)} more
              </button>
            ) : null}
          </section>

          {/* ── per tag ───────────────────────────────────────────────────── */}
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(data.tables ?? []).map((t: any) => (
              <div
                key={t.tag}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
              >
                <div className="flex items-baseline gap-2">
                  <button
                    onClick={() => setQ("")}
                    className="font-mono text-[11px] uppercase tracking-[0.1em]"
                  >
                    #{t.tag}
                  </button>
                  <span className="text-[12px] text-[var(--muted-foreground)]">
                    {t.rank
                      ? `we are ${t.rank} of ${t.authors}`
                      : `absent from ${t.authors} authors`}
                    {t.ours
                      ? ` · ${t.ours.reactions} rx from ${t.ours.articles}`
                      : ""}
                  </span>
                </div>
                <ul className="mt-2 text-[12px]">
                  {[
                    ...t.top.slice(0, 5),
                    ...(t.above ?? [])
                      .slice(-2)
                      .filter(
                        (l: any) =>
                          !t.top
                            .slice(0, 5)
                            .some((x: any) => x.author === l.author),
                      ),
                  ].map((l: any) => (
                    <li key={l.author} className="flex gap-2">
                      <button
                        onClick={() => setQ(l.author)}
                        className="font-mono text-left text-[var(--primary)]"
                      >
                        @{l.author}
                      </button>
                      <span className="tabular-nums text-[var(--muted-foreground)]">
                        {l.reactions} rx · {l.comments} cm · {l.articles} art
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

function Articles({ arts }: { arts: Art[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-0.5 text-[12px]">
      {[...arts]
        .sort((a, b) => b.reactions - a.reactions)
        .map((a) => (
          <li key={a.id} className="flex items-baseline gap-2">
            <span className="w-10 shrink-0 text-right font-mono tabular-nums">
              {a.reactions} rx
            </span>
            <span className="w-8 shrink-0 text-right font-mono tabular-nums text-[var(--muted-foreground)]">
              {a.comments} cm
            </span>
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-[var(--primary)]"
              title={a.title}
            >
              {a.title}
            </a>
            <span className="shrink-0 font-mono text-[10px] text-[var(--muted-foreground)]">
              {day(a.published_at)} · leaves{" "}
              {day(
                new Date(
                  Date.parse(a.published_at) + 30 * 86_400_000,
                ).toISOString(),
              )}
            </span>
          </li>
        ))}
      {arts.length === 0 ? (
        <li className="text-[var(--muted-foreground)]">
          nothing in the window
        </li>
      ) : null}
    </ul>
  );
}

function Rows({
  rows,
  ours,
  open,
  toggle,
}: {
  rows: (Member & { rank: number; rx: number })[];
  ours: (Member & { rank: number }) | null;
  open: Record<string, boolean>;
  toggle: (a: string) => void;
}) {
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
            <th className="px-2 py-1.5 text-right">rx / article</th>
            <th className="px-2 py-1.5 text-right">gap to us</th>
            <th className="px-2 py-1.5 text-left">in via</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <Fragment key={m.author}>
              <tr
                onClick={() => toggle(m.author)}
                className={`cursor-pointer border-t border-[var(--border)] hover:bg-[var(--muted)] ${m.author === ME ? "bg-[var(--card)] font-semibold" : ""}`}
              >
                <td className="px-2 py-1 text-right font-mono tabular-nums text-[var(--muted-foreground)]">
                  {m.rank}
                </td>
                <td className="px-2 py-1">
                  <a
                    className="font-mono"
                    href={`https://dev.to/${encodeURIComponent(m.author)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    @{m.author}
                  </a>
                  {m.name ? (
                    <span className="text-[var(--muted-foreground)]">
                      {" "}
                      · {m.name}
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {m.reactions}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {m.comments}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {m.articles.length}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">{m.rx}</td>
                <td className="px-2 py-1 text-right font-mono tabular-nums">
                  {ours && m.author !== ME
                    ? m.reactions >= ours.reactions
                      ? `+${m.reactions - ours.reactions + 1}`
                      : `−${ours.reactions - m.reactions}`
                    : ""}
                </td>
                <td className="px-2 py-1 font-mono text-[10px] text-[var(--muted-foreground)]">
                  {m.via.join(" ")}
                  {m.exact === false ? " · sampled" : ""}
                </td>
              </tr>
              {open[m.author] ? (
                <tr className="border-t border-[var(--border)]">
                  <td colSpan={8} className="px-4 py-2">
                    <Articles arts={m.articles} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
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
  if (f.nextLevel == null)
    return [
      "Forecast",
      "at the top",
      `${f.slopePerDay ?? 0} places a day over ${f.days} days`,
    ];
  return [
    "Forecast",
    "not climbing",
    `${f.slopePerDay ?? 0} places a day over ${f.days} days`,
  ];
}
