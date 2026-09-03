import { NextResponse } from "next/server";
import {
  impact,
  pluginFindings,
  promotion,
  commenters,
  siteVitals,
  siteErrors,
} from "@/lib/sources";
import { history } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 240;

export async function GET() {
  const [imp, promo, comm, vitals, errors] = await Promise.all([
    impact(),
    promotion(),
    commenters(),
    siteVitals(),
    siteErrors(),
  ]);
  const plugins = pluginFindings();
  return NextResponse.json({
    impact: imp,
    // The newest ingest row is the source time for everything read off Supabase here.
    asOf:
      (imp as any)?.rows?.reduce(
        (m: string | null, r: any) => (r?.observed_on && (!m || String(r.observed_on) > m) ? String(r.observed_on) : m),
        null,
      ) ?? null,
    commenters: comm,
    promotion: promo,
    plugins,
    // Site health from PostHog. Deliberately alongside `plugins`: both answer
    // "what is broken right now", one from static analysis before ship and one
    // from real browsers after it.
    vitals,
    errors,
    history: history(60),
  });
}
