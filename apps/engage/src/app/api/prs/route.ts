import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

/**
 * Live state of every PR we have open on someone else's repository.
 *
 * Deliberately not cached in customers.json. A PR's state is the one thing on
 * this page that changes without us doing anything — a maintainer replies, a
 * check goes red, a review lands — and a stored copy of it is wrong from the
 * moment it is written. Hitting refresh re-asks GitHub.
 *
 * The question it exists to answer is "whose move is it", because that is the
 * only part of a pipeline you can actually act on.
 */

const FILE = join(FOOTPRINT, "adoption", "customers.json");
const STALE_DAYS = 21;

const gh = async <T>(args: string[], fallback: T): Promise<T> => {
  try {
    const { stdout } = await execFileAsync("gh", args, { maxBuffer: 32e6 });
    return JSON.parse(stdout) as T;
  } catch {
    return fallback;
  }
};

const daysSince = (iso?: string | null) =>
  iso
    ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000))
    : null;

export async function GET() {
  // Our own login, so "who spoke last" is a fact rather than a hardcoded name.
  const me =
    (await gh<{ login?: string }>(["api", "user"], {})).login ?? "ofri-peretz";

  const found = await gh<any[]>(
    [
      "search",
      "prs",
      `--author=${me}`,
      "--state=open",
      "--limit=60",
      "--json",
      "url,title,repository,createdAt,updatedAt,number",
    ],
    [],
  );

  // Only outbound adoption work: our own repositories are not customers, and
  // day-job repositories are not part of this pipeline.
  const outbound = found.filter((p) => {
    const owner = p.repository?.nameWithOwner?.split("/")[0] ?? "";
    return owner !== "ofri-peretz" && owner !== "SnappyGifts";
  });

  const customers = existsSync(FILE)
    ? (() => {
        try {
          const d = JSON.parse(readFileSync(FILE, "utf8"));
          return new Map<string, any>(
            [...(d.customers ?? []), ...(d.candidates ?? [])].map((c: any) => [
              c.slug,
              c,
            ]),
          );
        } catch {
          return new Map<string, any>();
        }
      })()
    : new Map<string, any>();

  const prs = await Promise.all(
    outbound.map(async (p) => {
      const slug: string = p.repository.nameWithOwner;
      const n: number = p.number;

      const [detail, issueComments, reviewComments, reviews] =
        await Promise.all([
          gh<any>(["api", `repos/${slug}/pulls/${n}`], {}),
          gh<any[]>(["api", `repos/${slug}/issues/${n}/comments`], []),
          gh<any[]>(["api", `repos/${slug}/pulls/${n}/comments`], []),
          gh<any[]>(["api", `repos/${slug}/pulls/${n}/reviews`], []),
        ]);

      const conversation = [...issueComments, ...reviewComments]
        .map((c) => ({
          who: c.user?.login ?? "?",
          // Not every bot is spelled `[bot]`. CLAassistant and dependabot-style
          // accounts comment as ordinary users, and counting one as a human
          // put a permanent false "our move" on any PR they watch.
          bot:
            Boolean(c.user?.login?.endsWith("[bot]")) ||
            /^(cla-?assistant|github-actions|codecov|sonarcloud|coderabbitai|vercel|netlify)$/i.test(
              c.user?.login ?? "",
            ),
          at: c.created_at,
          body: String(c.body ?? "").slice(0, 400),
        }))
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

      // Bots do not constitute a maintainer waiting on us, but a bot review
      // comment is still work we owe someone, so it counts as ours to answer.
      const human = conversation.filter((c) => !c.bot);
      const last = conversation.at(-1);
      const lastHuman = human.at(-1);

      /**
       * Why a finished PR cannot move.
       *
       * These are not review feedback and not CI failures — they are gates the
       * author has to clear personally, and neither the checks list nor the
       * comment thread says so in a way this page could show. Two of the first
       * six adoption PRs were parked on exactly these, invisibly.
       */
      const blockers: string[] = [];
      const allText = conversation.map((c) => c.body).join("\n");
      if (/cla-assistant\.io|contributor license agreement/i.test(allText)) {
        blockers.push("CLA not signed — needs a person, not a push");
      }
      if (
        /could not be fully verified|requires all commits to be signed/i.test(
          allText,
        )
      ) {
        blockers.push(
          "commits unsigned — repository requires signature verification",
        );
      }
      if (detail.mergeable_state === "dirty")
        blockers.push("conflicts with the base branch");

      const checks = detail.head?.sha
        ? await gh<any>(
            ["api", `repos/${slug}/commits/${detail.head.sha}/check-runs`],
            {},
          )
        : {};
      const runs: any[] = checks.check_runs ?? [];
      const failing = runs
        .filter(
          (r) =>
            r.conclusion &&
            !["success", "skipped", "neutral"].includes(r.conclusion),
        )
        .map((r) => `${r.name}: ${r.conclusion}`);
      const pending = runs.filter((r) => !r.conclusion).length;

      const idle = daysSince(p.updatedAt);

      /**
       * Whose move is decided on humans only.
       *
       * A review bot re-running its analysis after we reply is not a maintainer
       * waiting on us, and counting it as one puts a permanent false "our move"
       * on every PR a bot watches — which is the fastest way to make this column
       * worth ignoring. Unanswered bot review comments are still surfaced, just
       * not as the thing that decides the phase.
       */
      const theirs = Boolean(lastHuman && lastHuman.who === me);
      const ours = Boolean(lastHuman && lastHuman.who !== me);
      const lastBot = conversation.filter((c) => c.bot).at(-1);
      const botWaiting = Boolean(
        lastBot &&
        (!lastHuman || Date.parse(lastBot.at) > Date.parse(lastHuman.at)),
      );

      return {
        slug,
        number: n,
        title: p.title,
        url: p.url,
        openedAt: p.createdAt?.slice(0, 10),
        updatedAt: p.updatedAt?.slice(0, 10),
        idleDays: idle,
        merged: Boolean(detail.merged),
        mergeableState: detail.mergeable_state ?? null,
        draft: Boolean(detail.draft),
        additions: detail.additions ?? null,
        deletions: detail.deletions ?? null,
        comments: conversation.length,
        humanComments: human.length,
        reviewStates: reviews.map((r) => r.state).filter(Boolean),
        blockers,
        approved: reviews.some((r) => r.state === "APPROVED"),
        changesRequested: reviews.some((r) => r.state === "CHANGES_REQUESTED"),
        failingChecks: failing,
        pendingChecks: pending,
        lastWord: last
          ? { who: last.who, at: last.at.slice(0, 10), body: last.body }
          : null,
        lastHuman: lastHuman
          ? {
              who: lastHuman.who,
              at: lastHuman.at.slice(0, 10),
              body: lastHuman.body,
            }
          : null,
        botWaiting,
        /**
         * Whose move. The whole point of the tracker.
         *
         * Ours beats theirs beats stalled: something we owe is always the most
         * actionable item on the list, and the only delay we can remove alone.
         */
        phase: blockers.length
          ? "blocked — needs you"
          : ours
            ? "our move"
            : failing.length
              ? "our move — checks red"
              : theirs
                ? "waiting on them"
                : idle != null && idle > STALE_DAYS
                  ? "stalled"
                  : "awaiting first response",
        // What we know about the repository from the pipeline, so the tracker
        // does not need a second lookup to say why this PR matters.
        sector: customers.get(slug)?.sector ?? null,
        weeklyDownloads: customers.get(slug)?.weeklyDownloads ?? null,
        stars: customers.get(slug)?.stars ?? null,
      };
    }),
  );

  const order = [
    "our move",
    "our move — checks red",
    "stalled",
    "awaiting first response",
    "waiting on them",
  ];
  prs.sort(
    (a, b) =>
      order.indexOf(a.phase) - order.indexOf(b.phase) ||
      (b.idleDays ?? 0) - (a.idleDays ?? 0),
  );

  return NextResponse.json({
    asOf: new Date().toISOString(),
    me,
    prs,
    totals: {
      open: prs.length,
      ourMove: prs.filter((p) => p.phase.startsWith("our move")).length,
      blocked: prs.filter((p) => p.blockers.length > 0).length,
      waiting: prs.filter((p) => p.phase === "waiting on them").length,
      stalled: prs.filter((p) => p.phase === "stalled").length,
      silent: prs.filter((p) => p.phase === "awaiting first response").length,
      approved: prs.filter((p) => p.approved).length,
    },
  });
}
