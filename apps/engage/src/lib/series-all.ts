import "server-only";

/**
 * The barrel — import THIS, never `@/lib/series` directly.
 *
 * Source modules register themselves (catalog entries + loader) as an import
 * side effect, so `CATALOG` and `loadAll()` are only complete once every source
 * module has been evaluated. Importing the core module directly gives you
 * whichever subset happened to be loaded by something else first: the catalog
 * would be missing series, `definition()` would return undefined for ids that
 * do exist, and the route would answer "unknown series" for a perfectly valid
 * PostHog id — intermittently, depending on import order.
 *
 * Adding a source is therefore two lines: the module, and its import here.
 */
import "@/lib/series-posthog";
import "@/lib/series-npm";
import "@/lib/series-adoption";
import "@/lib/series-standing";
import "@/lib/series-yield";
import "@/lib/series-devto";

export * from "@/lib/series";
