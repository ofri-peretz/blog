export const GITHUB_CONFIG = {
  username: "ofri-peretz",
  targetedRepos: ["ofriperetz-dev", "eslint"] as const,
};

export const NPM_CONFIG = {
  username: "ofriperetz",
  excludedPackages: [
    "eslint-plugin-mcp",
    "eslint-plugin-llm-optimized",
    "eslint-plugin-llm",
    "eslint-plugin-mcp-optimized",
  ],
  excludedPrefixes: ["@forge-js/"],
};

export const DEVTO_CONFIG = {
  username: "ofri-peretz",
};

export const MEASUREMENT_START_DATE = "2025-12-01";
