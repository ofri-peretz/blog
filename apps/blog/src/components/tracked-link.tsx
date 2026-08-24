"use client";

import Link from "next/link";
import { track, type BlogEvent } from "@/lib/analytics";

/**
 * Link that fires one typed analytics event on click.
 *
 * Exists so SERVER components (the article page's CTA callout, the
 * series pager) can attach typed events without becoming client
 * components themselves — only this leaf hydrates. Internal hrefs render
 * a Next <Link>; external ones a plain anchor with the safe rel.
 */
export function TrackedLink({
  href,
  event,
  props,
  className,
  children,
  ...rest
}: {
  href: string;
  event: BlogEvent["name"];
  props: BlogEvent["props"];
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  const external = href.startsWith("http");
  const onClick = () => track(event, props);
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
        {...rest}
      >
        {children}
      </a>
    );
  }
  return (
    // Next <Link> renders a native <a href> — Enter-activatable and
    // focusable by definition — but the rules can't see through the
    // component boundary. The plain-<a> branch above is (correctly) not
    // flagged, which is the proof of the FP.
    // eslint-disable-next-line react-a11y/click-events-have-key-events, react-a11y/interactive-supports-focus
    <Link href={href} className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}
