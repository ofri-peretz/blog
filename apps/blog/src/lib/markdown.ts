/**
 * Preprocess Nuxt-MDC-style block directives in the blog markdown into plain
 * markdown that react-markdown can render. We intentionally keep this as a
 * surgical string-pass rather than a remark plugin because there are only two
 * directives and ~15 occurrences across the corpus.
 */

const INSTALL_RE =
  /^::install-command\{package="([^"]+)"(?:\s+dev)?\}\s*\n::/gm;

const CTA_RE = /^::dev-to-cta\{url="([^"]+)"\}\s*\n([^\n]+)\s*\n::/gm;

export function preprocessMarkdown(input: string): string {
  return input
    .replace(
      INSTALL_RE,
      (_m, pkg) => `\`\`\`bash\nnpm install --save-dev ${pkg}\n\`\`\``,
    )
    .replace(CTA_RE, (_m, url, label) => `**[${label.trim()}](${url})**`);
}
