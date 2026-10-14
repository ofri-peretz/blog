// Pageview URL lock.
//
// PageviewTracker captures `$pageview` by hand on every route change. It once
// sent `$current_url` as `pathname?search`. On SPA navigations posthog-js adds
// `$prev_pageview_pathname` and splits off a heatmap event, and PostHog builds
// the previous page's scroll-depth entry with `new URL($current_url)`. A
// relative path throws there, so PostHog raised invalid_heatmap_data and
// dropped the scroll-depth data that `capture_heatmaps` is on for.
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const capture = vi.fn();
let pathname = "/articles/example";
let search = "";

vi.mock("posthog-js", () => ({
  default: { init: vi.fn(), register: vi.fn(), capture },
}));
vi.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
}));

afterEach(() => {
  capture.mockClear();
  vi.unstubAllEnvs();
  window.history.replaceState(null, "", "/");
});

async function renderProvider() {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  vi.resetModules();
  const { PostHogProvider } =
    await import("../../.interlace/components/analytics/posthog-provider");
  return render(<PostHogProvider app="blog">page</PostHogProvider>);
}

function pageviewUrls(): unknown[] {
  return capture.mock.calls
    .filter(([event]) => event === "$pageview")
    .map(([, props]) => (props as Record<string, unknown>)?.$current_url);
}

describe("$pageview carries an absolute $current_url", () => {
  it("sends the full location, query string included", async () => {
    pathname = "/articles/example";
    search = "ref=devto";
    window.history.replaceState(null, "", "/articles/example?ref=devto");
    await renderProvider();

    const urls = pageviewUrls();
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(window.location.href);
    expect(new URL(urls[0] as string).search).toBe("?ref=devto");
  });

  it("never sends a URL that new URL() rejects", async () => {
    pathname = "/";
    search = "";
    await renderProvider();

    for (const url of pageviewUrls()) {
      expect(typeof url).toBe("string");
      expect(() => new URL(url as string)).not.toThrow();
    }
  });
});
