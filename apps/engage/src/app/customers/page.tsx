"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCachedSection } from "@/lib/client-cache";
import { Refresh } from "@/components/panels";

/**
 * The customer monitor.
 *
 * `/conquest` asks where the next PR should go. This asks the question that
 * comes after a merge and otherwise never gets asked: is the consumer still
 * there, and is it being shown false positives.
 *
 * Drawn as a bipartite graph — what we publish on the left, who installs it on
 * the right — because here the shape IS the information, unlike the conquest
 * map. Two things are legible at a glance that a table cannot show: a package
 * with no edge at all has downloads but no discoverable consumer, and a thick
 * edge is a config aggregator whose own consumers inherit our rules.
 *
 * Findings are what that repository's maintainers see when they run the
 * PUBLISHED plugins. Not a local build — a stranger runs what is on npm.
 */

interface Customer {
  slug: string;
  depth: string;
  stars: number;
  kloc: number;
  findings: number;
  verifiedFalse: number;
  unread: number;
  perKloc: number | null;
  idleDays: number | null;
  churn: "live" | "aging" | "dormant" | "unknown";
  plugins: string[];
  note?: string;
  via?: number;
}

const CHURN_TONE: Record<string, string> = {
  live: "var(--color-good)",
  aging: "var(--color-warn)",
  dormant: "var(--color-accent)",
  unknown: "var(--color-ink-3)",
};

const CHURN_WORD: Record<string, string> = {
  live: "active",
  aging: "aging",
  dormant: "dormant",
  unknown: "unknown",
};

const short = (slug: string) => {
  const [owner, name] = slug.split("/");
  return name && name.length > 26 ? `${owner}/${name.slice(0, 24)}…` : slug;
};

