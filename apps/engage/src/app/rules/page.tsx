"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCachedSection } from "@/lib/client-cache";
import { Refresh } from "@/components/panels";
import type { RuleEntry } from "@/lib/sources";

/**
 * Only ever hand http(s) to an href. CWE-79.
 *
 * `docsUrl` arrives from rules-manifest.json, which a script generates by
 * reading plugin metadata. React does NOT sanitize href, so a `javascript:`
 * value there executes on click — and "the manifest is trusted" is a property
 * of today's toolchain, not of the rendering code. A one-line check costs
 * nothing and removes the class.
 *
 * Returns null for anything else, so the caller renders no link rather than
 * a broken or hostile one. (Review flagged this three times.)
 */
function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, "https://ofriperetz.dev");
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

type Payload = {
  generatedAt: string | null;
  totals: Record<string, number> | null;
  rules: RuleEntry[];
  error: string | null;
};

/**
 * A missing measurement renders as an em dash, never as zero.
 *
 * `corpusFindings: null`, `seal: null` and `detection: null` all mean "nobody
 * measured this", and every one of them would read as 0 if formatted naively.
 * A zero here would claim the opposite of what is true — that someone looked
 * and found none.
 */
function num(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

function pct(value: number | null | undefined) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "—";
}

type PluginGroup = {
  prefix: string;
  rules: RuleEntry[];
  recommended: number;
  measured: number;
  tp: number;
  fp: number;
  fn: number;
  clean: number;
};

