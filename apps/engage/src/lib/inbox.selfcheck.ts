/**
 * Runnable self-check for the inbox rules —
 * `npx tsx --conditions=react-server src/lib/inbox.selfcheck.ts`.
 *
 * This file exists because the inbox broke FOUR separate ways in a single
 * session, and every one of them rendered as a confident, plausible number:
 *
 *   1. sourced from the drafts file, so it answered "what did we draft" under a
 *      heading promising "what is waiting" — reported 0 against a real 14.
 *   2. crawled only our own articles, so replies to our comments elsewhere
 *      vanished along with their drafts — reported "4 waiting, none drafted"
 *      while twelve finished drafts sat on disk.
 *   3. counted every stranger's comment on other people's posts once those were
 *      added — 2,422 "waiting threads", which is not an inbox, it is the site.
 *   4. a single 429 dropped a whole article's comment tree in silence.
 *
 * None of those threw. None failed a build. The pure decision logic is
 * extracted here so the rules can be asserted without a network.
 */
import assert from "node:assert/strict";

const ME = "ofri-peretz";

type C = { user?: { username?: string }; children?: C[] };

/** Mirrors answeredByUs in inbox.ts. */
function answeredByUs(children: C[] = []): boolean {
  for (const c of children) {
    if (c.user?.username === ME) return true;
    if (answeredByUs(c.children)) return true;
  }
  return false;
}

/** Mirrors the inclusion rule: what is OURS to answer. */
const oursToAnswer = (articleIsMine: boolean, parentIsUs: boolean) =>
  articleIsMine || parentIsUs;

const u = (name: string, children: C[] = []): C => ({ user: { username: name }, children });

// ── 1. answered means answered, at any depth ─────────────────────────────────
{
  assert.equal(answeredByUs([u("someone")]), false);
  assert.equal(answeredByUs([u(ME)]), true, "a direct reply from us counts");
  assert.equal(
    answeredByUs([u("a", [u("b", [u(ME)])])]),
    true,
    "a reply nested three deep still means we answered",
  );
  assert.equal(answeredByUs([]), false);
}

// ── 2. THE 2,422 BUG: scope on other people's articles ───────────────────────
{
  // Our article: anyone's unanswered comment is ours.
  assert.equal(oursToAnswer(true, false), true, "top-level on OUR post is ours");
  assert.equal(oursToAnswer(true, true), true);

  // Someone else's article: only a reply to OUR comment is ours. A stranger
  // commenting on a stranger's post is a conversation we are not in — and
  // counting it is what turned 4 threads into 2,422.
  assert.equal(
    oursToAnswer(false, false),
    false,
    "a stranger's comment on a stranger's post is NOT our inbox",
  );
  assert.equal(
    oursToAnswer(false, true),
    true,
    "a reply to our comment on their post IS ours — the population that went missing",
  );
}

// ── 3. the three populations are all reachable ───────────────────────────────
{
  // Encoded as the (articleIsMine, parentIsUs) pairs that must be included.
  const included = ([mine, parent]: [boolean, boolean]) => oursToAnswer(mine, parent);
  assert.ok(included([true, false]), "population 1: comments on our articles");
  assert.ok(included([true, true]), "population 2: replies to us on our articles");
  assert.ok(included([false, true]), "population 3: replies to us elsewhere");
  assert.ok(!included([false, false]), "and nothing else");
}

// ── 4. a failed check is never a deletion ────────────────────────────────────
{
  // Mirrors authorProfile: only a definite 404 marks an account gone.
  const gone = (status: number | null) => status === 404;
  assert.equal(gone(404), true);
  assert.equal(gone(200), false);
  assert.equal(gone(429), false, "a rate limit must not delete an author");
  assert.equal(gone(503), false, "an outage must not delete an author");
  assert.equal(gone(null), false, "a network error must not delete an author");
}

// ── 5. `sent` does not suppress; `skipped` does ──────────────────────────────
{
  // Every thread in the inbox was just verified as unanswered ON THE PLATFORM,
  // so a local "sent" is a contradiction to surface, not a reason to hide.
  const suppressed = (status?: string) => status === "skipped";
  assert.equal(suppressed("skipped"), true, "a human decision the platform cannot contradict");
  assert.equal(suppressed("sent"), false, "a sent that never landed must resurface");
  assert.equal(suppressed(undefined), false, "never drafted is not handled");
}

console.log("inbox.selfcheck: all assertions passed");
