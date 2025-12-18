#!/usr/bin/env node
import prompts from "prompts";
import pc from "picocolors";
import { execSync, spawn } from "child_process";
import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";

// ============================================================================
// Constants
// ============================================================================

const REPO_URL = "github:AlexanderPinkerton/kingstack"; // For degit
const REPO_GIT_URL = "https://github.com/AlexanderPinkerton/kingstack.git"; // For git clone fallback

const DEFAULT_PORTS = {
    next: 3069,
    nest: 3420,
    supabaseApiPort: 54321,
    supabaseDbDirectPort: 54322,
    supabaseDbPoolerPort: 54322,
    supabaseStudioPort: 54324,
    supabaseAnalyticsPort: 54325,
    supabaseEmailPort: 54326,
    supabaseDbShadowPort: 54320,
};

// Files/directories to skip during namespace replacement
const SKIP_PATTERNS = [
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
const PUBLISHED_PACKAGES: Record<string, string> = {
    "@kingstack/config": "^0.1.4",
};

// Packages/folders to completely remove from the template
const PACKAGES_TO_REMOVE = [
    "packages/config",           // Published to npm
    "packages/create-kingstack", // This CLI itself
];

// File extensions to process for namespace replacement
const PROCESS_EXTENSIONS = [
    ".ts", ".tsx", ".js", ".jsx", ".json", ".jsonc", ".md",
    ".mjs", ".cjs", ".yml", ".yaml", ".toml",
];

// ============================================================================
// Argument Parsing
// ============================================================================

interface ParsedArgs {
    projectName?: string;
    baseDir: string;
    help: boolean;
}

function parseArgs(): ParsedArgs {
    const rawArgs = process.argv.slice(2);
    const result: ParsedArgs = {
        projectName: undefined,
        baseDir: process.cwd(),
        help: false,
    };

    // Separate flags from positional arguments
    const positionalArgs: string[] = [];

    let i = 0;
    while (i < rawArgs.length) {
        const arg = rawArgs[i];

        if (arg === "--help" || arg === "-h") {
            result.help = true;
            i++;
        } else if (arg === "--dir" || arg === "-d") {
            // --dir requires a value
            const nextArg = rawArgs[i + 1];
            if (!nextArg || nextArg.startsWith("-")) {
                console.error(`Error: ${arg} requires a path argument`);
                process.exit(1);
            }
            // Handle ~ expansion manually since shell might not do it
            const expandedPath = nextArg.startsWith("~")
                ? nextArg.replace("~", process.env.HOME || "")
                : nextArg;
            result.baseDir = resolve(expandedPath);
            i += 2; // Skip both flag and value
        } else if (arg.startsWith("-")) {
            // Unknown flag - skip it
            console.warn(`Warning: Unknown flag ${arg}`);
            i++;
        } else {
            // Positional argument
            positionalArgs.push(arg);
            i++;
        }
    }

    // First positional argument is the project name
    if (positionalArgs.length > 0) {
        result.projectName = positionalArgs[0];
    }

    return result;
}

function printHelp() {
    console.log(`
  ${pc.yellow("👑 create-kingstack")} - Create a new KingStack project

  ${pc.bold("Usage:")}
    npx create-kingstack [project-name] [options]

  ${pc.bold("Options:")}
    -d, --dir <path>   Base directory for the new project (default: current directory)
    -h, --help         Show this help message

  ${pc.bold("Examples:")}
    npx create-kingstack my-app
    npx create-kingstack my-app --dir ~/Projects
    npx create-kingstack --dir ~/Projects
    bun src/index.ts test-app --dir ~/Desktop

  ${pc.bold("Interactive mode:")}
    npx create-kingstack
`);
}

// ============================================================================
// Utilities
// ============================================================================

function banner() {
    console.log();
    console.log(pc.yellow("  👑 create-kingstack"));
    console.log(pc.dim("  ─────────────────────────────────"));
    console.log();
}

function success(msg: string) {
    console.log(pc.green("  ✓ ") + msg);
}

function info(msg: string) {
    console.log(pc.blue("  ℹ ") + msg);
}

function warn(msg: string) {
    console.log(pc.yellow("  ⚠ ") + msg);
}

function error(msg: string) {
    console.log(pc.red("  ✗ ") + msg);
}

function step(num: number, total: number, msg: string) {
    console.log();
    console.log(pc.cyan(`  [${num}/${total}] `) + pc.bold(msg));
}

function validateProjectName(name: string): boolean | string {
    if (!name) return "Project name is required";
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        return "Project name must start with a letter and contain only lowercase letters, numbers, and hyphens";
    }
    if (name.length < 2) return "Project name must be at least 2 characters";
    if (name.length > 50) return "Project name must be less than 50 characters";
    return true;
}

