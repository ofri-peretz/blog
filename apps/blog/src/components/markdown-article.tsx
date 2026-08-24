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
  /**
   * Pre-rendered pipeline output for `body`. Pass when the caller already
   * ran `renderMarkdown` (e.g. to extract a TOC) so the pipeline — Shiki
   * included — runs once per page, not twice.
   */
  renderedHtml?: string;
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

const BLOCKS = new Set(["p", "li", "td", "th", "dd", "dt", "figcaption"]);
const INLINE_WRAPPERS = new Set(["strong", "em", "b", "i", "code"]);

type HastLike = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastLike[];
  value?: string;
};

/**
 * Wraps prose tables in a scrollable, keyboard-reachable container.
 *
 * 72 of 78 articles carry a markdown table, and a wide one used to push the
 * whole DOCUMENT sideways — measured at 320px, the page scrolled 53px.
 *
 * The tempting fix is `display:block; overflow-x:auto` on the table itself.
 * It works visually — the column grid even survives — but in WebKit it strips
 * the implicit `role="table"` from the accessibility tree, so VoiceOver
 * announces a plain block and loses header associations, row/column counts and
 * table navigation. That trades a visual bug for a WCAG 1.3.1 one.
 *
 * Wrapping keeps the table a table. The wrapper carries tabIndex so keyboard
 * users can actually reach the scroll (WCAG 2.1.1), and a labelled region role
 * so its purpose is announced.
 *
 * Runs AFTER rehypeSanitize deliberately, like rehypeSlug and rehypeShiki:
 * this is our own generated markup, not article input.
 */
function rehypeScrollableTables() {
  // The parameter is `unknown` on purpose. Both `hast` and `unist` are SPECS,
  // not npm packages — their @types packages merely declare the module, so tsc
  // resolves such an import and every import resolver correctly cannot. An
  // `unknown` parameter satisfies unified's Plugin overload by contravariance
  // with no import at all.
  return (tree: unknown) => {
    const walk = (node: HastLike): void => {
      const children = node.children;
      if (!children) return;

      // A link is a STANDALONE target only when it is the block's entire
      // content. CSS cannot express that: `:only-child` counts ELEMENT
      // siblings and ignores text, so `<p>Read <strong><a>x</a></strong> now</p>`
      // matches `strong:only-child` and a genuinely inline link would be
      // inflated mid-sentence. Here the text nodes are visible, so the test is
      // exact. Marked links get 24x24 in globals.css (WCAG 2.2 SC 2.5.8).
      if (BLOCKS.has(node.tagName ?? "")) {
        const meaningful = children.filter(
          (c) => c.type !== "text" || (c.value ?? "").trim() !== "",
        );
        if (meaningful.length === 1) {
          let candidate = meaningful[0];
          if (
            candidate.type === "element" &&
            INLINE_WRAPPERS.has(candidate.tagName ?? "")
          ) {
            const inner = (candidate.children ?? []).filter(
              (c) => c.type !== "text" || (c.value ?? "").trim() !== "",
            );
            if (inner.length === 1) candidate = inner[0];
          }
          if (candidate.type === "element" && candidate.tagName === "a") {
            const props = (candidate.properties ??= {});
            // hast permits className as an array OR a space-separated string.
            // The array-only branch silently dropped a string value, so any
            // class another plugin had set would vanish.
            const existing = props.className;
            const prior = Array.isArray(existing)
              ? existing.map(String)
              : typeof existing === "string"
                ? existing.split(/\s+/).filter(Boolean)
                : [];
            if (!prior.includes("standalone-link")) prior.push("standalone-link");
            props.className = prior;
          }
        }
      }

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.type === "element" && child.tagName === "table") {
          children[i] = {
            type: "element",
            tagName: "div",
            properties: {
              className: ["prose-table-scroll"],
              tabIndex: 0,
              role: "region",
              "aria-label": "Table, scrollable",
            },
            children: [child],
          };
          walk(child);
          continue;
        }
        walk(child);
      }
    };
    walk(tree as HastLike);
  };
}

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const EXPLICIT_ID = /\s*\{#([A-Za-z][\w-]*)\}\s*$/;

/**
 * Honors the `## Heading {#custom-id}` markdown convention: strips the
 * marker from the visible text and applies it as the heading's id.
 *
 * Nothing in the pipeline handled this syntax, so 36 of the articles
 * rendered their anchors as literal `{#the-four-layers}` text in every
 * heading. Runs after rehypeSanitize (our own markup, same as
 * rehypeSlug) and BEFORE rehypeSlug, which skips headings that already
 * carry an id — so explicit anchors win and the rest keep slug ids.
 */
function rehypeExplicitHeadingIds() {
  return (tree: unknown) => {
    const walk = (node: HastLike): void => {
      const children = node.children;
      if (!children) return;
      if (node.type === "element" && HEADINGS.has(node.tagName ?? "")) {
        const last = children[children.length - 1];
        if (last?.type === "text" && typeof last.value === "string") {
          const match = last.value.match(EXPLICIT_ID);
          if (match) {
            const stripped = last.value.replace(EXPLICIT_ID, "");
            if (stripped === "") children.pop();
            else last.value = stripped.replace(/\s+$/, "");
            const props = (node.properties ??= {});
            if (props.id === undefined) props.id = match[1];
          }
        }
        return;
      }
      for (const child of children) walk(child);
    };
    walk(tree as HastLike);
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
  .use(rehypeExplicitHeadingIds)
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

/** The markdown -> HTML pipeline, exported so the rendering rules it applies
 *  can be tested without rendering a React server component. */
export async function renderMarkdown(body: string): Promise<string> {
  return String(await processor.process(preprocessMarkdown(body)));
}

export async function MarkdownArticle({
  body,
  renderedHtml,
  className,
  "data-testid": testId,
  ...rest
}: MarkdownArticleProps) {
  const html = renderedHtml ?? (await renderMarkdown(body));

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
