// The Discover→Configure funnel's last step: a copied install command.
//
// `article:code_copy_click` fires for every snippet, but the copy that
// MATTERS is `npm install eslint-plugin-…` — the moment a reader moves
// from reading about a plugin to configuring it. This extracts the
// package name from install-shaped copies so the funnel can segment on
// it; anything else is null.
//
// Only our ecosystem's naming shapes are matched (eslint-*, @interlace/*)
// — the event vocabulary stays our own catalog, never arbitrary reader
// text (the analytics doctrine: aggregate-only, no free-form payloads).

const INSTALL = new RegExp(
  // npm i / npm install / pnpm add / yarn add / bun add, flags tolerated
  String.raw`(?:npm\s+i(?:nstall)?|pnpm\s+add|yarn\s+add|bun\s+add)\s+(?:-{1,2}[\w-]+\s+)*` +
    // the first package that looks like ours
    String.raw`((?:@interlace\/[\w.-]+)|eslint-plugin-[\w.-]+|eslint-config-[\w.-]+)`,
);

/** Our package named by an install-shaped copy, or null. */
export function installedPackage(text: string): string | null {
  return INSTALL.exec(text)?.[1] ?? null;
}