function commandExists(cmd: string): boolean {
    try {
        execSync(`which ${cmd}`, { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

function runCommand(cmd: string, cwd: string, silent = false): boolean {
    try {
        execSync(cmd, {
            cwd,
            stdio: silent ? "ignore" : "inherit",
        });
        return true;
    } catch {
        return false;
    }
}

function openBrowser(url: string) {
    const platform = process.platform;
    const cmd = platform === "darwin" ? "open" :
        platform === "win32" ? "start" : "xdg-open";
    try {
        execSync(`${cmd} ${url}`, { stdio: "ignore" });
    } catch {
        // Browser open is best-effort
    }
}

function startDevServer(cwd: string, port: number): void {
    console.log();
    console.log(pc.dim("  ─────────────────────────────────"));
    console.log();
    console.log(pc.bold("  🚀 Starting development server..."));
    console.log();
    console.log(`  ${pc.green("➜")} ${pc.bold("Local:")}   ${pc.cyan(`http://localhost:${port}`)}`);
    console.log();
    console.log(pc.dim("  Press Ctrl+C to stop"));
    console.log();

    // Open browser after a short delay to let server start
    setTimeout(() => openBrowser(`http://localhost:${port}`), 3000);

    // Start dev server in foreground (takes over the terminal)
    const child = spawn("yarn", ["dev"], {
        cwd,
        stdio: "inherit",
        shell: true,
    });

    child.on("error", (err) => {
        error(`Failed to start dev server: ${err.message}`);
        process.exit(1);
    });

    // Forward signals to child process
    process.on("SIGINT", () => child.kill("SIGINT"));
    process.on("SIGTERM", () => child.kill("SIGTERM"));
}

// ============================================================================
// Core Functions
// ============================================================================

async function cloneTemplate(targetDir: string): Promise<boolean> {
    // Try degit first (faster, no git history)
    if (commandExists("npx")) {
        try {
            execSync(`npx degit ${REPO_URL} "${targetDir}" --force`, {
                stdio: "inherit",
            });
            return true;
        } catch {
            warn("degit failed, falling back to git clone...");
        }
    }

    // Fallback to git clone
    if (commandExists("git")) {
        try {
            execSync(`git clone --depth 1 ${REPO_GIT_URL} "${targetDir}"`, {
                stdio: "inherit",
            });
            rmSync(join(targetDir, ".git"), { recursive: true, force: true });
            return true;
        } catch {
            error("git clone failed");
            return false;
        }
    }

    error("Neither npx nor git is available. Please install one of them.");
    return false;
}

function getAllFiles(dir: string, files: string[] = []): string[] {
    const entries = readdirSync(dir);

    for (const entry of entries) {
        if (SKIP_PATTERNS.some((pattern) => entry === pattern || entry.startsWith(pattern))) {
            continue;
        }

        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            getAllFiles(fullPath, files);
        } else if (stat.isFile()) {
            const ext = entry.substring(entry.lastIndexOf("."));
            if (PROCESS_EXTENSIONS.includes(ext) || entry === "Dockerfile") {
                files.push(fullPath);
            }
        }
    }

    return files;
}

function getAllPackageJsonFiles(dir: string, files: string[] = []): string[] {
    const entries = readdirSync(dir);

    for (const entry of entries) {
        if (SKIP_PATTERNS.some((pattern) => entry === pattern)) {
            continue;
        }

        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            getAllPackageJsonFiles(fullPath, files);
        } else if (entry === "package.json") {
            files.push(fullPath);
        }
    }

    return files;
}

function replaceNamespace(targetDir: string, projectName: string): number {
    const files = getAllFiles(targetDir);
    let modifiedCount = 0;

    // Get list of published package names (without @kingstack/ prefix)
    const publishedNames = Object.keys(PUBLISHED_PACKAGES).map((p) => p.replace("@kingstack/", ""));

    // Build regex that matches @kingstack/ followed by anything except published package names
    // Uses negative lookahead to exclude published packages
    const privatePackagePattern = new RegExp(
        `@kingstack/(?!(?:${publishedNames.join("|")})(?:[/"'\\s\\]]))`,
        "g"
    );

    for (const filePath of files) {
        try {
            const content = readFileSync(filePath, "utf-8");
            const newContent = content.replace(privatePackagePattern, `@${projectName}/`);

            if (content !== newContent) {
                writeFileSync(filePath, newContent, "utf-8");
                modifiedCount++;
            }
        } catch {
            // Skip files that can't be read/written
        }
    }

    return modifiedCount;
}

function replaceWorkspaceVersions(targetDir: string): number {
    const packageJsonFiles = getAllPackageJsonFiles(targetDir);
    let modifiedCount = 0;

    for (const filePath of packageJsonFiles) {
        try {
            const content = readFileSync(filePath, "utf-8");
            const pkg = JSON.parse(content);
            let modified = false;

            // Check dependencies and devDependencies
            for (const depType of ["dependencies", "devDependencies"] as const) {
                if (pkg[depType]) {
                    for (const [name, version] of Object.entries(pkg[depType])) {
                        if (
                            PUBLISHED_PACKAGES[name] &&
                            (version === "workspace:*" || version === "workspace:^")
                        ) {
                            pkg[depType][name] = PUBLISHED_PACKAGES[name];
                            modified = true;
                        }
                    }
                }
            }

            if (modified) {
                writeFileSync(filePath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
                modifiedCount++;
            }
        } catch {
            // Skip files that can't be processed
        }
    }

    return modifiedCount;
}

function removePublishedPackages(targetDir: string): number {
    let removedCount = 0;

    for (const packagePath of PACKAGES_TO_REMOVE) {
        const fullPath = join(targetDir, packagePath);
        if (existsSync(fullPath)) {
            rmSync(fullPath, { recursive: true, force: true });
            removedCount++;
        }
    }

    return removedCount;
}

function updatePlaygroundConfig(targetDir: string, projectName: string): void {
    // Update the playground.ts config with valid placeholder values
    // The schema requires certain fields that playground.ts has as empty strings
    const playgroundConfigContent = `import { defineValues } from "@kingstack/config";

/**
 * Playground mode values - safe mock data for development without a backend.
 * Generated by create-kingstack for ${projectName}
 * 
 * This file can be checked into version control since it contains no real secrets.
 */
export const values = defineValues({
    // ============================================================================
    // Application Configuration
    // ============================================================================
    NEXT_HOST: "localhost",
    NEST_HOST: "localhost",
    NEXT_PORT: "3069",
    NEST_PORT: "3000",

    // ============================================================================
    // Supabase Configuration (Playground placeholders)
    // ============================================================================
    SUPABASE_PROJECT_REF: "${projectName}-playground",
    SUPABASE_REGION: "local",
    SUPABASE_API_URL: "https://playground.supabase.co",
    SUPABASE_ANON_KEY: "mock-anon-key-for-playground",
    SUPABASE_SERVICE_ROLE_KEY: "mock-service-role-key-for-playground",
    SUPA_JWT_SECRET: "mock-jwt-secret-for-playground-environment",
    SUPABASE_DB_PASSWORD: "playground",

    // ============================================================================
    // Database Configuration (Mock)
    // ============================================================================
    SUPABASE_POOLER_HOST: "localhost",
    SUPABASE_POOLER_USER: "postgres.playground",

    // ============================================================================
    // Optional: OAuth (Empty for playground)
    // ============================================================================
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",

    // ============================================================================
    // Deployment (Placeholders for playground)
    // ============================================================================
    VERCEL_TOKEN: "playground-not-configured",
    VERCEL_ORG_ID: "playground-not-configured",
    VERCEL_PROJECT_ID: "playground-not-configured",

    // ============================================================================
    // Optional: AI Providers (Empty for playground)
    // ============================================================================
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    GEMINI_API_KEY: "",

    // Environment Type
    ENVIRONMENT_TYPE: "local",
});
`;
    writeFileSync(join(targetDir, "config", "playground.ts"), playgroundConfigContent, "utf-8");
}
function updateRootPackageJson(targetDir: string, projectName: string) {
    const pkgPath = join(targetDir, "package.json");
    const content = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content);
    pkg.name = projectName;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
}

function generateLocalConfig(targetDir: string, projectName: string, ports: typeof DEFAULT_PORTS) {
    // Note: Keep @kingstack/config as-is since it's a published npm package
    const configContent = `import { defineValues } from "@kingstack/config";

/**
 * Local development configuration for ${projectName}
 * Generated by create-kingstack
 */
export const values = defineValues({
    SUPABASE_PROJECT_ID: "${projectName}-local",

    // Application URLs
    NEXT_URL: "localhost",
    NEST_URL: "localhost",

    // Application Ports
    NEXT_PORT: "${ports.next}",
    NEST_PORT: "${ports.nest}",
    SUPABASE_DB_SHADOW_PORT: "${ports.supabaseDbShadowPort}",
    SUPABASE_API_PORT: "${ports.supabaseApiPort}",
    SUPABASE_DB_DIRECT_PORT: "${ports.supabaseDbDirectPort}",
    SUPABASE_DB_POOLER_PORT: "${ports.supabaseDbPoolerPort}",
    SUPABASE_STUDIO_PORT: "${ports.supabaseStudioPort}",
    SUPABASE_ANALYTICS_PORT: "${ports.supabaseAnalyticsPort}",
    SUPABASE_EMAIL_PORT: "${ports.supabaseEmailPort}",

    // Supabase Configuration (local)
    SUPABASE_PROJECT_REF: "${projectName}-local",
    SUPABASE_REGION: "local",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
    SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
    SUPA_JWT_SECRET: "super-secret-jwt-token-with-at-least-32-characters-long",
    SUPABASE_DB_PASSWORD: "postgres",

    // Optional: OAuth
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",

    // Optional: Deployment
    VERCEL_TOKEN: "",
    VERCEL_ORG_ID: "",
    VERCEL_PROJECT_ID: "",

    // Optional: AI Providers
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    GEMINI_API_KEY: "",

    // Stripe
    STRIPE_PUBLIC_KEY: "",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",

    // Resend (Email)
    RESEND_API_KEY: "",

    // Ecommerce
    NEXT_PUBLIC_INVENTORY_POOL_ID: "",

    // Environment Type
    ENVIRONMENT_TYPE: "local",
});
`;
    writeFileSync(join(targetDir, "config", "local.ts"), configContent, "utf-8");
}

function initGit(targetDir: string): boolean {
    try {
        execSync("git init", { cwd: targetDir, stdio: "ignore" });
        execSync("git add -A", { cwd: targetDir, stdio: "ignore" });
        execSync('git commit -m "Initial commit from create-kingstack"', {
            cwd: targetDir,
            stdio: "ignore",
        });
        return true;
    } catch {
        return false;
    }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    const args = parseArgs();

    if (args.help) {
        printHelp();
        process.exit(0);
    }

    banner();

    // Show base directory if not cwd
    if (args.baseDir !== process.cwd()) {
        info(`Base directory: ${pc.dim(args.baseDir)}`);
        console.log();
    }

    // Get project name from args or prompt
    let projectName = args.projectName;

    const response = await prompts(
        [
            {
                type: projectName ? null : "text",
                name: "projectName",
                message: "Project name (also used as directory name):",
                initial: "my-app",
                validate: validateProjectName,
            },
            {
                type: "select",
                name: "mode",
                message: "Setup mode:",
                choices: [
                    {
                        title: "Playground (quick start, no database)",
                        description: "Perfect for UI development and prototyping",
                        value: "playground",
                    },
                    {
                        title: "Full setup (with Supabase)",
                        description: "Requires Docker - complete backend with auth & database",
                        value: "full",
                    },
                ],
                initial: 0,
            },
            {
                type: "confirm",
                name: "customPorts",
                message: "Customize ports?",
                initial: false,
            },
            {
                type: (prev: boolean) => (prev ? "number" : null),
                name: "nextPort",
                message: "Next.js port:",
                initial: DEFAULT_PORTS.next,
            },
            {
                type: (_prev: number, values: { customPorts: boolean }) =>
                    values.customPorts ? "number" : null,
                name: "nestPort",
                message: "NestJS port:",
                initial: DEFAULT_PORTS.nest,
            },
            {
                type: (_prev: number, values: { customPorts: boolean }) =>
                    values.customPorts ? "number" : null,
                name: "supabaseBasePort",
                message: "Supabase base port:",
                initial: DEFAULT_PORTS.supabaseApiPort,
            },
        ],
        {
            onCancel: () => {
                console.log();
                info("Setup cancelled.");
                process.exit(0);
            },
        }
    );

    // Merge CLI args with prompts
    projectName = projectName || response.projectName;
    const mode = response.mode as "playground" | "full";

    // Validate we have a project name
    if (!projectName) {
        error("Project name is required");
        process.exit(1);
    }

    // Calculate ports
    const ports = { ...DEFAULT_PORTS };
    if (response.customPorts) {
        ports.next = response.nextPort || DEFAULT_PORTS.next;
        ports.nest = response.nestPort || DEFAULT_PORTS.nest;
        const basePort = response.supabaseBasePort || DEFAULT_PORTS.supabaseApiPort;
        ports.supabaseApiPort = basePort;
        ports.supabaseDbDirectPort = basePort + 1;
        ports.supabaseDbPoolerPort = basePort + 1;
        ports.supabaseStudioPort = basePort + 3;
        ports.supabaseAnalyticsPort = basePort + 4;
        ports.supabaseEmailPort = basePort + 5;
        ports.supabaseDbShadowPort = basePort - 1;
    }

    // Use project name as directory name (like create-react-app)
    const fullTargetDir = resolve(args.baseDir, projectName);
    const totalSteps = mode === "playground" ? 9 : 12;

    // Check if directory exists and not empty
    if (existsSync(fullTargetDir)) {
        const files = readdirSync(fullTargetDir);
        if (files.length > 0) {
            const { overwrite } = await prompts({
                type: "confirm",
                name: "overwrite",
                message: `Directory ${projectName} is not empty. Continue anyway?`,
                initial: false,
            });
            if (!overwrite) {
                info("Setup cancelled.");
                process.exit(0);
            }
        }
    }

    console.log();
    console.log(pc.dim("  ─────────────────────────────────"));
    console.log();
    info(`Creating ${pc.bold(projectName)} in ${pc.dim(fullTargetDir)}`);
    info(`Mode: ${pc.bold(mode === "playground" ? "Playground" : "Full Setup")}`);

    // Step 1: Clone template
    step(1, totalSteps, "Downloading KingStack template...");
    const cloned = await cloneTemplate(fullTargetDir);
    if (!cloned) {
        error("Failed to download template.");
        process.exit(1);
    }
    success("Template downloaded");

    // Step 2: Remove published packages from template
    step(2, totalSteps, "Removing published packages...");
    const removedCount = removePublishedPackages(fullTargetDir);
    // Update playground config with valid placeholder values for required schema fields
    updatePlaygroundConfig(fullTargetDir, projectName);
    success(`Removed ${removedCount} packages that are published to npm`);

    // Step 3: Replace namespace (excluding published packages)
    step(3, totalSteps, `Renaming namespace to @${projectName}...`);
    const modifiedFiles = replaceNamespace(fullTargetDir, projectName);
    updateRootPackageJson(fullTargetDir, projectName);
    success(`Updated ${modifiedFiles} files`);

    // Step 4: Replace workspace:* with npm versions for published packages
    step(4, totalSteps, "Updating package versions...");
    const versionsUpdated = replaceWorkspaceVersions(fullTargetDir);
    success(`Updated ${versionsUpdated} package.json files with npm versions`);

    // Step 5: Generate config
    step(5, totalSteps, "Generating configuration...");
    generateLocalConfig(fullTargetDir, projectName, ports);
    success("Created config/local.ts");

    // Step 6: Initialize git
    step(6, totalSteps, "Initializing git repository...");
    if (initGit(fullTargetDir)) {
        success("Git repository initialized");
    } else {
        warn("Could not initialize git (git may not be installed)");
    }

    // Step 7: Install dependencies
    step(7, totalSteps, "Installing dependencies...");
    info("This may take a minute...");
    // Delete yarn.lock to force fresh resolution - the old lock file references workspace packages that no longer exist
    const lockPath = join(fullTargetDir, "yarn.lock");
    if (existsSync(lockPath)) {
        rmSync(lockPath);
    }
    if (!runCommand("yarn install", fullTargetDir)) {
        error("Failed to install dependencies. Run 'yarn install' manually.");
        process.exit(1);
    }
    success("Dependencies installed");

    // Step 8: Generate Prisma client
    step(8, totalSteps, "Generating Prisma client...");
    if (!runCommand("yarn prisma:generate", fullTargetDir, true)) {
        warn("Prisma client generation failed. Run 'yarn prisma:generate' manually.");
    } else {
        success("Prisma client generated");
    }

    if (mode === "playground") {
        // Playground mode: Generate env and start
        step(9, totalSteps, "Setting up playground environment...");
        if (!runCommand("yarn env:playground", fullTargetDir)) {
            error("Failed to generate environment. Run 'yarn env:playground' manually.");
            process.exit(1);
        }
        success("Playground environment ready");

        // Start dev server
        startDevServer(fullTargetDir, ports.next);

    } else {
        // Full mode: Supabase setup
        step(9, totalSteps, "Generating environment files...");
        if (!runCommand("yarn env:local", fullTargetDir)) {
            error("Failed to generate environment.");
            process.exit(1);
        }
        success("Environment files generated");

        step(10, totalSteps, "Starting Supabase...");
        info("This requires Docker to be running...");
        if (!runCommand("yarn supabase:start", fullTargetDir)) {
            console.log();
            warn("Supabase failed to start. Make sure Docker is running.");
            console.log();
            console.log(pc.bold("  To complete setup manually:"));
            console.log();
            console.log(pc.dim("  1.") + " Start Docker");
            console.log(pc.dim("  2.") + ` cd ${projectName}`);
            console.log(pc.dim("  3.") + " yarn supabase:start");
            console.log(pc.dim("  4.") + " bun scripts/setup-shadow-db.ts");
            console.log(pc.dim("  5.") + " yarn prisma:migrate");
            console.log(pc.dim("  6.") + " yarn dev");
            console.log();
            process.exit(1);
        }
        success("Supabase started");

        step(11, totalSteps, "Setting up database...");
        info("Creating shadow database...");
        if (!runCommand("bun scripts/setup-shadow-db.ts", fullTargetDir)) {
            warn("Shadow database setup failed. You may need to run it manually.");
        } else {
            success("Shadow database created");
        }

        info("Running migrations...");
        if (!runCommand("yarn prisma:migrate", fullTargetDir)) {
            warn("Migrations failed. Run 'yarn prisma:migrate' manually after fixing any issues.");
        } else {
            success("Database migrated");
        }

        step(12, totalSteps, "Starting development server...");
        startDevServer(fullTargetDir, ports.next);
    }
}

main().catch((err) => {
    error(err.message);
    process.exit(1);
});
