import { buildSearchDocs } from "@/lib/search-docs";
import { getAllArticles } from "@/lib/source";

/**
 * The grep-the-corpus index as a static build artifact. Serializing
 * the 82 docs into EVERY page's RSC payload cost a measured 16.7KB —
 * 11.2% of the homepage HTML — paid on every view for a palette most
 * visits never open. CorpusSearch fetches this once, on first intent.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(buildSearchDocs(getAllArticles()));
}
