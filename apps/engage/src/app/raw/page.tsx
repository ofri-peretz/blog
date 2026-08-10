"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

/**
 * Raw data explorer.
 *
 * Every panel in the control room is an opinion about data — a classification, a
 * median, a chosen denominator. Those opinions have been wrong here more than
 * once (invented Supabase view names, guessed column names, a daily figure that
 * meant three different things). So every derived number needs a path back to
 * the bytes it came from, in one click, without a terminal.
 *
 * Deliberately dumb: fetch, pretty-print, filter, copy. No schema, no rendering
 * rules — the moment this starts interpreting, it becomes another opinion.
 */
const ENDPOINTS: { path: string; label: string; note: string }[] = [
  { path: "/api/state", label: "state", note: "engagement stream + release queue" },
  { path: "/api/insights", label: "insights", note: "platform metrics + partnerships" },
  { path: "/api/history", label: "history", note: "the daily series behind every chart" },
  { path: "/api/network", label: "network", note: "DEV comment graph (12h disk cache)" },
  { path: "/api/person?u=sylwia-lask", label: "person", note: "one author, cadence + actions" },
  { path: "/api/threads", label: "threads", note: "pre-drafted replies" },
  { path: "/api/sources", label: "sources", note: "impact + promotion + findings" },
  { path: "/api/plugins", label: "plugins", note: "per-plugin downloads + coverage" },
  { path: "/api/ecosystem", label: "ecosystem", note: "npm + coverage totals" },
  { path: "/api/board", label: "board", note: "PRs classified by who is blocked" },
  { path: "/api/people", label: "people", note: "founders + Google AI activity" },
  { path: "/api/articles", label: "articles", note: "the article graph" },
  { path: "/api/releases", label: "releases", note: "control-room changes from git" },
];

export default function Raw() {
  const [sel, setSel] = useState(ENDPOINTS[0].path);
  const [data, setData] = useState<unknown>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (path: string) => {
    setBusy(true);
    setErr(null);
    setData(null);
    const t0 = performance.now();
    try {
      const r = await fetch(`${path}${path.includes("?") ? "&" : "?"}_=${Date.now()}`, {
        cache: "no-store",
      });
      setData(await r.json());
      setMs(Math.round(performance.now() - t0));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load(sel);
  }, [sel, load]);

  const text = useMemo(() => (data ? JSON.stringify(data, null, 2) : ""), [data]);

  // Filter by line so a match keeps its surrounding context legible, rather than
  // collapsing the document into disconnected fragments.
  const shown = useMemo(() => {
    if (!q.trim()) return text;
    const needle = q.toLowerCase();
    return text
      .split("\n")
      .filter((l) => l.toLowerCase().includes(needle))
      .join("\n");
  }, [text, q]);

  const bytes = new Blob([text]).size;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 pb-24">
      <header className="flex flex-col gap-1">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
        >
          ← control room
        </Link>
        <h1 className="text-[28px] font-semibold tracking-tight">Raw data</h1>
        <p className="max-w-[68ch] text-[14px] text-[var(--color-ink-2)]">
          Every panel is an opinion about data — a median, a denominator, a
          classification. Those have been wrong here before. This is the path back
          to the bytes.
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {ENDPOINTS.map((e) => (
          <button
            key={e.path}
            onClick={() => setSel(e.path)}
            title={e.note}
            className={`rounded-md border px-2.5 py-1 font-mono text-[11px] ${
              sel === e.path
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                : "border-[var(--color-line)] text-[var(--color-ink-2)] hover:border-[var(--color-accent)]"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter lines…"
          className="min-w-[220px] flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-ground)] px-3 py-2 font-mono text-[12.5px]"
        />
        <button
          onClick={() => load(sel)}
          disabled={busy}
          className="rounded-lg border border-[var(--color-line)] px-3 py-2 font-mono text-[11px] disabled:opacity-40"
        >
          {busy ? "…" : "↻ refetch"}
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(text)}
          className="rounded-lg border border-[var(--color-line)] px-3 py-2 font-mono text-[11px]"
        >
          copy
        </button>
        <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
          {ms != null && `${ms}ms · `}
          {(bytes / 1024).toFixed(1)}kb
          {q && ` · ${shown.split("\n").length} matching lines`}
        </span>
      </div>

      {err ? (
        <p className="text-[13px] text-[var(--color-warn)]">{err}</p>
      ) : busy ? (
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="skeleton mb-2 h-4 w-full" />
          ))}
        </div>
      ) : (
        <pre className="max-h-[70vh] overflow-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4 font-mono text-[12px] leading-relaxed">
          {shown || "(no matching lines)"}
        </pre>
      )}
    </main>
  );
}
