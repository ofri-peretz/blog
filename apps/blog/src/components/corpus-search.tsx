"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";

import {
  CommandPalette,
  CommandPaletteContent,
  CommandPaletteDescription,
  CommandPaletteEmpty,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteList,
  CommandPaletteShortcut,
  CommandPaletteTitle,
  CommandPaletteTrigger,
  useCommandPaletteHotkey,
} from "./ui/command-palette";
import { track } from "@/lib/analytics";
import { searchHaystack, type SearchDoc } from "@/lib/search-docs";

/**
 * Grep the corpus — the ⌘K surface over all published articles.
 *
 * A thin consumer of the vendored DS CommandPalette (which owns the
 * modal, the listbox ARIA, and the keyboard model — asserted upstream
 * by its Storybook keyboard lock). This wrapper only decides what the
 * blog searches (title + series + tags via `searchHaystack`), where a
 * selection goes (`/articles/[slug]`), and what gets measured.
 *
 * Terminal voice, zero new motion: the trigger reads `❯ grep ⌘K`, the
 * dialog opens instantly (the DS enter/exit utilities are inert here —
 * the blog ships no tw-animate layer, deliberately), and the rows are
 * plain text with a mono minutes hint. Quiet until engaged.
 *
 * Measurement: `quick_open:palette_view` carries only how it was opened
 * (hotkey vs button — do readers discover the chord?); the typed query
 * itself is never sent (aggregate-only analytics), and select carries
 * the destination slug alone.
 */
export function CorpusSearch({ docs }: { docs: SearchDoc[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  useCommandPaletteHotkey(() => {
    if (!open) track("quick_open:palette_view", { source: "hotkey" });
    setOpen(true);
  });

  return (
    <CommandPalette
      open={open}
      onOpenChange={(next) => {
        // Base UI reports intent here for the trigger click and for
        // every close path (Escape, backdrop, select). The hotkey path
        // sets state directly above, so an open arriving here is the
        // button.
        if (next && !open) track("quick_open:palette_view", { source: "button" });
        setOpen(next);
      }}
    >
      <CommandPaletteTrigger
        render={
          <button
            type="button"
            aria-label="Search articles"
            data-slot="corpus-search-trigger"
            className="inline-flex min-h-6 items-center gap-2 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <SearchIcon aria-hidden="true" className="size-4 sm:hidden" />
            <span className="hidden font-mono text-xs sm:flex sm:items-center sm:gap-1.5">
              <span aria-hidden="true">❯</span>
              grep
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans text-[10px]">
                ⌘K
              </kbd>
            </span>
          </button>
        }
      />
      <CommandPaletteContent
        items={docs}
        itemToStringLabel={searchHaystack}
        onValueChange={(doc: SearchDoc | null) => {
          if (!doc) return;
          track("quick_open:result_click", { to_slug: doc.slug });
          router.push(`/articles/${doc.slug}`);
        }}
      >
        {/* A modal without an accessible name is announced as "dialog"
            and nothing else — the title is required, visually hidden.
            div, not span: Title renders an h2 and Description a p, and
            block elements inside an inline span are invalid HTML
            (review). */}
        <div className="sr-only">
          <CommandPaletteTitle>Search articles</CommandPaletteTitle>
          <CommandPaletteDescription>
            Type to filter by title, series, or tag. Enter opens the
            article.
          </CommandPaletteDescription>
        </div>
        <CommandPaletteInput placeholder="grep articles…" />
        <CommandPaletteEmpty>No matches — 0 of {docs.length} articles.</CommandPaletteEmpty>
        <CommandPaletteList>
          {(doc: SearchDoc) => (
            <CommandPaletteItem key={doc.slug} value={doc}>
              <span className="min-w-0 flex-1 truncate">{doc.title}</span>
              {doc.series ? (
                <span className="hidden max-w-32 truncate text-xs text-muted-foreground sm:inline">
                  {doc.series}
                </span>
              ) : null}
              <CommandPaletteShortcut className="font-mono [font-variant-numeric:tabular-nums]">
                {doc.minutes} min
              </CommandPaletteShortcut>
            </CommandPaletteItem>
          )}
        </CommandPaletteList>
      </CommandPaletteContent>
    </CommandPalette>
  );
}
