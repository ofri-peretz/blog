"use client";

import * as React from "react";

import { CodeBlock } from "./ui/code-block";
import { track } from "@/lib/analytics";

/**
 * The article code surface: every fenced block renders through the
 * vendored DS CodeBlock — header bar with the language tag and the copy
 * affordance — wired to the blog's measurement.
 *
 * Receives the `pre` element props from the markdown pipeline's React
 * compiler. Shiki's own `<pre>` (inline light-theme background and all)
 * is deliberately dropped: the DS figure owns the box with theme
 * tokens, and the dark-mode token colours ride the per-span
 * `--shiki-dark` variables via the `[data-slot="code-block-pre"]`
 * selector in globals.css. The `<code>` child's span tree — the actual
 * highlighting — passes through untouched.
 *
 * `article:code_copy_click` fires only on a SUCCESSFUL clipboard write
 * (the DS onCopied seam) — copies, not clicks, are the receipt.
 */
export function ArticleCodeBlock({
  slug,
  children,
  ...preProps
}: React.ComponentProps<"pre"> & { slug: string }) {
  const code =
    React.isValidElement<React.ComponentProps<"code">>(children) &&
    children.type === "code"
      ? children
      : React.Children.toArray(children).find(
          (c): c is React.ReactElement<React.ComponentProps<"code">> =>
            React.isValidElement(c) && c.type === "code",
        );

  // A raw <pre> without a <code> child (article-embedded HTML) is not a
  // fenced block — leave it exactly as authored.
  if (!code) return <pre {...preProps}>{children}</pre>;

  const language =
    /language-([\w+-]+)/.exec(code.props.className ?? "")?.[1] ?? undefined;

  return (
    <CodeBlock
      language={language}
      data-testid="article-code-block"
      onCopied={() =>
        track("article:code_copy_click", { slug, language: language ?? null })
      }
    >
      {code.props.children}
    </CodeBlock>
  );
}
