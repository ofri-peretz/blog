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

import { flushTelemetry, logGoRedirect } from "@/instrumentation";

import { getCachedShortLinks } from "@/lib/supabase-data";
import {
  anonymousVisitorId,
  buildClickEventBody,
  POSTHOG_INGEST_FALLBACK,
  refererToOrigin,
  resolveGoDestination,
  resolveIngestHost,
  SERVER_FALLBACK_ID,
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
  // Server route handlers read env at RUNTIME, and NEXT_PUBLIC_POSTHOG_KEY has
  // been empty in the deployed runtime env (NEXT_PUBLIC_* is build-inlined into
  // the browser bundle, but a server route handler can't use that — it needs the
  // runtime value). Fall back to the public project key so /go/ analytics fire
  // regardless; a real env value still wins. `||` (not `??`) so an empty string
  // — which is exactly how it was deployed — also falls back.
  const apiKey =
    process.env.NEXT_PUBLIC_POSTHOG_KEY ||
    "phc_vNTTtpj4s6nXGJ5pnnXxHey6WBjHJWnytQ4Zv6HeDTT3";
  // NEXT_PUBLIC_POSTHOG_HOST is a BROWSER variable and its correct value is
  // now the relative `/ingest`, which a server fetch cannot parse. See
  // resolveIngestHost — using it raw is what killed this event for 20 days.
  const host = resolveIngestHost(process.env.NEXT_PUBLIC_POSTHOG_HOST);
  const refererOrigin = refererToOrigin(request.headers.get("referer"));

  after(async () => {
    try {
      // Hashing is async (Web Crypto), so it happens here rather than on the
      // redirect path — the 302 is never delayed by telemetry.
      const distinctId = await anonymousVisitorId(
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        request.headers.get("user-agent"),
      );
      const body = {
        api_key: apiKey,
        ...buildClickEventBody(
          capture,
          refererOrigin,
          undefined,
          distinctId,
          request.headers.get("user-agent"),
        ),
      };
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
      // ...but a silent failure is how this event stayed dead for twenty days,
      // with a correct 302 on every hit and nothing anywhere saying otherwise.
      // Report the failure as a PRESENT signal, because an absence is exactly
      // what nobody noticed. Deliberately posted to the hardcoded fallback and
      // not to `host`: if the configured host is the fault, a report sent
      // through it dies the same silent death.
      try {
        await fetch(`${POSTHOG_INGEST_FALLBACK}/i/v0/e/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(3000),
          body: JSON.stringify({
            api_key: apiKey,
            event: "short_link_capture_failed",
            distinct_id: SERVER_FALLBACK_ID,
            properties: {
              // Error NAME only — never the message, which can carry the URL
              // and with it whatever was in the query string.
              error: err instanceof Error ? err.name : "unknown",
              $process_person_profile: false,
            },
          }),
        });
      } catch {
        // The detector itself must never throw. If this fails too, the
        // pipeline is comprehensively down and the redirect still works.
      }
    }
  });
}

/** Host only — the full destination can carry campaign params we don't need in a log dimension. */
function hostOf(location: string): string {
  try {
    return new URL(location).host;
  } catch {
    return "(relative)";
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { key: keyParts } = await params;
  const url = new URL(request.url);

  // Whole-table cached read (tag 'short-links'); a closure turns it into
  // the sync lookup the pure resolver expects.
  //
  // Degrading to "no overrides" is the right behaviour — every /go/<slug> still
  // 302s to its derived default, never a 500. The catch lives HERE rather than
  // in the fetcher because returning [] from inside unstable_cache caches the
  // failure for twelve hours and across redeploys, silently disabling every
  // override. Failing per-request means the next visitor gets the real table.
  let rows: Awaited<ReturnType<typeof getCachedShortLinks>> = [];
  let shortLinksAvailable = true;
  const lookupStart = Date.now();
  try {
    rows = await getCachedShortLinks();
  } catch (err) {
    shortLinksAvailable = false;
    console.error("[go] short_links unavailable, using derived defaults:", err);
  }
  const lookupMs = Date.now() - lookupStart;
  const resolution = resolveGoDestination({
    keyParts: keyParts ?? [],
    utmSource: url.searchParams.get("utm_source"),
    from: url.searchParams.get("from"),
    incomingSearchParams: url.searchParams,
    lookup: (key) => rows.find((r) => r.key === key) ?? null,
  });

  captureShortLinkClick(request, resolution.capture);

  // One wide log record per redirect (see logGoRedirect). Kept to a single
  // call so this wrapper stays dumb, per the note at the top of the file.
  // Same normalisation as classifyKey in resolver.ts — empty segments filtered
  // before joining. Without the filter a trailing-slash URL yields "slug/" here
  // but "slug" in the lookup, which would make overrideHit a false negative.
  const loggedKey = (keyParts ?? []).filter((s) => s.length > 0).join("/");
  logGoRedirect({
    key: loggedKey,
    status: resolution.status,
    destinationHost: hostOf(resolution.location),
    overrideHit: rows.some((r) => r.key === loggedKey),
    shortLinksAvailable,
    refererOrigin: refererToOrigin(request.headers.get("referer")),
    lookupMs,
  });
  after(flushTelemetry);

  return new Response(null, {
    status: resolution.status,
    headers: { Location: resolution.location, ...resolution.headers },
  });
}
