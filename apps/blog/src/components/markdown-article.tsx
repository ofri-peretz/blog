import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeShiki from "@shikijs/rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSanitize, {
  defaultSchema,
  type Options as SanitizeOptions,
} from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import type { Root, RootContent } from "hast";
import { preprocessMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

interface MarkdownArticleProps extends React.HTMLAttributes<HTMLElement> {
  body: string;
  /** Stable selector for E2E tests; consumer provides — no default. */
  "data-testid"?: string;
}

// rehype-sanitize schema: defaults plus the bits Shiki + GFM emit (class on
// span/code/pre for highlight tokens, id on headings for anchors, data-* on
// figure/code, and the standard "language-*" code-block class). Keep this
// list narrow — it's the article rendering trust boundary.
const sanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] ?? []),
      "id",
      "className",
      "style",
    ],
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    pre: [...(defaultSchema.attributes?.pre ?? []), "className", "tabIndex"],
    span: [...(defaultSchema.attributes?.span ?? []), "className", "style"],
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      "ariaHidden",
      "ariaLabel",
      ["className", "anchor"],
    ],
    figure: [...(defaultSchema.attributes?.figure ?? []), "dataLanguage"],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "figure",
    "figcaption",
    "details",
    "summary",
    "mark",
  ],
};

/**
 * Makes prose tables keyboard-scrollable.
 *
 * 72 of 78 articles contain a markdown table, and a wide one used to push the
 * whole DOCUMENT sideways on narrow viewports — measured at 320px, the page
 * scrolled 53px. The CSS half of the fix lives in globals.css (`display:block`
 * + `overflow-x:auto`, which keeps the column grid intact); this half supplies
 * the part CSS cannot: a scroll container that is not focusable is unreachable
 * by keyboard, which is WCAG 2.1.1 (Level A).
 *
 * Runs AFTER rehypeSanitize deliberately — like rehypeSlug and rehypeShiki
 * above — because this is our own generated markup, not article input.
 *
 * The visitor is inline rather than unist-util-visit: that package is only a
 * TRANSITIVE dependency here, so importing it would break on a dependency bump.
 * Six lines is cheaper than that risk.
 */
function rehypeScrollableTables() {
  return (tree: Root) => {
    const walk = (node: Root | RootContent): void => {
      if (node.type === "element" && node.tagName === "table") {
        node.properties = { ...(node.properties ?? {}), tabIndex: 0 };
      }
      if ("children" in node) {
        for (const child of node.children) walk(child);
      }
    };
    walk(tree);
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  // allowDangerousHtml + rehypeRaw lets us parse inline HTML in trusted
  // article markdown; rehype-sanitize below enforces the allowlist before
  // we serialize.
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, {
    behavior: "wrap",
    properties: { className: ["anchor"], ariaHidden: "true" },
  })
  .use(rehypeShiki, {
    themes: { light: "github-light", dark: "github-dark" },
  })
  .use(rehypeScrollableTables)
  .use(rehypeStringify);

export async function MarkdownArticle({
  body,
  className,
  "data-testid": testId,
  ...rest
}: MarkdownArticleProps) {
  const processed = preprocessMarkdown(body);
  const file = await processor.process(processed);
  const html = String(file);

  return (
    <article
      data-slot="markdown-article"
      data-testid={testId}
      className={cn(
        "prose prose-neutral dark:prose-invert max-w-none prose-pre:rounded-md prose-pre:bg-transparent prose-code:before:hidden prose-code:after:hidden prose-a:[&.anchor]:no-underline",
        className,
      )}
      // HTML is sanitized via rehype-sanitize before serialization.
      dangerouslySetInnerHTML={{ __html: html }}
      {...rest}
    />
  );
}
