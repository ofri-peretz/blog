/**
 * The stale-claim detector runs spec "command" cells in a shell, weekly, in CI.
 * A prose cell with backticks inside it once reached that shell: the inner
 * backticks became command substitution, and a cell quoting
 * `npx "vercel@$VERCEL_CLI_VERSION"` ran a bare `npx vercel@` that created and
 * deployed a Vercel project (2026-09-23). This lock keeps prose away from the
 * shell: only a cell that is exactly one backtick span is ever executed.
 */
import { describe, expect, it } from "vitest";

// @ts-expect-error — a plain .mjs script, imported for its pure parser
import { executable, parseClaims } from "../../../../scripts/sdlc/lib.mjs";

describe("only a whole backtick span is a runnable command", () => {
  it("runs a cell that is exactly one span", () => {
    expect(executable("`npm view eslint version`")).toBe("npm view eslint version");
  });

  it("never runs a prose cell with inner backticks", () => {
    expect(executable('same file: `npx "vercel@$VERCEL_CLI_VERSION"` on the pull')).toBe("");
    expect(executable("`npm i oxc-resolver` in an empty package then `du -sk node_modules`")).toBe("");
  });

  it("treats a span of only whitespace as prose, not an empty command", () => {
    // `[^`]+` accepts spaces, and trim() then yields "": the detector's
    // `if (!claim.command)` guard must keep reading "" as "nothing to run".
    expect(executable("`   `")).toBe("");
  });

  it("never runs a cell with no backticks at all", () => {
    expect(executable("read the heading of the page")).toBe("");
  });

  it("keeps the prose as evidence so the chain lock still sees it", () => {
    const [row] = parseClaims("| rules shipped | 27 | `a` then `b` | 1.0 | ✅ |\n");
    expect(row).toMatchObject({ command: "", evidence: "`a` then `b`" });
  });
});
