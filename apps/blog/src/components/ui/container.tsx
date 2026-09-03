import * as React from "react";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * `<Container>` — width contract from LAYOUT_PHILOSOPHY.md §2.
 *
 * Four sizes only, mapped to fixed max-widths. Mixing ad-hoc `max-w-3xl` /
 * `max-w-5xl` is forbidden in app code.
 *
 *   | size      | max-width | Use                                  |
 *   | --------- | --------- | ------------------------------------ |
 *   | `prose`   | 52ch      | Long-form text (rule docs, articles) |
 *   | `content` | 1024px    | Default for landing sections         |
 *   | `wide`    | 1280px    | Card-grid heavy sections             |
 *   | `full`    | none      | Full-bleed hero, decorative bands    |
 *
 * Owns the responsive horizontal padding scale: `px-4 sm:px-6 lg:px-8`
 * (LAYOUT_PHILOSOPHY §5).
 */

const containerVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    size: {
      // 52ch, not 65ch — and the two are not the unit you think. `ch` is the
      // advance of the ZERO glyph, which in Geist is 1.418x the average glyph
      // in English prose, so `65ch` rendered ~85 characters per line. The
      // comfortable range is 45-75 (docs/TYPOGRAPHY.md).
      //
      // 52ch was MEASURED, not derived: counted characters on rendered lines
      // at 65/52/50/48/46/44ch and took the value that landed nearest 66.
      // Mobile is untouched — below the breakpoint the viewport binds before
      // this max-width does, and the count stayed at 47 for every value tried.
      prose: "max-w-[52ch]",
      content: "max-w-[1024px]",
      wide: "max-w-[1280px]",
      full: "max-w-none px-0 sm:px-0 lg:px-0",
    },
  },
  defaultVariants: {
    size: "content",
  },
});

type ContainerProps = React.ComponentProps<"div"> &
  VariantProps<typeof containerVariants> & {
    render?: useRender.RenderProp;
  };

function Container({ className, size, render, ...props }: ContainerProps) {
  const element = useRender({
    render: render ?? <div />,
    props: {
      "data-slot": "container",
      "data-size": size ?? undefined,
      className: cn(containerVariants({ size }), className),
      ...props,
    },
  });

  return element;
}

export { Container, containerVariants };
export type { ContainerProps };
