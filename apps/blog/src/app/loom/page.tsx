// The Loom — weave your own view of the Interlace corpus.
//
// Server side of the composer: fetch the cached corpus, parse the
// permalink into an initial state, and SSR the exact weave the URL
// describes — a shared link renders its weave before any JS runs.
//
// force-dynamic for the same reason /npm is (see that file's header):
// the production build runs without Supabase credentials, so a static
// prerender would bake — and `revalidate` would then SERVE — an empty
// page. The corpus read itself stays cheap: getCachedLoomCorpus wraps
// Supabase in unstable_cache (12h, tag `ratchet`), so visitors hit the
// Vercel Data Cache, never the database.

import type { Metadata } from "next";

import { LoomComposer } from "@/components/loom/loom-composer";
import { getCachedLoomCorpus } from "@/lib/loom-corpus";
import { parseLoomState } from "@/lib/loom-url";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Bare page name — the root layout's title template appends the suffix.
  title: "The Loom",
  description:
    "Weave your own view of the Interlace corpus — npm downloads, GitHub activity, DEV.to engagement, and site traffic as threads you compose into charts. Every weave is a permalink; every number carries its provenance.",
  alternates: { canonical: "https://ofriperetz.dev/loom" },
  openGraph: {
    title: "The Loom — Ofri Peretz",
    description:
      "An interactive exhibition of the Interlace corpus: pick threads, pick a form, weave the data yourself. Every composed view is a shareable link.",
    url: "https://ofriperetz.dev/loom",
  },
};

export default async function LoomPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }

  let corpus;
  try {
    corpus = await getCachedLoomCorpus();
  } catch (err) {
    // Honest failure, /npm doctrine: say the history is unreachable —
    // never render an empty loom that reads as "there is no data".
    // force-dynamic means the next request simply retries.
    console.error("[loom]", err);
    return (
      <main
        data-page="loom"
        className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:py-16"
      >
        <h1 className="text-4xl font-semibold tracking-tight">The Loom</h1>
        <p role="alert" className="max-w-2xl text-muted-foreground">
          The corpus is unreachable right now — the threads exist, this
          page just could not fetch them. Reload in a moment.
        </p>
      </main>
    );
  }

  const initialState = parseLoomState(
    params,
    new Set(corpus.series.map((s) => s.id)),
  );

  return (
    <main
      data-page="loom"
      className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 sm:py-16"
    >
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Interactive
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">The Loom</h1>
        <p className="max-w-2xl text-muted-foreground">
          Everything I ship and everything the world sends back, as
          threads you can weave yourself: npm downloads, GitHub activity,
          DEV.to engagement, site traffic. Pick threads, pick a form —
          the address bar becomes a permalink to your weave, and every
          number names the source it was ingested from.
        </p>
      </header>

      <LoomComposer corpus={corpus} initialState={initialState} />
    </main>
  );
}
