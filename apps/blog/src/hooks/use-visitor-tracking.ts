"use client";

import { useCallback } from "react";

export function useVisitorTracking() {
  const track = useCallback(
    async (eventType: string, metadata?: Record<string, string>) => {
      try {
        await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: eventType,
            page:
              typeof window !== "undefined" ? window.location.pathname : "/",
            referrer: typeof document !== "undefined" ? document.referrer : "",
            ...metadata,
          }),
        });
      } catch (e) {
        console.debug("[tracking]", e);
      }
    },
    [],
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
