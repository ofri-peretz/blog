import { NextResponse } from "next/server";
import { spawnSync } from "node:child_process";
import { FOOTPRINT } from "@/lib/footprint";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

const MAX_BODY = 64 * 1024;

/**
 * Draft a reply with a sub-agent — the same `claude --print` path the article
 * gate and the comment queue already use, so voice and house rules come from one
 * place rather than being re-specified per surface.
 *
 * The point of this endpoint is that NOTHING here is written by hand. The
 * control room's job is to hand over a finished payload; reading a thread and
 * composing a response is exactly the work being delegated.
 */
export async function POST(req: Request) {
  // Measure the body that actually arrived, not the length the client claims:
  // `content-length` is absent on chunked requests and forgeable on any other.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ ok: false, error: "unreadable body" }, { status: 400 });
  }
  if (raw.length > MAX_BODY)
    return NextResponse.json({ ok: false, error: "body too large" }, { status: 413 });

  let body: { author?: string; theirComment?: string; articleTitle?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const { author = "", theirComment = "", articleTitle = "" } = body;
  if (!theirComment.trim())
    return NextResponse.json({ ok: false, error: "no comment to reply to" }, { status: 400 });

  const prompt = [
    `You are drafting a Dev.to REPLY as Ofri Peretz — engineering leader, security and static-analysis specialist, author of the Interlace ESLint ecosystem.`,
    ``,
    `Thread: "${articleTitle}". @${author} replied to your comment:`,
    `"""`,
    theirComment.slice(0, 2000),
    `"""`,
    ``,
    `Write the reply. Rules:`,
    `- Engage with their SPECIFIC point. Add something they cannot get from a search result: a mechanism, a measured number, a failure mode you have hit.`,
    `- Concede where they are right. Disagreeing without conceding reads as defensive.`,
    `- 60-120 words. One paragraph. No greeting, no sign-off, no emoji.`,
    `- Never pitch a product or link a plugin. This is a conversation.`,
    `- Plain sentences. No "great point", no "absolutely", no throat-clearing.`,
    ``,
    `Output ONLY the reply text.`,
  ].join("\n");

  try {
    // Prompt goes on STDIN, not argv. Passing it as an argument fails once it
    // grows past the shell's arg limits — and fails as a generic non-zero exit,
    // which reads like the model refused rather than like it was never called.
    const res = spawnSync("claude", ["--print", "--model", "sonnet"], {
      cwd: FOOTPRINT,
      input: prompt,
      encoding: "utf8",
      timeout: 220_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    // The CLI prints its own failures (an expired OAuth session, most often) to
    // STDOUT and exits 1, leaving stderr empty — so a stderr-only message
    // degrades every cause to "claude exited 1" and sends you debugging the
    // prompt when you are actually just logged out.
    if (res.status !== 0)
      throw new Error(
        String(res.stderr || res.stdout || "claude exited " + res.status),
      );
    const text = (res.stdout ?? "").trim();
    if (!text) return NextResponse.json({ ok: false, error: "empty draft" }, { status: 502 });
    return NextResponse.json({ ok: true, text });
  } catch (e: any) {
    // A quota or transport failure must not masquerade as a bad draft — the
    // caller needs to know the agent never ran, not that it wrote nothing.
    const msg = String(e?.stderr || e?.message || e).split("\n")[0].slice(0, 200);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
