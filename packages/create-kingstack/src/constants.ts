// ============================================================================
// Constants for create-kingstack CLI
// ============================================================================

export const REPO_GIT_URL =
  "https://github.com/AlexanderPinkerton/kingstack.git";

export const DEFAULT_PORTS = {
  next: 3098,
  nest: 3099,
  supabaseApiPort: 4001,
  supabaseDbDirectPort: 4002,
  supabaseDbPoolerPort: 4002,
  supabaseStudioPort: 4003,
  supabaseAnalyticsPort: 4004,
  supabaseEmailPort: 4005,
  supabaseDbShadowPort: 4000,
  supabaseEdgeRuntimeInspectorPort: 4006,
};

export type PortAssignments = typeof DEFAULT_PORTS;

export const PORT_BLOCK_SIZE = 10;
export const PORT_BLOCK_BASE_MIN = 1024;
export const PORT_BLOCK_BASE_MAX = 65535 - (PORT_BLOCK_SIZE - 1);
export const AUTO_PORT_BASE_MIN = 10000;
export const AUTO_PORT_BASE_MAX = 29990;

// Files/directories to skip during namespace replacement
export const SKIP_PATTERNS = [
  "node_modules",
  ".git",
  "yarn.lock",
  ".yarn",
  "dist",
  ".next",
  ".turbo",
];

// Published npm packages that should NOT be renamed
// These will use their npm versions instead of workspace:*
export const PUBLISHED_PACKAGES: Record<string, string> = {
  "@kingstack/config": "^0.1.4",
  "@kingstack/advanced-optimistic-store": "^0.1.0",
};

// Packages/folders to completely remove from the template
export const PACKAGES_TO_REMOVE = [
  "packages/config", // Published to npm
  "packages/advanced-optimistic-store", // Published to npm
  "packages/create-kingstack", // This CLI itself
];

// File extensions to process for namespace replacement
export const PROCESS_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".jsonc",
  ".md",
  ".mjs",
  ".cjs",
  ".yml",
  ".yaml",
  ".toml",
];
