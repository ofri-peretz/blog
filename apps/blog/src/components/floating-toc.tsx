"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon, ListIcon } from "lucide-react";
import { motion } from "motion/react";
import { Popover } from "@base-ui-components/react/popover";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  label: string;
  level?: number;
}

/**
 * The lint run — which sections count as READ. Honest semantics: a
 * section is read when the reader has moved PAST it (some later section
 * has been active), never merely opened; the last section needs the
 * page end reached. Pure and exported for the lock.
 */
export function computeReadIds(
  items: readonly TocItem[],
  everActive: ReadonlySet<string>,
  reachedEnd: boolean,
): Set<string> {
  const read = new Set<string>();
  let maxActive = -1;
  items.forEach((item, i) => {
    if (everActive.has(item.id)) maxActive = i;
  });
  items.forEach((item, i) => {
    if (i < maxActive) read.add(item.id);
  });
  // Reaching the end reads everything — including the last section,
  // which "moved past" can never reach, and everything a reader who
  // scrolled straight to the footer flew by.
  if (reachedEnd) items.forEach((item) => read.add(item.id));
  return read;
}

interface FloatingTocProps extends React.HTMLAttributes<HTMLElement> {
  items: TocItem[];
  /** Render a "Scroll to top" control at the foot of the expanded list. */
  showScrollToTop?: boolean;
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

export function FloatingToc({
  items,
  showScrollToTop = true,
  className,
  "data-testid": testId,
  ...rest
}: FloatingTocProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // The lint run: sections the reader has been in (ever), and whether
  // the page end was reached — computeReadIds turns these into ✓s.
  const [everActive, setEverActive] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [reachedEnd, setReachedEnd] = useState(false);

  useEffect(() => {
    if (items.length === 0) return;
    const targets = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.id;
          setActiveId(id);
          setEverActive((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
          });
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [items]);

  // The last ✓ needs the page end: one passive listener that retires
  // itself the moment it fires.
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      if (window.scrollY + window.innerHeight >= doc.scrollHeight - 200) {
        setReachedEnd(true);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (items.length === 0) return null;

  const activeItem = items.find((item) => item.id === activeId) ?? null;
  const readIds = computeReadIds(items, everActive, reachedEnd);
  const allRead = items.length > 0 && readIds.size === items.length;

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
    // Deep-linkable: clicking a section updates the URL hash without a
    // navigation, so the address bar always reflects the reading spot.
    window.history.replaceState(null, "", `#${id}`);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setActiveId(null);
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  };

  const handleMobileSelect = (id: string) => {
    scrollTo(id);
    setMobileOpen(false);
  };

  return (
    <>
      <nav
        data-slot="floating-toc"
        data-testid={testId}
        aria-label="Section navigation"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setExpanded(false);
        }}
        className={cn(
          "fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 lg:block",
          className,
        )}
        {...rest}
      >
        <div
          className={cn(
            "rounded-2xl transition-[min-width,background-color,border-color,padding,box-shadow,backdrop-filter] duration-300 ease-out",
            expanded
              ? "min-w-56 border border-border bg-background/85 p-2 shadow-lg backdrop-blur-md"
              : "min-w-0 border border-transparent bg-transparent p-1",
          )}
        >
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const isActive = activeId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => scrollTo(item.id)}
                    aria-current={isActive ? "true" : undefined}
                    aria-label={expanded ? undefined : `Jump to ${item.label}`}
                    className={cn(
                      "group flex w-full items-center justify-end gap-3 rounded-md transition-colors",
                      expanded ? "px-2 py-1.5 hover:bg-muted/50" : "py-1.5",
                    )}
                  >
                    <span
                      aria-hidden={!expanded}
                      className={cn(
                        "flex-1 truncate text-left text-sm transition-[max-width,opacity] duration-300 ease-out",
                        expanded ? "max-w-xs opacity-100" : "max-w-0 opacity-0",
                        isActive
                          ? "font-medium text-foreground"
                          : "text-muted-foreground group-hover:text-foreground",
                        item.level && item.level > 1 && "pl-4",
                      )}
                    >
                      {/* The lint run: a section you've read past earns its
                          tick — the product's own voice as reading progress.
                          Decorative (aria-hidden); state, never motion. */}
                      {readIds.has(item.id) && (
                        <span
                          aria-hidden="true"
                          className="mr-1.5 font-mono text-brand-green"
                        >
                          ✓
                        </span>
                      )}
                      {item.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "relative block h-0.5 shrink-0 rounded-full transition-[width,background-color] duration-300 ease-out",
                        isActive
                          ? "w-6 bg-transparent"
                          : readIds.has(item.id)
                            ? "w-3 bg-brand-green/50 group-hover:w-5 group-hover:bg-brand-green"
                            : "w-3 bg-muted-foreground/40 group-hover:w-5 group-hover:bg-muted-foreground",
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="floating-toc-active-dash"
                          className="absolute inset-0 rounded-full bg-foreground"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 30,
                          }}
                        />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {allRead && (
            <div
              data-slot="floating-toc-lint-pass"
              className={cn(
                "overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out",
                expanded ? "mt-1 max-h-8 opacity-100" : "mt-0 max-h-0 opacity-0",
              )}
              aria-hidden={!expanded}
            >
              <p className="border-t border-border/60 pt-2 pb-1 text-center font-mono text-xs text-muted-foreground">
                <span aria-hidden="true">
                  <span className="text-brand-green">✓</span> 0 problems
                </span>
                <span className="sr-only">All sections read.</span>
              </p>
            </div>
          )}
          {showScrollToTop && (
            <div
              className={cn(
                "overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out",
                expanded
                  ? "mt-1 max-h-12 opacity-100"
                  : "mt-0 max-h-0 opacity-0",
              )}
              aria-hidden={!expanded}
            >
              <button
                type="button"
                onClick={scrollToTop}
                tabIndex={expanded ? 0 : -1}
                className="flex w-full items-center justify-center gap-2 rounded-md border-t border-border/60 pt-2 pb-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowUpIcon className="h-3 w-3" />
                <span>Scroll to top</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      <Popover.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Popover.Trigger
          aria-label="On this page — open section navigation"
          data-slot="floating-toc-mobile-trigger"
          className="fixed bottom-4 right-4 z-40 flex max-w-[min(80vw,18rem)] items-center gap-2 rounded-full border border-border bg-background/85 px-3.5 py-2 text-xs font-medium shadow-lg backdrop-blur-md transition-colors hover:bg-background lg:hidden"
        >
          <ListIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">On this page</span>
          {activeItem && (
            <>
              <span className="text-muted-foreground/60">·</span>
              <span className="truncate text-foreground">
                {activeItem.label}
              </span>
            </>
          )}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="top" align="end" sideOffset={8}>
            <Popover.Popup
              data-slot="floating-toc-mobile-popup"
              className="z-50 w-64 origin-(--transform-origin) rounded-2xl border border-border bg-background/95 p-2 text-sm shadow-xl outline-hidden backdrop-blur-md data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
            >
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const isActive = activeId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleMobileSelect(item.id)}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors",
                          isActive
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          item.level && item.level > 1 && "pl-6",
                        )}
                      >
                        <span className="truncate">{item.label}</span>
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
                {showScrollToTop && (
                  <li className="mt-1 border-t border-border/60 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        scrollToTop();
                        setMobileOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    >
                      <ArrowUpIcon className="h-3 w-3" />
                      Scroll to top
                    </button>
                  </li>
                )}
              </ul>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
