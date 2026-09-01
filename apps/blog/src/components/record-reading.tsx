"use client";

import { useEffect } from "react";

import { recordReading } from "@/lib/reading-history";

/**
 * Adds this article to the reader's thread (reading-history.ts). A leaf
 * client component so the article page stays a server component —
 * renders nothing, records once per mount.
 */
export function RecordReading({ slug }: { slug: string }) {
  useEffect(() => {
    recordReading(slug);
  }, [slug]);
  return null;
}
