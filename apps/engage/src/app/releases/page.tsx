"use client";

import Link from "next/link";
import { useCachedSection } from "@/lib/client-cache";
import { Refresh } from "@/components/panels";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { Skeleton } from "@/components/ui/skeleton";

const TONE: Record<string, string> = {
  feat: "text-[var(--success)] border-[var(--success)]",
  fix: "text-[var(--primary)] border-[var(--primary)]",
  chore: "text-[var(--muted-foreground)] border-[var(--border)]",
  docs: "text-[var(--muted-foreground)] border-[var(--border)]",
  refactor: "text-[var(--warning)] border-[var(--warning)]",
};

export default function Releases() {
  const { data: data, at, busy, refresh } = useCachedSection<any>(
    "releases",
    "/api/releases",
    () => ({ releases: [], error: "unreachable" }),
  );

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-5 py-10 pb-24">
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
        <h1 className="text-[28px] font-semibold tracking-tight">Releases</h1>
        <p className="max-w-[62ch] text-[14px] text-[var(--muted-foreground)]">
          Generated from git, never written by hand — a hand-kept changelog
          drifts from what shipped and quietly becomes fiction. These dates are
          also what the correlation engine reads as candidate causes when a
          metric moves.
        </p>
      </header>

      {!data ? (
        <Skeleton count={5} className="h-8 w-full" label="Loading releases" />
      ) : data.error ? (
        <Callout tone="danger" title="Releases unavailable">
          {data.error}
        </Callout>
      ) : !data.releases?.length ? (
        <Callout tone="note" title="No commits in the last 60 days">
          Nothing here is committed yet — that is itself the first thing to fix.
        </Callout>
      ) : (
        <div className="flex flex-col gap-6">
          {data.releases.map((r: any) => (
            <section key={r.date} className="flex flex-col gap-2">
              <h2 className="flex items-baseline gap-3 border-b border-[var(--border)] pb-1.5">
                <span className="font-mono text-[13px]">{r.date}</span>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  {r.count} change{r.count === 1 ? "" : "s"}
                </span>
              </h2>
              <ul className="flex flex-col gap-1.5">
                {r.items.map((c: any) => (
                  <li
                    key={c.sha}
                    className="flex flex-wrap items-baseline gap-2 text-[13.5px]"
                  >
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] uppercase ${
                        TONE[c.type] ?? TONE.chore
                      }`}
                    >
                      {c.type}
                    </Badge>
                    {c.scope && (
                      <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                        {c.scope}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">{c.subject}</span>
                    <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
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
