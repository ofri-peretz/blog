// /go/<key> — the thin route wrapper over the pure resolver (plan §L5.5).
//
// This file does exactly three things, in order:
//   1. read the request (params, query, headers),
//   2. load the cached short_links rows and hand a sync lookup + the
//      request to resolveGoDestination (the pure pipeline — resolver.ts),
//   3. fire the short_link_click event (fire-and-forget) and 302.
//
// All routing logic, precedence, guards, and the event schema live in
// resolver.ts and are unit-tested to 100%. Keep this wrapper dumb.
//
// Key grammar: /go/<slug> · /go/npm/<pkg> · /go/gh/<owner/repo>.
// See resolver.ts for destination precedence and SEO guardrails.

import { after } from "next/server";

import { getCachedShortLinks } from "@/lib/supabase-data";
import {
  buildClickEventBody,
  refererToOrigin,
  resolveGoDestination,
  type ShortLinkClickProps,
} from "../resolver";

// Redirect decisions are data-driven and repointable — never let the CDN
// memoize them (the whole point is that the destination can change after
// the link is published).
export const dynamic = "force-dynamic";

// Fire-and-forget server-side capture via PostHog's HTTP event endpoint
// (POST /i/v0/e/). No SDK on the server path: one fetch, scheduled with
// after() so the 302 is never delayed and the runtime stays alive until
// the send completes. Missing key = silent no-op (same defensive posture
// as the Supabase fetchers).
function captureShortLinkClick(
  request: Request,
  capture: ShortLinkClickProps,
): void {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  const refererOrigin = refererToOrigin(request.headers.get("referer"));
  const body = { api_key: apiKey, ...buildClickEventBody(capture, refererOrigin) };

  after(async () => {
    try {
      await fetch(`${host}/i/v0/e/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Analytics is best-effort — never hold the function open on a
        // slow ingest endpoint.
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify(body),
      });
    } catch (err) {
      // Analytics must never break the redirect path.
      console.warn("[go] posthog capture failed:", err);
    }
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { key: keyParts } = await params;
  const url = new URL(request.url);

  // Whole-table cached read (tag 'short-links'); a closure turns it into
  // the sync lookup the pure resolver expects.
  const rows = await getCachedShortLinks();
  const resolution = resolveGoDestination({
    keyParts: keyParts ?? [],
    utmSource: url.searchParams.get("utm_source"),
    from: url.searchParams.get("from"),
    incomingSearchParams: url.searchParams,
    lookup: (key) => rows.find((r) => r.key === key) ?? null,
  });

  captureShortLinkClick(request, resolution.capture);

  return new Response(null, {
    status: resolution.status,
    headers: { Location: resolution.location, ...resolution.headers },
  });
}
