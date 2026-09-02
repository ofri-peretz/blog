import * as React from 'react';

import { cn } from '@/lib/utils';
import {
  DataStateBadge,
  type AnnouncementOptions,
  type DataStateFlags,
} from '@/components/ui/data-state';
import {
  announceDataState,
  HATCH_CLASS,
  resolveDataState,
} from '@/components/ui/data-state-model';
import {
  compactMagnitude,
  describeMeter,
  fillWidthClass,
  meterDomainMax,
  meterFraction,
  rankByValue,
  type MeterScaleKind,
} from '@/components/ui/meter-scale';
import { Skeleton } from '@/components/ui/skeleton';

export const MIN_VIEWPORT = 320 as const;

/**
 * How the bar is drawn.
 *
 *   - `default` — a real, live measurement.
 *   - `hatch`   — uncountable. No run happened. Chosen automatically when
 *                 `value` is `null`; naming it explicitly is for the case where
 *                 a number exists but must not be counted.
 *   - `dead`    — dormant. Real but no longer live; recedes without vanishing.
 */
export type MeterVariant = 'default' | 'hatch' | 'dead';

/** Which semantic the fill carries. Never the magnitude — only the meaning. */
export type MeterTone = 'default' | 'positive' | 'negative' | 'neutral';

const TONE_FILL: Record<MeterTone, string> = {
  default: 'bg-primary',
  positive: 'bg-viz-positive',
  negative: 'bg-viz-negative',
  neutral: 'bg-viz-neutral',
};

const SIZE_TRACK: Record<'sm' | 'md', string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
};

export interface MeterProps
  extends Omit<React.ComponentProps<'div'>, 'children'> {
  label: React.ReactNode;
  /**
   * The measurement. `null` means UNMEASURED and renders the hatch — it does
   * NOT render a zero-length bar, because a zero-length bar and a measured
   * zero are the same picture.
   */
  value: number | null;
  /**
   * The denominator. `null` or omitted means there is no stated maximum, so
   * no fraction can be computed and the bar draws as hatch — a bar without a
   * denominator is a length with no scale behind it.
   */
  max?: number | null;
  unit?: string;
  /** Linear (default) or logarithmic. Log must be labelled by the caller. */
  scale?: MeterScaleKind;
  /**
   * Override the computed fill fraction, `0..1`. For the odds-bar case where
   * the ratio being drawn is not `value / max` — e.g. a probability drawn
   * beside an absolute count.
   */
  fraction?: number | null;
  /** Printed magnitude. Defaults to a compact form of `value`. */
  display?: React.ReactNode;
  /** Second line under the bar — provenance, window, caveat. */
  note?: React.ReactNode;
  variant?: MeterVariant;
  tone?: MeterTone;
  size?: 'sm' | 'md';
  /** Absence flags for this row, over and above the value being `null`. */
  state?: DataStateFlags;
  announce?: AnnouncementOptions;
  loading?: boolean;
}

