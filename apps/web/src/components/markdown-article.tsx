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
