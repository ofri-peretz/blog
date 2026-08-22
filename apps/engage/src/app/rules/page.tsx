"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCachedSection } from "@/lib/client-cache";
import { Refresh } from "@/components/panels";
import type { RuleEntry } from "@/lib/sources";

type Payload = {
  generatedAt: string | null;
  totals: Record<string, number> | null;
  rules: RuleEntry[];
  error: string | null;
};

/**
 * A missing measurement renders as an em dash, never as zero.
 *
 * `corpusFindings: null` and `seal: null` mean different things — "allowed
 * none" and "nobody has looked" — and both would read as 0 if formatted
 * naively. That is the failure this section exists to avoid: a number that
 * looks like an answer when nothing measured it.
 */
function num(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

const SEVERITY_TONE: Record<string, string> = {
  error: "text-[var(--color-accent)] border-[var(--color-accent)]",
  warn: "text-[var(--color-warn)] border-[var(--color-warn)]",
};

export default function Rules() {
  const { data, at, busy, refresh } = useCachedSection<Payload>(
    "rules",
    "/api/rules",
    () => ({ generatedAt: null, totals: null, rules: [], error: "unreachable" }),
  );

  const [query, setQuery] = useState("");
  const [plugin, setPlugin] = useState("all");
  const [only, setOnly] = useState<"all" | "recommended" | "firing" | "record">("all");

  const all = useMemo(() => data?.rules ?? [], [data]);

  const plugins = useMemo(
    () => [...new Set(all.map((r) => r.prefix))].sort((a, b) => a.localeCompare(b)),
    [all],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (plugin !== "all" && r.prefix !== plugin) return false;
      if (only === "recommended" && r.recommended === null) return false;
      if (only === "firing" && !(r.corpusFindings ?? 0)) return false;
      if (only === "record" && !r.seal) return false;
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.cwe ?? "").toLowerCase().includes(q)
      );
    });
  }, [all, query, plugin, only]);

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
        <p className="max-w-[68ch] text-[14px] text-[var(--color-ink-2)]">
          Every rule the ecosystem ships, read from each plugin&rsquo;s built
          export map rather than from a doc file — so it cannot drift from the
          code. Beside each one is what the instruments that measure real source
          actually found: how often it fires across the eight pinned
          repositories, and how many of the twelve seal axes it has met.
        </p>
      </header>

      {data?.error ? (
        <p className="rounded border border-[var(--color-warn)] px-3 py-2 font-mono text-[12px] text-[var(--color-warn)]">
          {data.error}
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ["rules", t?.rules],
          ["recommended", t?.recommended],
          ["firing on corpus", t?.firingOnCorpus],
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

      <p className="max-w-[68ch] text-[13px] text-[var(--color-ink-3)]">
        <strong className="text-[var(--color-ink-2)]">
          Sealed is zero, and that is the honest number.
        </strong>{" "}
        {num(t?.withSealRecord)} rules carry a seal record and none has met all
        twelve axes. A rule with no record shows &ldquo;—&rdquo; rather than
        0/12, because nobody has looked at it yet and a zero would imply
        somebody had.
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
        <label className="sr-only" htmlFor="rule-plugin">
          Filter by plugin
        </label>
        <select
          id="rule-plugin"
          value={plugin}
          onChange={(e) => setPlugin(e.target.value)}
          className="rounded border border-[var(--color-line)] bg-transparent px-2 py-2 font-mono text-[12px]"
        >
          <option value="all">all plugins</option>
          {plugins.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {(["all", "recommended", "firing", "record"] as const).map((k) => (
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
          {shown.length} shown
        </span>
      </section>

      <section className="flex flex-col divide-y divide-[var(--color-line)]">
        {shown.map((r) => (
          <article key={r.id} className="flex flex-col gap-1 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {r.docsUrl ? (
                <a
                  href={r.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[13px] hover:text-[var(--color-accent)]"
                >
                  {r.id}
                </a>
              ) : (
                <span className="font-mono text-[13px]">{r.id}</span>
              )}
              {r.recommended ? (
                <span
                  className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${SEVERITY_TONE[r.recommended]}`}
                >
                  {r.recommended}
                </span>
              ) : null}
              {r.cwe ? (
                <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-ink-3)]">
                  {r.cwe}
                  {r.cvss !== null ? ` · ${r.cvss}` : ""}
                </span>
              ) : null}
              {r.fixable ? (
                <span className="font-mono text-[10px] text-[var(--color-good)]">fixable</span>
              ) : null}
              {r.deprecated ? (
                <span className="font-mono text-[10px] text-[var(--color-warn)]">deprecated</span>
              ) : null}
            </div>

            <p className="max-w-[80ch] text-[13px] text-[var(--color-ink-2)]">
              {r.description ?? "no description in meta.docs"}
            </p>

            <div className="flex flex-wrap gap-4 font-mono text-[11px] text-[var(--color-ink-3)]">
              <span>
                corpus{" "}
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
              {r.seal?.knownGaps ? (
                <span>
                  gaps{" "}
                  <span className="tabular-nums text-[var(--color-ink-2)]">
                    {r.seal.knownGaps}
                  </span>
                </span>
              ) : null}
            </div>

            {r.budgetReason ? (
              <details className="mt-1">
                <summary className="cursor-pointer font-mono text-[11px] text-[var(--color-ink-3)] hover:text-[var(--color-accent)]">
                  why these findings are allowed
                </summary>
                <p className="mt-1 max-w-[80ch] whitespace-pre-wrap text-[12px] text-[var(--color-ink-2)]">
                  {r.budgetReason}
                </p>
              </details>
            ) : null}
          </article>
        ))}
        {shown.length === 0 ? (
          <p className="py-6 font-mono text-[12px] text-[var(--color-ink-3)]">nothing matches</p>
        ) : null}
      </section>
    </main>
  );
}