export default function Rules() {
  const { data, at, busy, refresh } = useCachedSection<Payload>(
    "rules",
    "/api/rules",
    () => ({ generatedAt: null, totals: null, rules: [], error: "unreachable" }),
  );

  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<"all" | "recommended" | "measured" | "imperfect">("all");
  const [openPlugin, setOpenPlugin] = useState<string | null>(null);
  const [openRule, setOpenRule] = useState<string | null>(null);

  const all = useMemo(() => data?.rules ?? [], [data]);

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (only === "recommended" && r.recommended === null) return false;
      if (only === "measured" && !r.detection) return false;
      if (only === "imperfect" && !(r.detection && (r.detection.fp > 0 || r.detection.fn > 0)))
        return false;
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.cwe ?? "").toLowerCase().includes(q)
      );
    });
  }, [all, query, only]);

  const groups = useMemo<PluginGroup[]>(() => {
    const by = new Map<string, RuleEntry[]>();
    for (const r of matching) {
      const list = by.get(r.prefix) ?? [];
      list.push(r);
      by.set(r.prefix, list);
    }
    return [...by.entries()]
      .map(([prefix, rules]) => {
        const measured = rules.filter((r) => r.detection);
        return {
          prefix,
          rules: rules.sort((a, b) => a.rule.localeCompare(b.rule)),
          recommended: rules.filter((r) => r.recommended !== null).length,
          measured: measured.length,
          tp: measured.reduce((n, r) => n + (r.detection?.tp ?? 0), 0),
          fp: measured.reduce((n, r) => n + (r.detection?.fp ?? 0), 0),
          fn: measured.reduce((n, r) => n + (r.detection?.fn ?? 0), 0),
          clean: measured.filter((r) => r.detection!.fp === 0 && r.detection!.fn === 0).length,
        };
      })
      .sort((a, b) => b.rules.length - a.rules.length);
  }, [matching]);

  const t = data?.totals ?? null;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 pb-24">
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
        <h1 className="text-[28px] font-semibold tracking-tight">Rules</h1>
        <p className="max-w-[70ch] text-[14px] text-[var(--color-ink-2)]">
          Every plugin, every rule, and what its own fixture corpus measured:
          what it <strong>caught</strong>, what it <strong>wrongly reported</strong>,
          and what it <strong>missed</strong>. Expand a plugin for its rules, and
          a rule for the fixtures it got wrong and how competitors scored on the
          same ones.
        </p>
      </header>

      {data?.error ? (
        <p className="rounded border border-[var(--color-warn)] px-3 py-2 font-mono text-[12px] text-[var(--color-warn)]">
          {data.error}
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([
          ["rules", t?.rules],
          ["recommended", t?.recommended],
          ["measured", t?.withDetection],
          ["clean sweep", t?.perfectDetection],
          ["sealed", t?.sealed],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded border border-[var(--color-line)] px-3 py-2">
            <div className="font-mono text-[20px] tabular-nums">{num(value)}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
              {label}
            </div>
          </div>
        ))}
      </section>

      <p className="max-w-[70ch] text-[13px] text-[var(--color-ink-3)]">
        <strong className="text-[var(--color-ink-2)]">
          {num(t?.withDetection)} of {num(t?.rules)} rules have been measured at all
        </strong>{" "}
        — the rest show &ldquo;—&rdquo; rather than a score, because nobody has
        built them a corpus yet and a zero would imply somebody had.{" "}
        <strong className="text-[var(--color-ink-2)]">Sealed is {num(t?.sealed)}</strong>
        : {num(t?.withSealRecord)} rules carry a record and none has met all twelve axes.
      </p>

      <section className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="rule-search">
          Search rules
        </label>
        <input
          id="rule-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search id, description, CWE…"
          className="min-w-[220px] flex-1 rounded border border-[var(--color-line)] bg-transparent px-3 py-2 font-mono text-[12px]"
        />
        {(["all", "recommended", "measured", "imperfect"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={only === k}
            onClick={() => setOnly(k)}
            className={`rounded border px-2 py-2 font-mono text-[11px] uppercase tracking-wider ${
              only === k
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-[var(--color-line)] text-[var(--color-ink-3)]"
            }`}
          >
            {k}
          </button>
        ))}
        <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
          {groups.length} plugins · {matching.length} rules
        </span>
      </section>

      <section className="flex flex-col gap-2">
        {groups.map((g) => {
          const open = openPlugin === g.prefix;
          return (
            <div key={g.prefix} className="rounded border border-[var(--color-line)]">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenPlugin(open ? null : g.prefix)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-3 py-3 text-left hover:bg-[var(--color-line)]/20"
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
                    {open ? "▾" : "▸"}
                  </span>
                  <span className="font-mono text-[14px]">{g.prefix}</span>
                  <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
                    {g.rules.length} rules · {g.recommended} recommended
                  </span>
                </span>
                <span className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-[var(--color-ink-3)]">
                    measured{" "}
                    <span className="tabular-nums text-[var(--color-ink-2)]">
                      {g.measured}/{g.rules.length}
                    </span>
                  </span>
                  {g.measured > 0 ? (
                    <>
                      <span className="text-[var(--color-good)]">caught {g.tp}</span>
                      <span className={g.fp ? "text-[var(--color-warn)]" : "text-[var(--color-ink-3)]"}>
                        false pos {g.fp}
                      </span>
                      <span className={g.fn ? "text-[var(--color-warn)]" : "text-[var(--color-ink-3)]"}>
                        missed {g.fn}
                      </span>
                    </>
                  ) : (
                    <span className="text-[var(--color-ink-3)]">no corpus</span>
                  )}
                </span>
              </button>

              {open ? (
                <div className="flex flex-col divide-y divide-[var(--color-line)] border-t border-[var(--color-line)]">
                  {g.rules.map((r) => {
                    const d = r.detection;
                    const ruleOpen = openRule === r.id;
                    return (
                      <div key={r.id} className="px-3 py-2">
                        <button
                          type="button"
                          aria-expanded={ruleOpen}
                          onClick={() => setOpenRule(ruleOpen ? null : r.id)}
                          className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                        >
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[12px]">{r.rule}</span>
                            {r.recommended ? (
                              <span
                                className={`rounded border px-1 py-0.5 font-mono text-[9px] uppercase ${
                                  r.recommended === "error"
                                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                                    : "border-[var(--color-warn)] text-[var(--color-warn)]"
                                }`}
                              >
                                {r.recommended}
                              </span>
                            ) : null}
                            {r.cwe ? (
                              <span className="font-mono text-[10px] text-[var(--color-ink-3)]">
                                {r.cwe}
                              </span>
                            ) : null}
                          </span>
                          <span className="flex items-center gap-3 font-mono text-[11px] tabular-nums">
                            {d ? (
                              <>
                                <span className="text-[var(--color-good)]">{d.tp} tp</span>
                                <span className={d.fp ? "text-[var(--color-warn)]" : "text-[var(--color-ink-3)]"}>
                                  {d.fp} fp
                                </span>
                                <span className={d.fn ? "text-[var(--color-warn)]" : "text-[var(--color-ink-3)]"}>
                                  {d.fn} fn
                                </span>
                                <span className="text-[var(--color-ink-3)]">F1 {pct(d.f1)}</span>
                              </>
                            ) : (
                              <span className="text-[var(--color-ink-3)]">not measured</span>
                            )}
                          </span>
                        </button>

                        {ruleOpen ? (
                          <div className="mt-2 flex flex-col gap-2 border-l border-[var(--color-line)] pl-3">
                            <p className="max-w-[80ch] text-[13px] text-[var(--color-ink-2)]">
                              {r.description ?? "no description in meta.docs"}
                            </p>

                            <div className="flex flex-wrap gap-4 font-mono text-[11px] text-[var(--color-ink-3)]">
                              <span>
                                corpus findings{" "}
                                <span className="tabular-nums text-[var(--color-ink-2)]">
                                  {num(r.corpusFindings)}
                                </span>
                              </span>
                              <span>
                                seal{" "}
                                <span className="text-[var(--color-ink-2)]">
                                  {r.seal ? `${r.seal.axesMet}/${r.seal.axesTotal}` : "—"}
                                </span>
                              </span>
                              {d ? (
                                <span>
                                  fixtures{" "}
                                  <span className="tabular-nums text-[var(--color-ink-2)]">
                                    {num(d.fixtures)}
                                  </span>{" "}
                                  ({num(d.vulnerable)} vulnerable)
                                </span>
                              ) : null}
                              {safeHttpUrl(r.docsUrl) ? (
                                <a
                                  href={safeHttpUrl(r.docsUrl)!}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--color-accent)]"
                                >
                                  docs →
                                </a>
                              ) : null}
                            </div>

                            {d && d.missed.length > 0 ? (
                              <div className="font-mono text-[11px]">
                                <span className="text-[var(--color-warn)]">missed ({d.missed.length}):</span>{" "}
                                <span className="text-[var(--color-ink-2)]">
                                  {d.missed.slice(0, 6).join(", ")}
                                  {d.missed.length > 6 ? ` +${d.missed.length - 6}` : ""}
                                </span>
                              </div>
                            ) : null}

                            {d && d.falsePositives.length > 0 ? (
                              <div className="font-mono text-[11px]">
                                <span className="text-[var(--color-warn)]">
                                  false positives ({d.falsePositives.length}):
                                </span>{" "}
                                <span className="text-[var(--color-ink-2)]">
                                  {d.falsePositives.slice(0, 6).join(", ")}
                                  {d.falsePositives.length > 6
                                    ? ` +${d.falsePositives.length - 6}`
                                    : ""}
                                </span>
                              </div>
                            ) : null}

                            {d && d.competitors.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-3)]">
                                  same fixtures, other plugins
                                </span>
                                {d.competitors.map((c) => (
                                  <div
                                    key={c.name}
                                    className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]"
                                  >
                                    <span className="text-[var(--color-ink-2)]">{c.name}</span>
                                    <span className="flex gap-3 tabular-nums text-[var(--color-ink-3)]">
                                      <span>{c.tp} tp</span>
                                      <span>{c.fp} fp</span>
                                      <span>{c.fn} fn</span>
                                      <span>F1 {pct(c.f1)}</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            {r.budgetReason ? (
                              <details>
                                <summary className="cursor-pointer font-mono text-[11px] text-[var(--color-ink-3)] hover:text-[var(--color-accent)]">
                                  why its corpus findings are allowed
                                </summary>
                                <p className="mt-1 max-w-[80ch] whitespace-pre-wrap text-[12px] text-[var(--color-ink-2)]">
                                  {r.budgetReason}
                                </p>
                              </details>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
        {groups.length === 0 ? (
          <p className="py-6 font-mono text-[12px] text-[var(--color-ink-3)]">nothing matches</p>
        ) : null}
      </section>
    </main>
  );
}
