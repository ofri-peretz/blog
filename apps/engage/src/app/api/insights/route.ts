import { NextResponse } from "next/server";
import { allItems, devtoKey, replyDrafts } from "@/lib/footprint";
import { snapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

const ME = "ofri-peretz";

async function dev(path: string, key?: string) {
  const r = await fetch(`https://dev.to/api${path}`, {
    headers: key ? { "api-key": key } : {},
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function GET() {
  const key = devtoKey();

  // Metrics come from the platform, never from our own tallies — a local count
  // drifts the moment anything is published or reacted to outside this app.
  let metrics: Record<string, number | null> = {
    followers: null,
    articles: null,
    reactions: null,
    comments: null,
    views: null,
  };
  let metricsError: string | null = null;
  try {
    const [profile, arts] = await Promise.all([
      dev(`/users/by_username?url=${ME}`),
      key ? dev(`/articles/me/published?per_page=100`, key) : Promise.resolve([]),
    ]);
    const list = Array.isArray(arts) ? arts : [];
    metrics = {
      followers: null, // the public profile does not expose it; filled below
      articles: list.length || null,
      reactions: list.reduce(
        (s: number, a: any) => s + (a.public_reactions_count ?? 0),
        0,
      ),
      comments: list.reduce((s: number, a: any) => s + (a.comments_count ?? 0), 0),
      views: list.reduce((s: number, a: any) => s + (a.page_views_count ?? 0), 0),
    };
    void profile;
    if (key) {
      // Paginate. A single per_page=1000 call returns exactly 1000 and looks
      // like a total — it silently under-reported 1563 followers as 1000, which
      // is worse than showing nothing because it is plausible.
      let total = 0;
      for (let page = 1; page <= 20; page++) {
        const batch = await dev(
          `/followers/users?per_page=1000&page=${page}`,
          key,
        );
        if (!Array.isArray(batch) || batch.length === 0) break;
        total += batch.length;
        if (batch.length < 1000) break;
      }
      metrics.followers = total || null;
    }
  } catch (e) {
    metricsError = e instanceof Error ? e.message : String(e);
  }

  // Partnerships from our own engagement history.
  const byAuthor = new Map<string, any>();
  for (const it of allItems()) {
    const a = it.article.author;
    const e = byAuthor.get(a) ?? {
      author: a,
      drafted: 0,
      sent: 0,
      tags: new Map<string, number>(),
      last: "",
    };
    e.drafted++;
    if (it.status === "posted") e.sent++;
    for (const t of it.article.tags ?? [])
      e.tags.set(t, (e.tags.get(t) ?? 0) + 1);
    if (it.date > e.last) e.last = it.date;
    byAuthor.set(a, e);
  }

  /**
   * Who answered back.
   *
   * The ranking above measures what WE did — drafted, sent — which cannot
   * distinguish shouting into a void from a conversation. Someone replying to
   * your comment is the only unforced signal in the whole table, so it gets its
   * own column and it breaks ties: two authors at the same volume are not the
   * same relationship if one of them talks back.
   */
  const replies = replyDrafts();
  const repliedBy = new Map<string, { got: number; answered: number }>();
  for (const r of replies) {
    const e = repliedBy.get(r.author) ?? { got: 0, answered: 0 };
    e.got++;
    if (r.status === "sent") e.answered++;
    repliedBy.set(r.author, e);
    // An author who has only ever replied to us has no queue row, so without
    // this they would be missing from the partnership table entirely — exactly
    // backwards, since they are the warmest contact in it.
    if (!byAuthor.has(r.author))
      byAuthor.set(r.author, {
        author: r.author,
        drafted: 0,
        sent: 0,
        tags: new Map<string, number>(),
        last: String(r.at).slice(0, 10),
      });
  }

  const authors = [...byAuthor.values()]
    .map((e) => ({
      author: e.author,
      drafted: e.drafted,
      sent: e.sent,
      repliedToUs: repliedBy.get(e.author)?.got ?? 0,
      weAnswered: repliedBy.get(e.author)?.answered ?? 0,
      conversion: e.drafted ? Math.round((100 * e.sent) / e.drafted) : 0,
      tags: [...e.tags.entries()]
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 4)
        .map(([t]: any) => t),
      last: e.last,
    }))
    // Two-way first: a reply outranks any amount of one-way volume.
    .sort(
      (a, b) =>
        b.repliedToUs - a.repliedToUs ||
        b.drafted - a.drafted ||
        b.sent - a.sent,
    );

  // One row per day, so tomorrow there is something to plot against. Without
  // this every metric is a point-in-time read and no chart can ever exist.
  if (!metricsError) {
    try {
      snapshot(metrics);
    } catch {
      /* a read-only view must not fail because history could not be written */
    }
  }

  // Live reads: the source time IS now. Printed so the header can say so.
  return NextResponse.json({ metrics, metricsError, authors, asOf: new Date().toISOString() });
}
