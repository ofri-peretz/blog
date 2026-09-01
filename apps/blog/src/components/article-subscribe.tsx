"use client";

import * as React from "react";

import { NewsletterForm } from "@/components/ui/newsletter-form";
import { subscribe, type SubscribeState } from "@/app/actions/subscribe";
import { track } from "@/lib/analytics";

/**
 * The end-of-article signup.
 *
 * The DS owns the form's structure, a11y and honeypot; this owns the two
 * things an app must own — where the submission goes, and what the reader is
 * told afterwards. `useActionState` supplies the pending and result states
 * the DS component deliberately has no opinion about.
 *
 * NewsletterForm renders its OWN `<form>` (it extends ComponentProps<'form'>
 * and spreads onto it), so the action is passed as a prop rather than by
 * wrapping it — nesting a second `<form>` around it would be invalid HTML
 * and browsers drop the inner one.
 *
 * Placed after the playground, where a reader who finished has already shown
 * interest. Explicitly not a popup: on a site whose whole argument is that we
 * do careful work, an interstitial contradicts the pitch harder than it
 * converts.
 */
export function ArticleSubscribe({ currentSlug }: { currentSlug: string }) {
  // The slug rides along as a form field rather than a hidden input, because
  // NewsletterForm has no slot for extra fields inside its own <form>.
  const action = React.useCallback(
    (prev: SubscribeState, formData: FormData) => {
      formData.set("source_slug", currentSlug);
      return subscribe(prev, formData);
    },
    [currentSlug],
  );

  const [state, formAction, pending] = React.useActionState<SubscribeState, FormData>(
    action,
    { status: "idle" },
  );

  const fired = React.useRef(false);
  React.useEffect(() => {
    // Once per mount, on the first settled OK — not on submit. A submit that
    // fails validation is not a subscription, and counting it would inflate
    // the only number this feature has.
    if (state.status === "ok" && !fired.current) {
      fired.current = true;
      track("newsletter:subscribe", { slug: currentSlug });
    }
  }, [state.status, currentSlug]);

  if (state.status === "ok") {
    return (
      <section
        data-slot="article-subscribe"
        data-testid="article-subscribe-done"
        className="mt-12 border-t border-border pt-8"
      >
        <p className="text-sm text-muted-foreground" role="status">
          {state.message}
        </p>
      </section>
    );
  }

  return (
    <section
      data-slot="article-subscribe"
      className="mt-12 border-t border-border pt-8"
    >
      <NewsletterForm
        action={formAction}
        data-testid="article-subscribe"
        title="What the rules caught this month"
        description="Occasional notes on what our ESLint rules found in real code — new detections, false positives we fixed, and benchmark results. No cadence promises we can't keep."
        submitLabel={pending ? "Subscribing…" : "Subscribe"}
        footer="No spam. Unsubscribe any time."
      />
      {state.status === "error" ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
