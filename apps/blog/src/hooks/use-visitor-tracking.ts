"use client";

import { useCallback } from "react";
import { usePostHog } from "posthog-js/react";

// CTA click tracking, on PostHog — the app's one analytics pipeline (see
// #interlace/components/analytics/posthog-provider.tsx, mounted at the
// root layout). Previously posted to /api/track, which only console.logged
// the event and persisted nothing durable — fake telemetry that looked
// like it worked but produced no queryable data.
export function useVisitorTracking() {
  const posthog = usePostHog();

  const track = useCallback(
    (eventType: string, metadata?: Record<string, string>) => {
      if (!posthog) return; // PostHog not initialized (e.g. no project key)
      try {
        posthog.capture(eventType, {
          page:
            typeof window !== "undefined" ? window.location.pathname : "/",
          referrer: typeof document !== "undefined" ? document.referrer : "",
          ...metadata,
        });
      } catch (e) {
        console.debug("[tracking]", e);
      }
    },
    [posthog],
  );

  const trackPageView = useCallback(() => track("pageview"), [track]);
  const trackLinkedInClick = useCallback(
    () => track("linkedin_click"),
    [track],
  );
  const trackGitHubClick = useCallback(() => track("github_click"), [track]);
  const trackResumeClick = useCallback(() => track("resume_click"), [track]);
  const trackContactClick = useCallback(() => track("contact_click"), [track]);

  return {
    track,
    trackPageView,
    trackLinkedInClick,
    trackGitHubClick,
    trackResumeClick,
    trackContactClick,
  };
}
