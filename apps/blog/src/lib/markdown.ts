/**
 * Preprocess Nuxt-MDC-style block directives in the blog markdown into plain
 * markdown that react-markdown can render. We intentionally keep this as a
 * surgical string-pass rather than a remark plugin because there are only two
 * directives and ~15 occurrences across the corpus.
 */

const INSTALL_RE =
  /^::install-command\{package="([^"]+)"(?: dev)?\}[ \t]*\n::/gm;

/*
 * The label may span several lines.
 *
 * This was `([^\n]+)`, which matches exactly ONE line before the closing
 * `::`. Four published articles hard-wrap their CTA label across two or three
 * lines, so the pattern never matched and the raw directive text —
 * `::dev-to-cta{url="…"}` and all — shipped verbatim onto the live page.
 * Nothing failed; the replace simply found nothing to replace, which is the
 * quietest way for a renderer to break.
 *
 * `[\s\S]*?` is lazy and anchored on `\n::`, so it still stops at the first
 * terminator and cannot run past one block into the next. The label is joined
 * to a single line below, because a Markdown link's text cannot contain a
 * newline — the wrapping is source formatting, never content.
 */
const CTA_RE = /^::dev-to-cta\{url="([^"]+)"\}[ \t]*\n([\s\S]*?)\n::/gm;

/**
 * `::playground-cta` is the ONLY directive that renders differently per
 * surface, and deliberately so.
 *
 * On Dev.to it becomes a link into the live playground, because Dev.to
 * cannot host one — and in 60 days exactly zero readers crossed from
 * dev.to to the blog, so the crossing needs an explicit invitation rather
 * than a canonical link nobody clicks.
 *
 * On the blog it renders NOTHING: `<ArticlePlayground>` is already on the
 * page. Inviting a reader to visit the thing they are looking at is noise.
 *
 * The Dev.to half lives in scripts/publish-to-devto.mjs, since that is
 * where every other body transform for that surface already happens.
 */
// The label line is REQUIRED, matching scripts/publish-to-devto.mjs exactly.
// When the blog treated it as optional and the publisher did not, a directive
// written without a label vanished on the blog and shipped to dev.to as raw
// `::playground-cta{...}` text — divergent, and visible only on the surface we
// look at least. Identical shapes mean a malformed directive fails the same
// way in both places. (Review caught this; it was right.)
export const PLAYGROUND_CTA_RE =
  /^::playground-cta\{slug="[^"]+"\}[ \t]*\n[^\n]+\n::[ \t]*$/gm;

export function preprocessMarkdown(input: string): string {
  return input
    .replace(
      INSTALL_RE,
      (_m, pkg) => `\`\`\`bash\nnpm install --save-dev ${pkg}\n\`\`\``,
    )
    .replace(
      CTA_RE,
      (_m, url, label) =>
        `**[${label.trim().replace(/\s*\n\s*/g, " ")}](${url})**`,
    )
    .replace(PLAYGROUND_CTA_RE, "");
}
