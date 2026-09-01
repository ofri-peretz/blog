"use client";

import * as React from "react";

import { LintPlayground } from "@/components/ui/lint-playground";
import { toggleVariants } from "@/components/ui/toggle";
import { track } from "@/lib/analytics";
import { LINT_EMBEDS } from "@/lib/lint-embeds";
import { makeBrowserLint } from "@/lib/lint-client";

/**
 * The live-lint embed: the reader runs OUR published rule on their own
 * code, in their browser, inside the article that argues for it.
 *
 * The analyzer bundle (362 KB brotli over the wire, measured 2026-08-31:
 * eslint's linter + the plugins)
 * sits behind an explicit gate — an article page pays nothing for the
 * playground until someone asks for it, and the gate label is honest
 * about the weight. Two funnel events: `article:playground_open` when
 * the gate is clicked, `article:playground_edit` once, on the first
 * lint AFTER the mount lint — i.e. the reader actually changed the
 * code, the engagement the flagship exists to create.
 */
export function ArticlePlayground({ currentSlug }: { currentSlug: string }) {
  const def = LINT_EMBEDS.find((d) => d.slug === currentSlug);
  const [open, setOpen] = React.useState(false);
  const lints = React.useRef(0);

  if (!def) return null;

  return (
    <section
      id="playground"
      data-slot="article-playground"
      aria-label={def.title}
      // scroll-mt clears the sticky header when a Dev.to reader arrives on
      // the #playground deep link — the whole point of the crossing is that
      // they land ON the thing, not above it.
      className="mt-12 scroll-mt-24 border-t border-border pt-8"
    >
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        {def.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{def.invite}</p>
      <div className="mt-4">
        {open ? (
          <LintPlayground
            data-testid="article-playground"
            label={def.title}
            initialCode={def.initialCode}
            lint={(code) => {
              lints.current += 1;
              // Call 1 is the mount lint of the sample; call 2 is the
              // first DEBOUNCED result of an actual edit.
              if (lints.current === 2) {
                track("article:playground_edit", { slug: currentSlug });
              }
              return makeBrowserLint(def.pluginId, def.rules)(code);
            }}
          />
        ) : (
          <button
            type="button"
            data-testid="article-playground-open"
            className={toggleVariants({ variant: "pill", size: "xs" })}
            onClick={() => {
              track("article:playground_open", { slug: currentSlug });
              setOpen(true);
            }}
          >
            Try it live — loads the linter in your browser (362 KB)
          </button>
        )}
      </div>
    </section>
  );
}
