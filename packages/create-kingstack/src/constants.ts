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
  "@kingstack/comment-tree": "^0.2.2",
  "@kingstack/dnd-tree": "^0.2.0",
  "@kingstack/logger": "^0.1.0",
};

// Published libraries and maintainer tooling never ship as generated source.
// The template projection excludes these paths; this list also provides a
// defensive cleanup boundary for older or custom template sources.
export const PACKAGES_TO_REMOVE = [
  "packages/config", // Published to npm
  "packages/advanced-optimistic-store", // Published to npm
  "packages/comment-tree", // Published to npm
  "packages/dnd-tree", // Published to npm
  "packages/logger", // Published to npm
  "packages/create-kingstack", // This CLI itself
];

// The generated project is an explicit projection of the source repository.
// New repository files are maintainer-only unless deliberately added here.
export const TEMPLATE_PATHS = [
  ".dockerignore",
  ".github/workflows/checks-dev.yml",
  ".github/workflows/checks-prod.yml",
  ".github/workflows/deploy-next-dev.yml",
  ".github/workflows/deploy-next-prod.yml",
  ".gitignore",
  ".node-version",
  ".nvmrc",
  ".prettierignore",
  ".prettierrc.json",
  ".vscode",
  ".yarn/releases",
  ".yarnrc.yml",
  "AGENTS.md",
  "LICENSE",
  "apps",
  "config/example.ts",
  "config/readme.md",
  "config/schema.ts",
  "docker-compose.yml",
  "docs/ai-assistant-guide.md",
  "docs/auth",
  "docs/deployment",
  "docs/frontend-drafts.md",
  "docs/local-supabase-setup.md",
  "docs/metadata",
  "docs/scripts",
  "docs/secrets",
  "docs/state-management",
  "docs/supabase",
  "eslint.config.mjs",
  "package.json",
  "packages/eslint-config",
  "packages/prisma",
  "packages/shared",
  "packages/ts-config",
  "scripts/enable-backend.ts",
  "scripts/setup-shadow-db.ts",
  "scripts/supabase-check-config.ts",
  "scripts/supabase-list-instances.ts",
  "scripts/supabase-status.ts",
  "supabase/.gitignore",
  "supabase/config.toml",
  "template/readme.md",
  "tsconfig.json",
  "turbo.jsonc",
  "vercel.json",
] as const;

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
