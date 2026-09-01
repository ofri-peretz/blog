/**
 * People worth tracking closely: Forem's founders/staff, and the Google AI
 * cohort running the Gemini challenges.
 *
 * WHY THEY MATTER MECHANICALLY, not as celebrity-watching:
 *   - Top 7 is editorial. A founder/staff account signal-boosting a piece is the
 *     path into it, and Top 7 is the ONLY thing that raises reputation_modifier
 *     (recipient x2.0, positive reactors x1.5, cap 4.0) — which multiplies reach
 *     on every later article.
 *   - Reacting to a soon-to-be-Top-7 author's article inside a 7-day window is
 *     what banks that x1.5. So knowing what these accounts published THIS WEEK is
 *     the actionable part, not their follower count.
 *
 * Membership is asserted from public, checkable facts (Forem staff, challenge
 * hosts), never inferred from a username — the same rule the partnership scoring
 * follows. `verified: false` means "candidate, confirm before acting".
 */
import "server-only";
import { devtoKey } from "./footprint";
import { fetchJson } from "./throttle";

export type Cohort = "forem" | "googleai";

export interface Person {
  username: string;
  cohort: Cohort;
  note: string;
  verified: boolean;
}

/**
 * Forem founders + staff. Ben Halpern, Jess Lee and Peter Kim Frank are the
 * documented co-founders; the rest are public community/editorial staff whose
 * accounts drive Top 7 and the weekly digests.
 */
export const PEOPLE: Person[] = [
  { username: "ben", cohort: "forem", note: "co-founder, DEV/Forem", verified: true },
  { username: "jess", cohort: "forem", note: "co-founder", verified: true },
  { username: "peter", cohort: "forem", note: "co-founder", verified: true },
  { username: "michaeltharrington", cohort: "forem", note: "community/editorial", verified: true },
  { username: "erikawhitney", cohort: "forem", note: "community", verified: false },
  { username: "graciegregory", cohort: "forem", note: "editorial", verified: false },
  { username: "thepracticaldev", cohort: "forem", note: "org account — Top 7 is posted here", verified: true },
  // Google AI / Gemini challenge surface. The tag is the reliable signal; the
  // accounts below are candidates until confirmed against a challenge post.
  { username: "googleai", cohort: "googleai", note: "org account", verified: false },
  { username: "google", cohort: "googleai", note: "org account", verified: false },
  // Named from their own public DEV bios in the googleai org — asserted, not
  // inferred. These are the decision-makers for the partnership surface.
  { username: "vivjair", cohort: "googleai", note: "leads the Google AI x DEV partnership", verified: true },
  { username: "logankilpatrick", cohort: "googleai", note: "lead product, AI Studio + Gemini API", verified: true },
  { username: "dave_elliott", cohort: "googleai", note: "leads Developer Engineering & Evangelism for AI", verified: true },
  { username: "asadr_khan", cohort: "googleai", note: "Senior Director of Product Management", verified: true },
];

/** Tags that reliably identify the Google AI programme surface. */
export const GOOGLE_AI_TAGS = ["googleai", "geminichallenge", "googlecloud"];

/**
 * Rank a Google AI member by what their public bio says they do.
 *
 * The bio is self-written and public — an asserted fact, not an inference from
 * a username, which is the same standard the rest of this module holds to.
 *
 * Seniority matters here for one mechanical reason: the people who decide
 * whether a partnership, a challenge feature or a signal boost happens are
 * leads and DevRel, not every engineer in the org. A flat list of 93 names is
 * not actionable; a ranked one is.
 */
export function roleRank(summary: string): { role: string; rank: number } {
  const s = (summary || "").toLowerCase();
  if (/\blead(s|ing)?\b.*\bpartnership|partnership.*\blead/.test(s))
    return { role: "partnership lead", rank: 0 };
  if (/\bdirector\b/.test(s)) return { role: "director", rank: 1 };
  if (/\blead\b|\bhead of\b/.test(s)) return { role: "lead", rank: 2 };
  if (/developer relations|devrel|devx|advocate|evangel/.test(s))
    return { role: "devrel", rank: 3 };
  if (/product manager|\bpm\b|product lead/.test(s))
    return { role: "product", rank: 4 };
  if (/engineer|developer|software/.test(s)) return { role: "engineer", rank: 5 };
  return { role: summary ? "member" : "unknown", rank: 6 };
}

