"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavLink {
  href: string;
  label: string;
}

interface MobileNavProps {
  links: NavLink[];
}

export function MobileNav({ links }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        data-slot="mobile-nav-trigger"
        aria-label="Open navigation menu"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted sm:hidden"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" data-slot="mobile-nav-content">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <nav aria-label="Mobile navigation" className="px-4 pb-6">
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <SheetClose
                  render={
                    <Link
                      href={link.href}
                      className="block rounded-md px-3 py-2 text-base font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      {link.label}
                    </Link>
                  }
                />
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