export default function Customers() {
  const { data, at, busy, refresh } = useCachedSection<any>(
    "customers",
    "/api/customers",
    () => ({ customers: [], packages: [], error: "unreachable" }),
  );

  const customers: Customer[] = data?.customers ?? [];
  const packages: any[] = data?.packages ?? [];
  const totals = data?.totals ?? null;

  /**
   * Node placement.
   *
   * Hand-placed rather than force-directed: with eight consumers a force layout
   * only adds jitter, and the vertical order carries meaning a simulation would
   * scramble — consumers are sorted by churn so anything at risk sits together
   * at the bottom.
   */
  const layout = useMemo(() => {
    const order = { live: 0, aging: 1, dormant: 2, unknown: 3 } as Record<string, number>;
    const sorted = [...customers].sort(
      (a, b) => (order[a.churn] ?? 9) - (order[b.churn] ?? 9) || b.findings - a.findings,
    );
    const H = 54;
    const top = 52;
    const pkgY = new Map<string, number>();
    packages.forEach((p, i) => pkgY.set(p.name.replace(/^eslint-plugin-/, ""), top + i * H));
    const custY = new Map<string, number>();
    sorted.forEach((c, i) => custY.set(c.slug, top + i * H));
    return { sorted, pkgY, custY, height: top + Math.max(packages.length, sorted.length) * H + 20 };
  }, [customers, packages]);

  const maxDl = Math.max(1, ...packages.map((p) => p.weeklyDownloads ?? 0));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-10 pb-24">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
          >
            ← engage
          </Link>
          <Refresh at={at} busy={busy} onClick={refresh} />
        </div>
        <h1 className="text-[28px] font-semibold tracking-tight">Customers</h1>
        <p className="max-w-[66ch] text-[14px] text-[var(--color-ink-2)]">
          Downloads measure curiosity. This measures the two things that decide impact:
          which repositories genuinely execute our rules, and whether those repositories
          are being shown false positives. A customer seeing noise is a churn event that
          has not happened yet.
        </p>
      </header>

      {data?.error ? (
        <div className="rounded-xl border border-[var(--color-accent)] bg-[var(--color-panel)] p-4 text-[13px]">
          <div className="font-mono text-[var(--color-accent)]">{data.error}</div>
          {data.hint ? (
            <div className="mt-1 text-[var(--color-ink-3)]">{data.hint}</div>
          ) : null}
        </div>
      ) : null}

      {totals ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-5">
          {[
            { k: "downloads / wk", v: totals.weeklyDownloads.toLocaleString(), n: `${packages.length} packages` },
            { k: "running rules", v: totals.customers, n: `${totals.configures} configure` },
            { k: "clean", v: `${totals.clean} / ${totals.customers}`, n: "no findings", warn: totals.clean < totals.customers },
            { k: "exposed", v: totals.exposed, n: "see findings today", warn: totals.exposed > 0 },
            { k: "dormant", v: totals.dormant, n: "> 90d idle", warn: totals.dormant > 0 },
          ].map((s: any) => (
            <div key={s.k} className="bg-[var(--color-panel)] p-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-3)]">
                {s.k}
              </div>
              <div
                className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight"
                style={s.warn ? { color: "var(--color-accent)" } : undefined}
              >
                {s.v}
              </div>
              <div className="text-[11px] text-[var(--color-ink-3)]">{s.n}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* ---- the graph ---- */}
      {customers.length ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-[16px] font-semibold tracking-tight">Dependency graph</h2>
            <p className="max-w-[70ch] text-[13px] text-[var(--color-ink-3)]">
              Left: what we publish, sized by weekly downloads. Right: who installs it,
              ordered so anything at risk sits together at the bottom. A thick edge means
              the consumer <em>configures</em> the plugin, so its own consumers run our
              rules too — that edge outweighs any number of listings.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-2">
            <svg
              viewBox={`0 0 900 ${layout.height}`}
              className="block h-auto w-full min-w-[700px]"
              role="img"
              aria-label={`Bipartite graph: ${packages.length} published plugins on the left connect to ${customers.length} consuming repositories on the right.`}
            >
              <text x="18" y="26" className="fill-[var(--color-ink-3)] font-mono text-[10px] uppercase tracking-[0.13em]">
                Published
              </text>
              <text x="500" y="26" className="fill-[var(--color-ink-3)] font-mono text-[10px] uppercase tracking-[0.13em]">
                Running our rules
              </text>

              {/* edges first so nodes sit above them */}
              {layout.sorted.flatMap((c) =>
                (c.plugins ?? []).map((p) => {
                  const y1 = layout.pkgY.get(p);
                  const y2 = layout.custY.get(c.slug);
                  if (y1 == null || y2 == null) return null;
                  const strong = c.depth === "configures";
                  return (
                    <path
                      key={`${c.slug}-${p}`}
                      d={`M 250 ${y1} C 370 ${y1}, 380 ${y2}, 490 ${y2}`}
                      fill="none"
                      stroke={strong ? "var(--color-accent)" : "var(--color-line)"}
                      strokeWidth={strong ? 2 : 1.25}
                    />
                  );
                }),
              )}

              {/* packages */}
              {packages.map((p) => {
                const nm = p.name.replace(/^eslint-plugin-/, "");
                const y = layout.pkgY.get(nm) ?? 0;
                const used = customers.some((c) => (c.plugins ?? []).includes(nm));
                const r = 6 + 9 * ((p.weeklyDownloads ?? 0) / maxDl);
                return (
                  <g key={p.name}>
                    <circle
                      cx="240"
                      cy={y}
                      r={r}
                      fill={used ? "var(--color-ink)" : "none"}
                      stroke={used ? "none" : "var(--color-accent)"}
                      strokeWidth={used ? 0 : 2}
                      strokeDasharray={used ? undefined : "3 3"}
                    />
                    <text x="220" y={y - 3} textAnchor="end" className="fill-[var(--color-ink)] font-mono text-[11px]">
                      {nm}
                    </text>
                    <text
                      x="220"
                      y={y + 10}
                      textAnchor="end"
                      className="font-mono text-[9.5px]"
                      fill={used ? "var(--color-ink-3)" : "var(--color-accent)"}
                    >
                      {(p.weeklyDownloads ?? 0).toLocaleString()} / wk
                      {used ? "" : " · no consumer"}
                    </text>
                  </g>
                );
              })}

              {/* consumers */}
              {layout.sorted.map((c) => {
                const y = layout.custY.get(c.slug) ?? 0;
                const tone = CHURN_TONE[c.churn];
                return (
                  <g key={c.slug}>
                    <rect x="490" y={y - 9} width="11" height="18" fill={tone} rx="1" />
                    <text x="512" y={y - 1} className="fill-[var(--color-ink)] font-mono text-[11px]">
                      {short(c.slug)}
                    </text>
                    <text x="512" y={y + 11} className="fill-[var(--color-ink-3)] font-mono text-[9.5px]">
                      {c.depth}
                      {" · "}
                      {c.findings === 0 ? "0 findings" : `${c.findings} findings`}
                      {c.verifiedFalse ? ` · ${c.verifiedFalse} false` : ""}
                      {c.idleDays != null ? ` · ${c.idleDays}d idle` : ""}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>
      ) : null}

      {/* ---- monitor ---- */}
      {customers.length ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-[16px] font-semibold tracking-tight">Monitor</h2>
            <p className="max-w-[70ch] text-[13px] text-[var(--color-ink-3)]">
              <b>Unread is not clean.</b> The gap between what a consumer is shown and
              what we have actually read in source is the number that decides whether
              this page is reassuring.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr>
                  {["Repository", "Depth", "Idle", "Shown", "Read false", "Unread", "/ KLOC", ""].map((h) => (
                    <th
                      key={h}
                      className="border-b border-[var(--color-line)] px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-3)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {layout.sorted.map((c) => (
                  <tr key={c.slug} className="align-top">
                    <td
                      className="border-b border-[var(--color-line)] px-3 py-2.5"
                      style={{ boxShadow: `inset 3px 0 0 ${CHURN_TONE[c.churn]}` }}
                    >
                      <a
                        href={`https://github.com/${c.slug.replace("/*", "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[12px] hover:text-[var(--color-accent)]"
                      >
                        {c.slug}
                      </a>
                      {c.note ? (
                        <div className="mt-1 max-w-[52ch] text-[11.5px] leading-snug text-[var(--color-ink-3)]">
                          {c.note}
                        </div>
                      ) : null}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-3 py-2.5">
                      <span
                        className="font-mono text-[10px] uppercase tracking-wide"
                        style={{
                          color:
                            c.depth === "configures"
                              ? "var(--color-accent)"
                              : "var(--color-ink-3)",
                        }}
                      >
                        {c.depth}
                      </span>
                    </td>
                    <td className="border-b border-[var(--color-line)] px-3 py-2.5 font-mono text-[12px] tabular-nums">
                      {c.idleDays != null ? `${c.idleDays}d` : "—"}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-3 py-2.5 font-mono text-[12px] tabular-nums">
                      {c.findings}
                    </td>
                    <td
                      className="border-b border-[var(--color-line)] px-3 py-2.5 font-mono text-[12px] tabular-nums"
                      style={c.verifiedFalse ? { color: "var(--color-accent)" } : undefined}
                    >
                      {c.verifiedFalse || "—"}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-3 py-2.5 font-mono text-[12px] tabular-nums text-[var(--color-ink-3)]">
                      {c.unread || "—"}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-3 py-2.5 font-mono text-[12px] tabular-nums text-[var(--color-ink-3)]">
                      {c.perKloc ?? "—"}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-3 py-2.5">
                      <span
                        className="font-mono text-[10px] uppercase tracking-wide"
                        style={{ color: CHURN_TONE[c.churn] }}
                      >
                        {CHURN_WORD[c.churn]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11.5px] text-[var(--color-ink-3)]">
            Measured against the published packages, never a local build — a stranger runs
            what is on npm. Consumers are found by code search over{" "}
            <span className="font-mono">package.json</span>, so private and vendored
            consumers are invisible and the count is a floor.
          </p>
        </section>
      ) : null}
    </main>
  );
}
