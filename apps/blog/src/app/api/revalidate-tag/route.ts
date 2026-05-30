// On-demand cache invalidation for the Supabase-backed data surfaces.
//
// Every /api/* route that reads Supabase wraps its query in
// `unstable_cache(fn, key, { revalidate: 43200, tags: ['ratchet'] })`.
// That 12h TTL is the freshness *floor*. This endpoint is the freshness
// *signal*: after the daily ingest writes new rows, hitting this route
// fires `revalidateTag('ratchet')`, which evicts every tagged cache entry
// across all Vercel regions at once — so the new numbers appear in
// seconds, not "up to 12h later".
//
// Auth: bearer token compared to REVALIDATE_SECRET (set on Vercel + in
// footprint/.env for the datasync CLI). Without it, anyone could force
// cache-busting + extra Supabase reads. Low harm, but gated anyway.
//
// Called by: footprint/scripts/datasync.sh (the `ofriperetz-datasync`
// CLI) and — once wired — a Supabase DB webhook on row insert.

import { revalidateTag } from "next/cache";

const TAGS = ["ratchet", "github"] as const;

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    // Fail closed: if the secret isn't configured, refuse rather than
    // leave the endpoint open. Surfaces the misconfig loudly.
    return Response.json(
      { ok: false, error: "REVALIDATE_SECRET not configured" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  for (const tag of TAGS) {
    revalidateTag(tag, "default");
  }

  return Response.json({
    ok: true,
    revalidated: TAGS,
    at: new Date().toISOString(),
  });
}