export const Meter = React.forwardRef<HTMLDivElement, MeterProps>(function Meter(
  {
    label,
    value,
    max = null,
    unit,
    scale = 'linear',
    fraction,
    display,
    note,
    variant,
    tone = 'default',
    size = 'md',
    state,
    announce,
    loading = false,
    className,
    ...props
  },
  ref,
) {
  if (loading) {
    return (
      <Skeleton
        variant="meter"
        data-slot="meter"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={className}
      />
    );
  }

  const computed =
    fraction === undefined ? meterFraction(value, max, scale) : fraction;

  // `hatch` is the default for an absent measurement, not an opt-in. Getting
  // this backwards is how the three hand-rolled bars each ended up drawing an
  // empty track for missing data.
  const resolvedVariant: MeterVariant =
    variant ?? (value === null || computed === null ? 'hatch' : 'default');

  const resolved = resolveDataState(
    {
      ...state,
      notCounted: state?.notCounted ?? (resolvedVariant === 'hatch' && value === null),
    },
    announce,
  );

  // The sentence reports the VALUE, not the bar. A row with a real number and
  // no denominator hatches (there is no scale to draw a length against) but it
  // is not unmeasured — saying "not measured" there would be the component
  // inventing an absence out of its own rendering decision.
  const spoken = describeMeter(
    typeof label === 'string' ? label : 'Value',
    value,
    max,
    unit,
  );

  const printed =
    display ??
    (value === null ? null : `${compactMagnitude(value)}${unit ? ` ${unit}` : ''}`);

  return (
    <div
      ref={ref}
      data-slot="meter"
      data-variant={resolvedVariant}
      data-tone={tone}
      data-state={resolved.state}
      data-scale={scale}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex w-full min-w-0 flex-col gap-1', className)}
      {...props}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        {/* `dead` does NOT dim the label. `--muted-foreground` is already the
            quietest text token that clears AA (5.66:1 light / 6.29:1 dark);
            `/70` on top measured 3.4:1 and axe caught it. A dormant row
            recedes in its FILL, which is non-text and free to be quiet — its
            label and its number stay as legible as every other row's, which
            is the honest treatment for a row that still holds its rank. */}
        <span className="min-w-0 break-words font-mono text-ui-sm uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {/* The number is not optional. It is the second carrier of magnitude
            and the only one that survives greyscale, a 40%-width screenshot
            and a screen reader. */}
        {printed === null ? (
          <DataStateBadge
            state={resolved.state === 'idle' ? 'not-counted' : resolved.state}
            announce={announce}
            className="shrink-0"
          />
        ) : (
          <span
            // `dir="auto"`: inside an RTL page the bidi algorithm reorders
            // "44 findings" to "findings 44", because the number is a neutral
            // run inside an RTL paragraph. `auto` resolves direction from the
            // first strong character — Latin unit → LTR, Arabic unit → RTL —
            // so a measurement keeps its own reading order either way.
            dir="auto"
            className={cn(
              'shrink-0 whitespace-nowrap font-body text-ui font-semibold tabular-nums',
              resolvedVariant === 'dead' && 'text-muted-foreground',
            )}
          >
            {printed}
          </span>
        )}
      </div>

      {resolvedVariant === 'hatch' ? (
        // No fill at all. A hatched track says "nothing ran here"; a track
        // with a zero-width fill says "we ran it and the answer was none".
        <div
          data-slot="meter-track"
          data-hatch
          aria-hidden
          className={cn(
            'w-full rounded-full border border-dashed border-border',
            SIZE_TRACK[size],
            HATCH_CLASS,
          )}
        />
      ) : (
        <div
          data-slot="meter-track"
          role="meter"
          aria-valuenow={value ?? 0}
          aria-valuemin={0}
          aria-valuemax={max ?? undefined}
          aria-valuetext={spoken}
          aria-label={typeof label === 'string' ? label : undefined}
          className={cn(
            'w-full overflow-hidden rounded-full bg-secondary',
            SIZE_TRACK[size],
          )}
        >
          <div
            data-slot="meter-fill"
            className={cn(
              'h-full rounded-full',
              resolvedVariant === 'dead'
                ? 'bg-muted-foreground/30'
                : TONE_FILL[tone],
              fillWidthClass(computed ?? 0),
            )}
          />
        </div>
      )}

      {note ? (
        <span className="font-body text-ui-sm leading-snug text-muted-foreground">
          {note}
        </span>
      ) : null}

      {/* The bar's geometry is aria-hidden or summarised; the sentence is what
          a screen reader actually gets, and it carries the real number rather
          than the projection of it. */}
      <span className="sr-only">
        {spoken}
        {resolved.qualifiers.length > 0
          ? ` ${resolved.qualifiers
              .map((name) => announceDataState(name, announce))
              .join(' ')}`
          : ''}
      </span>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────
// RankedBarList — the repeated-row composition
// ─────────────────────────────────────────────────────────────────

export interface RankedBarRow {
  key: string;
  label: React.ReactNode;
  /** `null` = unmeasured. It keeps its row and its rank; it does not become 0. */
  value: number | null;
  unit?: string;
  note?: React.ReactNode;
  variant?: MeterVariant;
  tone?: MeterTone;
  state?: DataStateFlags;
  display?: React.ReactNode;
}

export interface RankedBarListProps
  extends Omit<React.ComponentProps<'section'>, 'children'> {
  rows: readonly RankedBarRow[];
  /** Visible caption. Also the list's accessible name. */
  caption?: React.ReactNode;
  /**
   * The shared denominator. Omit and it is the largest MEASURED value —
   * `null`s are skipped rather than counted as zero, so an all-unmeasured list
   * yields no domain and every row hatches.
   */
  max?: number | null;
  scale?: MeterScaleKind;
  /**
   * `descending` (default) sorts by value with unmeasured rows last;
   * `given` keeps the caller's order, for a list whose order is the argument.
   */
  order?: 'descending' | 'given';
  size?: 'sm' | 'md';
  /**
   * List-wide absence. `truncated` is the one to reach for: it is the state
   * that stops a top-10 from being read as a denominator.
   */
  state?: DataStateFlags;
  announce?: AnnouncementOptions;
  loading?: boolean;
  /** Rows to reserve while loading. */
  loadingRows?: number;
}

export const RankedBarList = React.forwardRef<HTMLElement, RankedBarListProps>(
  function RankedBarList(
    {
      rows,
      caption,
      max,
      scale = 'linear',
      order = 'descending',
      size = 'md',
      state,
      announce,
      loading = false,
      loadingRows = 5,
      className,
      ...props
    },
    ref,
  ) {
    const list = resolveDataState({ ...state, loading }, announce);

    if (list.state === 'loading') {
      return (
        <Skeleton
          variant="meter"
          count={loadingRows}
          data-slot="ranked-bar-list"
          data-min-viewport={String(MIN_VIEWPORT)}
          className={className}
        />
      );
    }

    const ordered = order === 'descending' ? rankByValue(rows) : [...rows];
    const domain =
      max === undefined || max === null
        ? meterDomainMax(rows.map((row) => row.value))
        : max;

    return (
      <section
        ref={ref}
        data-slot="ranked-bar-list"
        data-state={list.state}
        data-scale={scale}
        data-qualifiers={list.qualifiers.join(' ') || undefined}
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('flex w-full min-w-0 flex-col gap-4', className)}
        {...props}
      >
        {caption || scale === 'log' || list.state !== 'idle' ? (
          <div className="flex flex-wrap items-center gap-2">
            {caption ? (
              <p className="font-mono text-ui-sm uppercase tracking-wide text-muted-foreground">
                {caption}
              </p>
            ) : null}
            {/* A log axis that is not labelled is an argument disguised as a
                measurement: it flatters every small row on the list. */}
            {scale === 'log' ? (
              <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-ui-sm leading-none text-muted-foreground">
                log scale
              </span>
            ) : null}
            {list.active
              .filter((name) => name !== 'idle')
              .map((name) => (
                <DataStateBadge key={name} state={name} announce={announce} />
              ))}
          </div>
        ) : null}

        {ordered.map((row) => (
          <Meter
            key={row.key}
            label={row.label}
            value={row.value}
            max={domain}
            unit={row.unit}
            note={row.note}
            display={row.display}
            variant={row.variant}
            tone={row.tone}
            size={size}
            scale={scale}
            state={row.state}
            announce={announce}
          />
        ))}
      </section>
    );
  },
);
