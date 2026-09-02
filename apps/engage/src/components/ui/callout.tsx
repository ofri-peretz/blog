import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  CircleCheck,
  Info,
  Lightbulb,
  OctagonAlert,
  TriangleAlert,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Typography } from '@/components/ui/typography';

/**
 * Minimum viable viewport (CSS px) for this primitive. Below it, preflight
 * draws a dev-mode outline; in prod the component still renders. Exported
 * so consumers / tests can read it.
 */
export const MIN_VIEWPORT = 320 as const;

const calloutVariants = cva(
  // Base — flex row, icon left, text column right; 4px left border via
  // `border-l-4`; padding from the spacing scale; rounded-md from radius
  // tokens. Card-tint surface so the callout reads as a block in prose.
  [
    'flex items-start gap-sm',
    'rounded-md border border-border border-l-4 bg-card/40 p-md',
    '[&_[data-slot=callout-icon]]:size-5 [&_[data-slot=callout-icon]]:shrink-0',
  ].join(' '),
  {
    variants: {
      /**
       * Narrative tone. Drives the icon, the left-border color, and the
       * icon tint. Surface stays neutral so adjacent callouts don't fight
       * each other for attention.
       */
      tone: {
        info:
          'border-l-primary [&_[data-slot=callout-icon]]:text-primary',
        note:
          'border-l-accent-foreground [&_[data-slot=callout-icon]]:text-accent-foreground',
        success:
          'border-l-primary [&_[data-slot=callout-icon]]:text-primary',
        warn:
          'border-l-foreground [&_[data-slot=callout-icon]]:text-foreground',
        danger:
          'border-l-destructive [&_[data-slot=callout-icon]]:text-destructive',
      },
    },
    defaultVariants: {
      tone: 'info',
    },
  },
);

type CalloutTone = NonNullable<VariantProps<typeof calloutVariants>['tone']>;

/** Per-tone lucide icon. One source of truth; no consumer override. */
const TONE_ICON: Record<CalloutTone, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  info: Info,
  note: Lightbulb,
  success: CircleCheck,
  warn: TriangleAlert,
  danger: OctagonAlert,
};

interface CalloutProps
  extends Omit<React.ComponentProps<'div'>, 'title'>,
    VariantProps<typeof calloutVariants> {
  /**
   * Optional headline above the body. Renders as Typography variant=ui
   * font-medium. Note: overrides the native `<div title>` tooltip attribute
   * with a React node — the native tooltip is rarely useful on a Callout
   * and the visible heading wins.
   */
  title?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Inline-prose annotation. Server component (no hooks).
 *
 * Usage:
 *
 *   <Callout tone="warn" title="Heads up">
 *     This rule is type-aware and adds ~50ms to lint runs.
 *   </Callout>
 */
const Callout = React.forwardRef<HTMLDivElement, CalloutProps>(
  ({ className, tone, title, children, ...props }, ref) => {
    const resolvedTone: CalloutTone = tone ?? 'info';
    const Icon = TONE_ICON[resolvedTone];

    return (
      <div
        ref={ref}
        role="note"
        data-slot="callout"
        data-min-viewport={String(MIN_VIEWPORT)}
        data-tone={resolvedTone}
        className={cn(calloutVariants({ tone }), className)}
        {...props}
      >
        <Icon data-slot="callout-icon" aria-hidden />
        <div data-slot="callout-body" className="min-w-0 flex-1">
          {title ? (
            <Typography
              as="p"
              variant="ui"
              className="font-medium"
              data-slot="callout-title"
            >
              {title}
            </Typography>
          ) : null}
          {children}
        </div>
      </div>
    );
  },
);
Callout.displayName = 'Callout';

export { Callout, calloutVariants };
export type { CalloutProps, CalloutTone };
