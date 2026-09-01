import stats from "@/data/plugin-stats.json";

/**
 * Which of OUR packages an article actually discusses — detected from
 * the body, never from frontmatter (nothing to author, nothing to go
 * stale; the litmus holds). The whitelist is the synced stats file's
 * keys, which makes "no stats → no card" structural: a package the
 * sync doesn't know cannot render a card with invented numbers.
 */

export interface PluginMention {
  name: string;
  version: string;
  weeklyDownloads: number;
  mentions: number;
}

const PLUGINS: Record<string, { version: string; weeklyDownloads: number }> =
  stats.plugins;

export function detectPlugins(body: string, max = 3): PluginMention[] {
  const found: PluginMention[] = [];
  for (const [name, s] of Object.entries(PLUGINS)) {
    // Boundary-guarded: `eslint-plugin-pg` must not fire inside a longer
    // package name, and peers that share a suffix stay unmatched.
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const mentions =
      body.match(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "g"))?.length ?? 0;
    if (mentions > 0) found.push({ name, mentions, ...s });
  }
  // The most-discussed packages first; the cap is the ink budget.
  return found.sort((a, b) => b.mentions - a.mentions).slice(0, max);
}
