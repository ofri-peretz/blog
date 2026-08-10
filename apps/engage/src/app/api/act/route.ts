import { NextResponse } from "next/server";
import { recordAction, allItems } from "@/lib/footprint";
import { recordAction as ledger } from "@/lib/store";

const MAX_BODY = 64 * 1024;

export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY)
    return NextResponse.json({ ok: false, error: "body too large" }, { status: 413 });

  let body: { kind?: string; date?: string; slot?: number; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const { kind, date, slot, action } = body;
  if (
    (kind !== "comment" && kind !== "reaction") ||
    typeof date !== "string" ||
    typeof slot !== "number" ||
    (action !== "done" && action !== "skip")
  )
    return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });

  const r = recordAction(kind, date, slot, action);

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
