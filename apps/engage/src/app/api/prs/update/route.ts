import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { FOOTPRINT } from "@/lib/footprint";
import { parseTarget, outcomeFor } from "@/lib/prs-update";

const execFileAsync = promisify(execFile);
export const dynamic = "force-dynamic";

/**
 * POST { owner, repo, number } → PUT /repos/{owner}/{repo}/pulls/{number}/update-branch
 * through the machine's `gh` auth. One click, one PR — no batch, by intent.
 * On any answer the 15-minute tracker cache is dropped so the next read re-asks.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const t = parseTarget(body);
  if (!t) return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });

  let httpStatus = 0;
  let detail = "";
  try {
    // -i prints the status line; the body follows. We only need the status.
    const { stdout } = await execFileAsync(
      "gh",
      ["api", "-i", "-X", "PUT", `repos/${t.owner}/${t.repo}/pulls/${t.number}/update-branch`],
      { maxBuffer: 1e6 },
    );
    httpStatus = Number(/^HTTP\/[\d.]+ (\d{3})/m.exec(stdout)?.[1] ?? 0);
  } catch (e: any) {
    // gh exits non-zero on 4xx and still prints the response headers to stdout.
    const out = String(e?.stdout ?? "") + String(e?.stderr ?? "");
    httpStatus = Number(/HTTP\/[\d.]+ (\d{3})/m.exec(out)?.[1] ?? 0);
    detail = (/"message"\s*:\s*"([^"]+)"/.exec(out)?.[1] ?? out.split("\n").find((l) => l.trim()) ?? "").slice(0, 200);
  }
  const outcome = outcomeFor(httpStatus, detail);
  try {
    const cache = join(FOOTPRINT, "engagement", ".cache", "prs.json");
    if (existsSync(cache)) unlinkSync(cache);
  } catch { /* the outcome is what matters; a stale cache only costs one refresh */ }
  return NextResponse.json({ ...outcome, httpStatus, target: t });
}
