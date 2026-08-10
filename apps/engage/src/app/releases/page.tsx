"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cachedFetch } from "@/lib/client-cache";

const TONE: Record<string, string> = {
  feat: "text-[var(--color-good)] border-[var(--color-good)]",
  fix: "text-[var(--color-accent)] border-[var(--color-accent)]",
  chore: "text-[var(--color-ink-3)] border-[var(--color-line)]",
  docs: "text-[var(--color-ink-3)] border-[var(--color-line)]",
  refactor: "text-[var(--color-warn)] border-[var(--color-warn)]",
};

export default function Releases() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    cachedFetch("releases", "/api/releases")
      .then(setData)
      .catch(() => setData({ releases: [], error: "unreachable" }));
  }, []);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-5 py-10 pb-24">
      <header className="flex flex-col gap-1">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
        >
          ← control room
        </Link>
        <h1 className="text-[28px] font-semibold tracking-tight">Releases</h1>
        <p className="max-w-[62ch] text-[14px] text-[var(--color-ink-2)]">
          Generated from git, never written by hand — a hand-kept changelog
          drifts from what shipped and quietly becomes fiction. These dates are
          also what the correlation engine reads as candidate causes when a
          metric moves.
        </p>
      </header>

      {!data ? (
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton mb-2 h-8 w-full" />
          ))}
        </div>
      ) : data.error ? (
        <p className="text-[13px] text-[var(--color-warn)]">{data.error}</p>
      ) : !data.releases?.length ? (
        <p className="text-[14px] text-[var(--color-ink-2)]">
          No commits in the last 60 days for this app. Nothing here is committed
          yet — that is itself the first thing to fix.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {data.releases.map((r: any) => (
            <section key={r.date} className="flex flex-col gap-2">
              <h2 className="flex items-baseline gap-3 border-b border-[var(--color-line)] pb-1.5">
                <span className="font-mono text-[13px]">{r.date}</span>
                <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
                  {r.count} change{r.count === 1 ? "" : "s"}
                </span>
              </h2>
              <ul className="flex flex-col gap-1.5">
                {r.items.map((c: any) => (
                  <li
                    key={c.sha}
                    className="flex flex-wrap items-baseline gap-2 text-[13.5px]"
                  >
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                        TONE[c.type] ?? TONE.chore
                      }`}
                    >
                      {c.type}
                    </span>
                    {c.scope && (
                      <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
                        {c.scope}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">{c.subject}</span>
                    <span className="font-mono text-[10px] text-[var(--color-ink-3)]">
                      {c.sha}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
