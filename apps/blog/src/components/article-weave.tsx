import { TimeSeries } from "@/components/ui/time-series";
import { TrackedLink } from "@/components/tracked-link";
import { indexTo100, windowPoints } from "@/lib/loom-data";
import {
  LOOM_EMBEDS,
  type LoomEmbedSnapshot,
} from "@/lib/loom-embeds";
import { serializeLoomState, windowCutoff } from "@/lib/loom-url";

/**
 * A read-only weave inside an article — the Loom placed where readers
 * already are. Renders the committed snapshot (article pages build
 * without Supabase creds; the committed-JSON doctrine), draws with the
 * same vendored TimeSeries the composer uses, and hands the reader
 * "Open in the Loom →" whose permalink comes from the SAME URL codec —
 * so the live page opens on exactly this composition.
 *
 * Data gap renders nothing (the bench-receipt convention): a missing
 * series must never break an article, and the sync script already
 * treats it as a hard error on the refresh side.
 */
export function ArticleWeave({
  currentSlug,
  data,
}: {
  currentSlug: string;
  data: LoomEmbedSnapshot | null;
}) {
  const def = LOOM_EMBEDS.find((d) => d.slug === currentSlug);
  if (!def || !data?.series) return null;

  const cutoff = windowCutoff(def.state.window, data.observedThrough);
  const woven = def.state.series
    .map((id) => ({ id, series: data.series[id] }))
    .filter((s) => s.series && s.series.points.length >= 2)
    .map(({ id, series }) => {
      const windowed = windowPoints(series.points, cutoff);
      return {
        id,
        label: series.label,
        points:
          def.state.normalize === "idx" ? indexTo100(windowed) : windowed,
        unit: def.state.normalize === "idx" ? "indexed" : series.unit,
        provenance: series.provenance,
      };
    });
  if (woven.length === 0) return null;

  const qs = serializeLoomState(def.state);
  const href = qs ? `/loom?${qs}` : "/loom";

  return (
    <section
      data-slot="article-weave"
      aria-label={def.title}
      className="mt-12 border-t border-border pt-8"
    >
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        {def.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{def.claim}</p>
      <div className="mt-4">
        <TimeSeries
          points={woven[0].points}
          label={woven[0].label}
          unit={woven[0].unit}
          compare={woven.slice(1).map((w) => ({
            points: w.points,
            label: w.label,
            unit: w.unit,
          }))}
          height={220}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {[...new Set(woven.map((w) => w.provenance))].join(" · ")} · observed
        through {data.observedThrough} ·{" "}
        <TrackedLink
          href={href}
          event="loom:embed_open"
          props={{ slug: currentSlug, series: def.state.series.join(",") }}
          className="underline hover:text-foreground"
        >
          Open in the Loom →
        </TrackedLink>
      </p>
    </section>
  );
}
