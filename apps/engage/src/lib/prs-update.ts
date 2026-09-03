/**
 * The one always-safe move on an outreach PR: bring OUR head branch up to
 * date with the base, through GitHub's update-branch endpoint. No clone, no
 * force-push, and a conflict comes back as a 422 that a person resolves.
 * Intent: docs/sdlc/intents/2026-09-03-engage-outreach-never-stalls.
 *
 * Pure parts live here so the selfcheck can pin the input contract and the
 * status mapping without a GitHub round-trip.
 */
const SEG = /^[\w.-]+$/;

export function parseTarget(body: unknown): { owner: string; repo: string; number: number } | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const owner = String(b.owner ?? "");
  const repo = String(b.repo ?? "");
  const number = Number(b.number);
  if (!SEG.test(owner) || !SEG.test(repo) || !Number.isInteger(number) || number <= 0) return null;
  return { owner, repo, number };
}

export type UpdateOutcome =
  | { ok: true; status: "accepted"; message: string }
  | { ok: false; status: "conflict" | "not-ours" | "not-found" | "error"; message: string };

/** Map GitHub's HTTP status for update-branch to what the row should say. */
export function outcomeFor(httpStatus: number, detail = ""): UpdateOutcome {
  switch (httpStatus) {
    case 202: return { ok: true, status: "accepted", message: "GitHub is merging the base into our branch — refresh in a minute" };
    case 422: return { ok: false, status: "conflict", message: "conflicts with the base — a person resolves this one" };
    case 403: return { ok: false, status: "not-ours", message: "no push rights on the head branch — not our fork" };
    case 404: return { ok: false, status: "not-found", message: "PR or repository not found" };
    default: return { ok: false, status: "error", message: detail || `GitHub answered ${httpStatus}` };
  }
}
