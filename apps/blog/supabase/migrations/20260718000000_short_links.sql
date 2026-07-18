-- short_links — a tiny URL shortener behind the /go/ redirect layer
-- (canonical-articles-plan §L5.5–§L5.7).
--
-- A row is a `key → destination(s)` mapping plus metadata. This
-- GENERALIZES the earlier article_platforms(slug, platform, url) design:
-- platform copies now live in the `platforms` JSON, and the table can hold
-- any short link (article, npm, gh, or a custom external/campaign link),
-- not just article↔platform rows.
--
-- The core contract stays: `/go/<article-slug>` with NO row still works —
-- the resolver derives the default (/articles/<slug>, or the npm/gh page).
-- A row is only needed to OVERRIDE: repoint a destination, add a
-- per-platform copy (dev.to reader → dev.to), or attach campaign/expiry.
--
-- The table holds ROUTING only; CLICKS live in PostHog (event
-- short_link_click) — one source of truth per data type (see the spectator
-- view sketch at the bottom).
--
-- Read by:  blog-public apps/blog/src/app/go/[...key]/route.ts via
--           getCachedShortLinks (anon key; unstable_cache tag 'short-links').
-- Written by: the publisher pipeline at publish time (upsert example below;
--           service_role connection), then a revalidate-tag call.
--
-- Apply: paste into the Supabase SQL editor (how earlier migrations were
--        applied), or `supabase db push`. There is no automated migration
--        runner wired for blog-public yet — this must be applied MANUALLY.

CREATE TABLE IF NOT EXISTS public.short_links (
  key         text        PRIMARY KEY,               -- the /go path after /go/ (slug | npm/<pkg> | gh/<owner/repo> | custom)
  kind        text        NOT NULL DEFAULT 'article'  -- taxonomy; also the value carried on the click event
              CHECK (kind IN ('article', 'npm', 'gh', 'external')),
  destination text,                                   -- default/repointed target; overrides the derived default
  platforms   jsonb       NOT NULL DEFAULT '{}'::jsonb, -- per-platform copies keyed by utm_source, e.g. {"devto":"https://dev.to/…"}

  -- Metadata seams — present so future features slot in WITHOUT a migration.
  -- Only `active` and `expires_at` are read by the resolver today (guards);
  -- the rest are for the spectator dashboard / campaign tooling later.
  campaign    text,                                   -- group links under a campaign for aggregate reporting
  tags        text[],                                 -- freeform labels (surface, series, experiment arm, …)
  active      boolean     NOT NULL DEFAULT true,      -- kill switch: false ⇒ resolver ignores the override
  note        text,                                   -- human note (why this row exists)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz                             -- nullable; once past, the override is ignored (link reverts to default)
);

-- Query helpers for the spectator/aggregation use cases (cheap, additive).
CREATE INDEX IF NOT EXISTS short_links_kind_idx     ON public.short_links (kind);
CREATE INDEX IF NOT EXISTS short_links_campaign_idx ON public.short_links (campaign);

ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

-- Blog reads with the anon key; only the publisher (service_role) writes.
CREATE POLICY "short_links_read"
  ON public.short_links FOR SELECT USING (true);
CREATE POLICY "short_links_write"
  ON public.short_links FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_short_links_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER short_links_updated_at
  BEFORE UPDATE ON public.short_links
  FOR EACH ROW EXECUTE FUNCTION public.set_short_links_updated_at();

-- ── Publisher upsert (run once per publish/sync, service_role) ────────
-- Adds/updates only the dev.to copy in `platforms`, preserving any other
-- keys already there (jsonb || merge) and any campaign/tags/expiry. Then
-- bust the blog's mapping cache:
--   POST https://ofriperetz.dev/api/revalidate-tag
--     Authorization: Bearer $REVALIDATE_SECRET   (body: {"tag":"short-links"})
--
--   INSERT INTO public.short_links (key, kind, platforms)
--   VALUES ('i-built-what-i-benchmark-heres-how-i-try-not-to-cheat',
--           'article',
--           jsonb_build_object('devto',
--             'https://dev.to/unicop/i-built-what-i-benchmark-…-abc1'))
--   ON CONFLICT (key) DO UPDATE
--     SET platforms = public.short_links.platforms || EXCLUDED.platforms,
--         updated_at = now();
--
-- (The blog-public publisher wires this as a merge-safe RPC — see
-- scripts/publish-to-devto.mjs upsertShortLink; stubbed until multi-platform.)

-- ── Spectator observability (SKETCH — not built here) ─────────────────
-- Per-link traffic is watched from PostHog: the short_link_click event
-- already carries {key, kind, from, utm_source, destination, referer_origin}.
-- A per-link click-count / top-referrers / over-time view is therefore a
-- trivial PostHog insight (breakdown by `key`) OR, if we want it in the
-- Supabase warehouse next to downloads, a daily HogQL roll-up into a
-- link_click_daily table joined here. The obvious home for the dashboard:
--
--   -- v_short_link_clicks: one row per link with lifetime + trailing
--   -- traffic, joined to its routing row. Populate link_click_daily from
--   -- daily-ingest (HogQL: short_link_click grouped by key, day), then:
--   --
--   -- CREATE VIEW public.v_short_link_clicks AS
--   --   SELECT sl.key, sl.kind, sl.campaign, sl.destination,
--   --          COALESCE(c.clicks_total, 0)   AS clicks_total,
--   --          COALESCE(c.clicks_28d, 0)     AS clicks_28d,
--   --          c.last_click_at
--   --   FROM public.short_links sl
--   --   LEFT JOIN ( /* SELECT key, sum/window from link_click_daily */ ) c
--   --     ON c.key = sl.key;
--
-- Left as a comment so the spectator dashboard has an obvious home without
-- committing the ingest+view now (YAGNI on the feature, deliberate on the seam).
