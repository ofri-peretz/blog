import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Minimum viable viewport (CSS px) for this primitive. Below it, the
 * preflight contract draws a dev-mode outline; in prod the component
 * still renders. Exported so consumers / tests can read it.
 */
export const MIN_VIEWPORT = 320 as const;

const tagVariants = cva(
  [
    // Pill anchor — rounded-full border, compact padding, small UI type.
    //
    // `bg-background` belongs to the base, not to a tone, because EVERY tone
    // below names a foreground and none of them named a surface. Transparent,
    // a tag took whatever it was dropped on: `tone="primary"` inside a
    // `<CTASection tone="primary">` was `text-primary` on `bg-primary`, i.e.
    // 1.00:1, and `default` was 2.23:1 light / 1.44:1 dark. Painting the
    // surface here keeps the whole tone API intact — each tone is once again
    // measured against the background it was designed for — and costs one
    // class instead of a redesign. Locked by composite-contrast-lock.
    'inline-flex items-center rounded-full border border-border bg-background',
    'px-2.5 py-0.5 text-xs',
    'transition-colors',
    // Brand-accent hover lift (only on the interactive surface).
    'hover:border-primary/60',
    // Standard focus ring contract.
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  ].join(' '),
  {
    variants: {
      /**
       * Tone of the chip surface. `default` inherits page foreground;
       * `primary` lifts to the brand foreground; `muted` drops to the
       * muted-foreground token for low-emphasis taxonomy (e.g. dates).
       */
      tone: {
        default: 'text-foreground',
        primary: 'text-primary',
        muted: 'text-muted-foreground',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  },
);

interface TagProps
  extends Omit<React.ComponentProps<'a'>, 'href'>,
    VariantProps<typeof tagVariants> {
  /**
   * Destination — required in the idle state because Tag is always a
   * link, never a button. Optional when `loading={true}` (the skeleton
   * has no link to render).
   */
  href?: string;
  /**
   * When true, render a `<Skeleton variant="tag" />` (h-5 w-12 rounded
   * pill) in place of the chip. Shape-matched so tag clusters stay
   * aligned during data load.
   */
  loading?: boolean;
}

/** A single tag chip. Server component (no hooks). */
const Tag = React.forwardRef<HTMLAnchorElement, TagProps>(
  ({ className, tone, href, loading, children, ...props }, ref) => {
    if (loading) {
      return (
        <Skeleton
          variant="tag"
          data-slot="tag"
          data-min-viewport={String(MIN_VIEWPORT)}
          className={className}
        />
      );
    }
    return (
      <a
        ref={ref}
        href={href}
        data-slot="tag"
        data-min-viewport={String(MIN_VIEWPORT)}
        data-tone={tone ?? undefined}
        className={cn(tagVariants({ tone }), className)}
        {...props}
      >
        {children}
      </a>
    );
  },
);
Tag.displayName = 'Tag';

/**
 * One item in a {@link TagList}. Carries the destination + label and an
 * optional per-item tone override.
 */
export interface TagListItem {
  label: React.ReactNode;
  href: string;
  tone?: VariantProps<typeof tagVariants>['tone'];
}

interface TagListProps extends React.ComponentProps<'ul'> {
  /** The chips to render. Each item maps to one `<li>` → `Tag`. */
  items: TagListItem[];
}

/**
 * A wrapping cluster of {@link Tag} chips. Renders as an unordered list
 * for assistive-tech list semantics; visually a `flex-wrap` row with
 * `gap-2` rhythm. Server component (no hooks).
 */
const TagList = React.forwardRef<HTMLUListElement, TagListProps>(
  ({ className, items, ...props }, ref) => {
    return (
      <ul
        ref={ref}
        data-slot="tag-list"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn('flex flex-wrap gap-2', className)}
        {...props}
      >
        {items.map((item) => (
          <li key={item.href}>
            <Tag href={item.href} tone={item.tone}>
              {item.label}
            </Tag>
          </li>
        ))}
      </ul>
    );
  },
);
TagList.displayName = 'TagList';

export { Tag, TagList, tagVariants };
export type { TagProps, TagListProps };
