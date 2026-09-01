// Browser stand-in for node builtins (fs/os/util) inside the lint
// worker bundle. ESLint's linter and the devkit's barrel import these
// at module level but the playground never exercises those paths — the
// browser-bundle spike proved rules fire correctly with every call
// no-oping to undefined rather than throwing at import time.
//
// Wired via `turbopack.resolveAlias` in next.config.ts, BROWSER
// condition only: server code keeps the real modules.

const noop: unknown = new Proxy(function () {}, {
  get: () => noop,
  apply: () => undefined,
});

export default noop;
export const readFileSync = noop,
  existsSync = noop,
  statSync = noop,
  readdirSync = noop,
  realpathSync = noop,
  platform = noop,
  homedir = noop,
  tmpdir = noop,
  inspect = noop,
  format = noop,
  EOL = "\n";
