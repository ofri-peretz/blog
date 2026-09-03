import { NextResponse } from "next/server";
import { recordAction, allItems } from "@/lib/footprint";
import { recordAction as ledger } from "@/lib/store";

const MAX_BODY = 64 * 1024;

/**
 * `date` becomes part of a queue FILE PATH, so "is a string" is not a check.
 * `../../../etc/passwd` is a string. Only an exact calendar shape is safe.
 */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  // Read the body and measure what ACTUALLY arrived. `content-length` is a
  // client-supplied header — a chunked request omits it, and a lying one can
  // claim any value, so gating on it alone enforces nothing.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ ok: false, error: "unreadable body" }, { status: 400 });
  }
  if (raw.length > MAX_BODY)
    return NextResponse.json({ ok: false, error: "body too large" }, { status: 413 });

  let body: { kind?: string; date?: string; slot?: number; action?: string; text?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const { kind, date, slot, text } = body;
  // `done` is the pre-split client vocabulary; it meant "opened", so map it.
  const action = body.action === "done" ? "open" : body.action;
  if (
    (kind !== "comment" && kind !== "reaction") ||
    typeof date !== "string" ||
    !DATE.test(date) ||
    typeof slot !== "number" ||
    (action !== "open" && action !== "skip" && action !== "posted") ||
    (text !== undefined && text !== null && typeof text !== "string")
  )
    return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });

  const r = recordAction(kind, date, slot, action, (text as string | null | undefined) ?? null);

  // Ledger + narrow cache invalidation. The queue file records WHAT the item
  // became; this records that YOU did it, when, and in which session — which is
  // what the refresh key and the pace meter read back.
  if (r.ok) {
    const hit = allItems().find((i) => i.kind === kind && i.date === date && i.slot === slot);
    if (hit) {
      try {
        ledger({
          session: (body as any).session ?? "adhoc",
          kind, action,
          author: hit.article.author,
          articleId: hit.article.id,
          title: hit.article.title,
        });
      } catch { /* the action already succeeded; bookkeeping must not undo it */ }
    }
  }
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
