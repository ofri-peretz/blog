/**
 * Commit messages: `<type>(<scope>): <subject>`, the convention CLAUDE.md states and the history
 * already follows (blog, articles, engage, sdlc, ...). The scope is required; its set is not
 * closed yet, so a new area does not need a config change first.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-empty": [2, "never"],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
