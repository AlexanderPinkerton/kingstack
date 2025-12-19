// ============================================================================
// Constants for create-kingstack CLI
// ============================================================================

export const REPO_GIT_URL = "https://github.com/AlexanderPinkerton/kingstack.git";

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
};

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
};

// Packages/folders to completely remove from the template
export const PACKAGES_TO_REMOVE = [
    "packages/config",           // Published to npm
    "packages/create-kingstack", // This CLI itself
];

// File extensions to process for namespace replacement
export const PROCESS_EXTENSIONS = [
    ".ts", ".tsx", ".js", ".jsx", ".json", ".jsonc", ".md",
    ".mjs", ".cjs", ".yml", ".yaml", ".toml",
];