export interface OrgMember {
  username: string;
  name: string;
  summary: string;
  role: string;
  rank: number;
}

/**
 * The Google AI roster, fetched live from the DEV organisation.
 *
 * Deliberately NOT a hardcoded list. Google rotates people through this
 * programme, and a checked-in array of 93 usernames is wrong the first time
 * someone joins — silently, because a missing name looks identical to a name
 * that simply did not post. The org endpoint is the source of truth DEV itself
 * uses to render the org page.
 *
 * Pages until short, capped at 5 — an unbounded loop against a public API is
 * how a page view turns into a crawl.
 */
export async function googleAiRoster(): Promise<OrgMember[]> {
  const out: OrgMember[] = [];
  for (let page = 1; page <= 5; page++) {
    let batch: any[] = [];
    try {
      // Public endpoint — no key needed, and fetchJson's second arg is a
      // RequestInit, not a token.
      batch = await fetchJson(
        `https://dev.to/api/organizations/googleai/users?per_page=50&page=${page}`,
      );
    } catch {
      break;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const u of batch) {
      const { role, rank } = roleRank(u.summary ?? "");
      out.push({
        username: u.username,
        name: u.name ?? u.username,
        summary: u.summary ?? "",
        role,
        rank,
      });
    }
    if (batch.length < 50) break;
  }
  return out.sort((a, b) => a.rank - b.rank || a.username.localeCompare(b.username));
}

export interface Activity {
  username: string;
  cohort: Cohort;
  note: string;
  verified: boolean;
  found: boolean;
  latest: {
    title: string;
    url: string;
    published_at: string;
    reactions: number;
    comments: number;
    ageDays: number;
    /** Inside the 7-day window where a reaction can still bank the x1.5. */
    reactable: boolean;
  } | null;
}

async function dev(path: string) {
  const key = devtoKey();
  return fetchJson(`https://dev.to/api${path}`, {
    headers: key ? { "api-key": key } : {},
  });
}

export async function peopleActivity(): Promise<{
  people: Activity[];
  error: string | null;
}> {
  const out: Activity[] = [];
  for (const p of PEOPLE) {
    let latest: Activity["latest"] = null;
    let found = false;
    try {
      const arts = await dev(
        `/articles?username=${encodeURIComponent(p.username)}&per_page=1`,
      );
      if (Array.isArray(arts) && arts.length) {
        found = true;
        const a = arts[0];
        const ageDays =
          (Date.now() - Date.parse(a.published_at)) / 86_400_000;
        latest = {
          title: a.title,
          url: a.url,
          published_at: a.published_at,
          reactions: a.public_reactions_count ?? 0,
          comments: a.comments_count ?? 0,
          ageDays: Math.floor(ageDays),
          reactable: ageDays <= 7,
        };
      }
    } catch {
      /* an unreachable account must not blank the whole section */
    }
    out.push({ ...p, found, latest });
  }
  return { people: out, error: null };
}

/**
 * Fresh Google-AI-programme articles — the actual reaction targets. Sorted so
 * the ones still inside the 7-day banking window come first.
 */
export async function googleAiFeed(): Promise<{
  articles: any[];
  error: string | null;
}> {
  try {
    const seen = new Map<number, any>();
    for (const tag of GOOGLE_AI_TAGS) {
      const arts = await dev(`/articles?tag=${tag}&per_page=20`);
      if (!Array.isArray(arts)) continue;
      for (const a of arts) if (!seen.has(a.id)) seen.set(a.id, a);
    }
    const articles = [...seen.values()]
      .map((a) => {
        const ageDays = (Date.now() - Date.parse(a.published_at)) / 86_400_000;
        return {
          id: a.id,
          title: a.title,
          url: a.url,
          author: a.user?.username,
          tags: a.tag_list ?? [],
          reactions: a.public_reactions_count ?? 0,
          comments: a.comments_count ?? 0,
          ageDays: Math.floor(ageDays),
          reactable: ageDays <= 7,
        };
      })
      .sort(
        (x, y) =>
          Number(y.reactable) - Number(x.reactable) || y.reactions - x.reactions,
      );
    return { articles, error: null };
  } catch (e) {
    return {
      articles: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
