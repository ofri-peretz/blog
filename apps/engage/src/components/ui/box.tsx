import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const boxVariants = cva('', {
  variants: {
    /** Background + paired foreground (AA token pairs). */
    surface: {
      none: '',
      card: 'bg-card text-card-foreground',
      muted: 'bg-muted text-muted-foreground',
      accent: 'bg-accent text-accent-foreground',
    },
    /** Padding from the foundation --spacing scale (8/16/24/40/64px). */
    padding: {
      none: '',
      xs: 'p-xs',
      sm: 'p-sm',
      md: 'p-md',
      lg: 'p-lg',
      xl: 'p-xl',
    },
    /** Corner radius from the foundation 3-step scale (8/12/16px). */
    radius: {
      none: 'rounded-none',
      sm: 'rounded-sm',
      md: 'rounded-md',
      lg: 'rounded-lg',
    },
    /** 1px token border. */
    border: {
      true: 'border border-border',
      false: '',
    },
  },
  defaultVariants: {
    surface: 'none',
    padding: 'none',
    radius: 'none',
    border: false,
  },
});

interface BoxProps
  extends React.ComponentProps<'div'>, VariantProps<typeof boxVariants> {
  /** Render as a different element (e.g. `section`, `article`, `ul`). Default `div`. */
  as?: React.ElementType;
}

/** Surface + box-model wrapper. Server component (no hooks). */
function Box({
  className,
  surface,
  padding,
  radius,
  border,
  as,
  ...props
}: BoxProps) {
  const Tag = (as ?? 'div') as React.ElementType;
  return (
    <Tag
      data-slot="box"
      data-surface={surface ?? undefined}
      className={cn(
        boxVariants({ surface, padding, radius, border }),
        className,
      )}
      {...props}
    />
  );
}

export { Box, boxVariants };
export type { BoxProps };
