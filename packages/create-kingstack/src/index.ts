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

// File extensions to process for namespace replacement
const PROCESS_EXTENSIONS = [
    ".ts", ".tsx", ".js", ".jsx", ".json", ".md",
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

function replaceNamespace(targetDir: string, projectName: string): number {
    const files = getAllFiles(targetDir);
    let modifiedCount = 0;

    for (const filePath of files) {
        try {
            const content = readFileSync(filePath, "utf-8");
            const newContent = content.replace(/@kingstack\//g, `@${projectName}/`);

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

function updateRootPackageJson(targetDir: string, projectName: string) {
    const pkgPath = join(targetDir, "package.json");
    const content = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content);
    pkg.name = projectName;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
}

function generateLocalConfig(targetDir: string, projectName: string, ports: typeof DEFAULT_PORTS) {
    const configContent = `import { defineValues } from "@${projectName}/config";

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
    const totalSteps = mode === "playground" ? 6 : 9;

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

    // Step 2: Replace namespace
    step(2, totalSteps, `Renaming namespace to @${projectName}...`);
    const modifiedFiles = replaceNamespace(fullTargetDir, projectName);
    updateRootPackageJson(fullTargetDir, projectName);
    success(`Updated ${modifiedFiles} files`);

    // Step 3: Generate config
    step(3, totalSteps, "Generating configuration...");
    generateLocalConfig(fullTargetDir, projectName, ports);
    success("Created config/local.ts");

    // Step 4: Initialize git
    step(4, totalSteps, "Initializing git repository...");
    if (initGit(fullTargetDir)) {
        success("Git repository initialized");
    } else {
        warn("Could not initialize git (git may not be installed)");
    }

    // Step 5: Install dependencies
    step(5, totalSteps, "Installing dependencies...");
    info("This may take a minute...");
    if (!runCommand("yarn install", fullTargetDir)) {
        error("Failed to install dependencies. Run 'yarn install' manually.");
        process.exit(1);
    }
    success("Dependencies installed");

    if (mode === "playground") {
        // Playground mode: Generate env and start
        step(6, totalSteps, "Setting up playground environment...");
        if (!runCommand("yarn env:playground", fullTargetDir)) {
            error("Failed to generate environment. Run 'yarn env:playground' manually.");
            process.exit(1);
        }
        success("Playground environment ready");

        // Start dev server
        startDevServer(fullTargetDir, ports.next);

    } else {
        // Full mode: Supabase setup
        step(6, totalSteps, "Generating environment files...");
        if (!runCommand("yarn env:local", fullTargetDir)) {
            error("Failed to generate environment.");
            process.exit(1);
        }
        success("Environment files generated");

        step(7, totalSteps, "Starting Supabase...");
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

        step(8, totalSteps, "Setting up database...");
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

        step(9, totalSteps, "Starting development server...");
        startDevServer(fullTargetDir, ports.next);
    }
}

main().catch((err) => {
    error(err.message);
    process.exit(1);
});
