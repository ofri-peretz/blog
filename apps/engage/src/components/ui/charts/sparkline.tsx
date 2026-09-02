import * as React from 'react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { toneFor, type Polarity } from '@/components/ui/charts/delta';
import { delta, describeSeries, linePath, seriesScales, type Point } from '@/components/ui/charts/scale';

export const MIN_VIEWPORT = 320 as const;

export interface SparklineProps
  // `points` is also a real SVG presentation attribute (on `<polyline>`/`<polygon>`,
  // where it is a space-separated string). Ours wins — omit theirs, or TS reports
  // the interface as an invalid extension rather than a prop collision.
  extends Omit<React.ComponentProps<'svg'>, 'width' | 'height' | 'children' | 'points'> {
  points: readonly Point[];
  width?: number;
  height?: number;
  /**
   * Set when the same numbers are already announced adjacently — in a
   * `MetricTable` row the value and delta cells say it, so a second
   * announcement is noise. Renders `aria-hidden` instead of `role="img"`.
   */
  decorative?: boolean;
  /** Name used in the accessible label. Ignored when `decorative`. */
  label?: string;
  /**
   * Which direction counts as good. `inverse` for latency, cost, error rate,
   * open issues.
   *
   * Without this the sparkline coloured purely by DIRECTION, so an
   * inverse-polarity row rendered a red line beside a green delta — the same
   * row asserting "bad" and "good" simultaneously. Only visible by looking at
   * it; every unit test passed.
   */
  polarity?: Polarity;
  /**
   * Render a `<Skeleton variant="sparkline" />` placeholder at the exact inline
   * cell size, so a metric arriving mid-window does not reflow its column.
   */
  loading?: boolean;
}

export const Sparkline = React.forwardRef<SVGSVGElement, SparklineProps>(function Sparkline(
  {
    points,
    width = 90,
    height = 22,
    decorative = false,
    label,
    polarity = 'normal',
    loading = false,
    className,
    ...props
  },
  ref,
) {
  const scales = React.useMemo(
    () => seriesScales(points, width, height),
    [points, width, height],
  );
  const path = linePath(scales);
  const change = delta(points);

  if (loading) {
    return (
      <Skeleton variant="sparkline" data-slot="sparkline" className={className} />
    );
  }

  // One point cannot show a trend, and an empty box that still occupies the
  // column keeps the table from reflowing when a metric starts mid-window.
  if (!path) {
    return (
      <span
        aria-hidden
        data-slot="sparkline-empty"
        className={cn('inline-block align-middle', className)}
        // ponytail: intrinsic sizing on a placeholder is the one thing Tailwind
        // cannot express for arbitrary caller-supplied numbers.
        style={{ width, height }}
      />
    );
  }

  // Past the guard above, `path` is non-empty, which means ≥2 numeric points,
  // which is exactly the condition under which `delta()` returns a value. The
  // assertion documents that invariant instead of adding a `?? 'flat'` fallback
  // that no input can ever reach — an unreachable default is a lie the coverage
  // report has to be argued with.
  const direction = change!.direction;
  const TONE = {
    good: 'text-viz-positive',
    bad: 'text-viz-negative',
    flat: 'text-viz-neutral',
  } as const;
  const tone = TONE[toneFor(direction, polarity)];
  const last = scales.points.length - 1;

  return (
    <svg
      ref={ref}
      data-slot="sparkline"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-direction={direction}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('inline-block align-middle overflow-visible', tone, className)}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': describeSeries(points, label) })}
      {...props}
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} />
      {/* The end cap is the "you are here" — without it a sparkline reads
          equally in both directions at a glance. */}
      <circle cx={scales.x(last)} cy={scales.y(scales.points[last].v)} r={1.8} fill="currentColor" />
    </svg>
  );
});
