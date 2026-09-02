import * as React from 'react';

import { cn } from '@/lib/utils';
import { delta as computeDelta, type Direction, type Point } from '@/components/ui/charts/scale';

export const MIN_VIEWPORT = 320 as const;

/** Which direction counts as good. Latency and cost are `inverse`. */
export type Polarity = 'normal' | 'inverse';

const GLYPH: Record<Direction, string> = { up: '▲', down: '▼', flat: '–' };

const TONE: Record<'good' | 'bad' | 'flat', string> = {
  good: 'text-viz-positive',
  bad: 'text-viz-negative',
  flat: 'text-viz-neutral',
};

/** Exported so tests and callers agree on the mapping rather than re-deriving it. */
export function toneFor(direction: Direction, polarity: Polarity): 'good' | 'bad' | 'flat' {
  if (direction === 'flat') return 'flat';
  const isGood = polarity === 'normal' ? direction === 'up' : direction === 'down';
  return isGood ? 'good' : 'bad';
}

export interface DeltaProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  points: readonly Point[];
  polarity?: Polarity;
  /** Show the percentage alongside the absolute change. */
  percent?: boolean;
  /** Noun for the accessible sentence — "views", "downloads". */
  unit?: string;
}

export const Delta = React.forwardRef<HTMLSpanElement, DeltaProps>(function Delta(
  { points, polarity = 'normal', percent = true, unit, className, ...props },
  ref,
) {
  const change = React.useMemo(() => computeDelta(points), [points]);

  if (!change) {
    return (
      <span
        ref={ref}
        data-slot="delta-empty"
        className={cn('whitespace-nowrap text-viz-neutral tabular-nums', className)}
        {...props}
      >
        <span aria-hidden>–</span>
        <span className="sr-only">Not enough data to compare</span>
      </span>
    );
  }

  const tone = toneFor(change.direction, polarity);
  const sign = change.direction === 'up' ? '+' : change.direction === 'down' ? '−' : '';
  const magnitude = Math.abs(change.abs).toLocaleString();
  const pct = change.pct === null ? null : `${Math.abs(change.pct).toFixed(1)}%`;

  const spoken =
    change.direction === 'flat'
      ? `unchanged${unit ? ` ${unit}` : ''}`
      : `${change.direction} ${magnitude}${unit ? ` ${unit}` : ''}` +
        `${pct ? `, ${pct}` : ''}, from ${change.from.toLocaleString()} to ${change.to.toLocaleString()}`;

  return (
    <span
      ref={ref}
      data-slot="delta"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-direction={change.direction}
      data-tone={tone}
      // Plain inline — NOT inline-flex, NOT inline-block. Both are
      // shrink-to-fit boxes, and inside a `<td>` both resolved their width
      // against the cell's in-progress width and collapsed to
      // `offsetWidth: 0` while the text measured 113px: the digits rendered
      // outside their own box and overlapped the neighbouring column. An
      // inline box has no width of its own to get wrong — it is just text in
      // the line box, which is what this always was. Flex for two adjacent
      // spans was over-engineering that bought a layout bug.
      className={cn('whitespace-nowrap tabular-nums', TONE[tone], className)}
      {...props}
    >
      {/* Glyph and digits are decorative duplicates of the sentence below —
          announcing "▲ + 1 2 4" before the sentence is worse than silence. */}
      <span aria-hidden className="mr-1 text-[0.75em] leading-none">
        {GLYPH[change.direction]}
      </span>
      <span aria-hidden>
        {sign}
        {magnitude}
        {percent && pct ? ` (${sign}${pct})` : ''}
      </span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
});
