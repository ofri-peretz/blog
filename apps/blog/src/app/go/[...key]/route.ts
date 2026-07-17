// /go/<key> — the repointable redirect layer (plan §L5.5 + §L5.6).
//
// Every cross-article link published OFF-domain (dev.to, newsletters,
// social) routes through here: one server-side PostHog event, then a 302.
// Published bodies are immutable; this table-driven hop is not — rename a
// slug or repoint a destination and every link ever published follows.
//
// Key grammar (catch-all segments):
//   /go/<slug>            → article. Precedence:
//                             1. `?utm_source=<platform>` present AND an
//                                article_platforms(slug, platform) row
//                                exists → 302 to that platform's copy
//                                (dev.to readers stay on dev.to);
//                             2. otherwise → 302 to the blog canonical
//                                https://ofriperetz.dev/articles/<slug>,
//                                utm_* params forwarded.
//   /go/npm/<package>     → https://www.npmjs.com/package/<package>
//                           (scoped names span segments: /go/npm/@scope/pkg)
//   /go/gh/<owner>/<repo> → https://github.com/<owner>/<repo>
//
// `?from=<source-slug>` is publisher-injected attribution: the SOURCE
// article of the link. Analytics-only — it never affects routing. Referer
// is a weaker fallback recorded as origin only (modern referrer policy
// strips the path anyway).
//
// SEO guardrails (§L5.5): 302 not 301 (flexibility, not equity transfer),
// X-Robots-Tag: noindex, and canonical_url is never a /go/ URL. Blog
// readers never touch /go/ — on-domain links stay direct.

import { after } from "next/server";
import { getCachedArticlePlatforms } from "@/lib/supabase-data";

// Redirect decisions are data-driven and must stay repointable — never
// let the CDN memoize them (the whole point of the layer is that the
// destination can change after the link is published).
export const dynamic = "force-dynamic";

const BLOG_ORIGIN = "https://ofriperetz.dev";

type LinkKind = "article" | "npm" | "gh";

interface ResolvedLink {
  kind: LinkKind;
  destination: string;
}

function resolveStatic(segments: string[]): ResolvedLink | null {
  const [ns, ...rest] = segments;
  if (ns === "npm" && rest.length > 0) {
    // join("/") keeps scoped packages whole: ["@interlace","eslint-devkit"]
    // → "@interlace/eslint-devkit".
    return {
      kind: "npm",
      destination: `https://www.npmjs.com/package/${rest.join("/")}`,
    };
  }
  if (ns === "gh" && rest.length > 0) {
    return { kind: "gh", destination: `https://github.com/${rest.join("/")}` };
  }
  return null;
}

async function resolveArticle(
  slug: string,
  searchParams: URLSearchParams,
): Promise<string> {
  const utmSource = searchParams.get("utm_source");
  if (utmSource) {
    const rows = await getCachedArticlePlatforms();
    const row = rows.find((r) => r.slug === slug && r.platform === utmSource);
    if (row) return row.url;
  }
  // Default (zero table rows needed): the blog canonical, UTMs forwarded.
  const dest = new URL(`/articles/${slug}`, BLOG_ORIGIN);
  for (const [k, v] of searchParams) {
    if (k.startsWith("utm_")) dest.searchParams.set(k, v);
  }
  return dest.toString();
}

// Fire-and-forget server-side capture via PostHog's HTTP event endpoint
// (POST /i/v0/e/ — the same single-event endpoint posthog-js uses;
// /capture/ is the legacy alias). No SDK on the server path: one fetch,
// scheduled with after() so the 302 is never delayed and the runtime
// stays alive until the send completes. Missing key = silent no-op, same
// defensive posture as the Supabase fetchers.
function captureShortLinkClick(
  request: Request,
  props: {
    key: string;
    kind: LinkKind;
    from: string | null;
    utm_source: string | null;
    destination: string;
  },
): void {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  // Referer origin only — analytics fallback for links pasted outside the
  // pipeline (comments, DMs). Surface at best, never used for routing.
  let refererOrigin: string | null = null;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      refererOrigin = null;
    }
  }

  after(async () => {
    try {
      await fetch(`${host}/i/v0/e/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Analytics is best-effort — never hold the function open on a
        // slow ingest endpoint.
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify({
          api_key: apiKey,
          event: "short_link_click",
          // Server-originated: no person to identify, and we don't want
          // ephemeral person profiles per click.
          distinct_id: "server-go",
          properties: {
            ...props,
            referer_origin: refererOrigin,
            // The client-side provider registers `app` as a
            // super-property; server events must carry it explicitly —
            // one shared PostHog project, dashboards filter on it.
            app: "blog",
            $process_person_profile: false,
          },
          timestamp: new Date().toISOString(),
        }),
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
  const { key: segments } = await params;
  const url = new URL(request.url);

  const staticLink = resolveStatic(segments);
  const kind: LinkKind = staticLink?.kind ?? "article";
  const destination =
    staticLink?.destination ??
    (await resolveArticle(segments.join("/"), url.searchParams));

  captureShortLinkClick(request, {
    key: segments.join("/"),
    kind,
    from: url.searchParams.get("from"),
    utm_source: url.searchParams.get("utm_source"),
    destination,
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: destination,
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
    },
  });
}
