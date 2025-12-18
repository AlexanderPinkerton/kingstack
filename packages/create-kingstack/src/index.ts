#!/usr/bin/env node
// ============================================================================
// create-kingstack - CLI to create a new project from the KingStack template
// ============================================================================

import prompts from "prompts";
import pc from "picocolors";
import { existsSync, readdirSync } from "fs";

// Module imports
import { parseArgs, printHelp, promptForConfig } from "./cli";
import { banner, info, success, warn, error, step, runCommand, startDevServer, startSupabase } from "./utils";
import {
    checkRequiredTools,
    checkDockerRunning,
    printMissingToolsError,
    printDockerNotRunningError
} from "./validators";
import {
    cloneTemplate,
    replaceNamespace,
    replaceWorkspaceVersions,
    removePublishedPackages
} from "./template";
import {
    generateLocalConfig,
    updatePlaygroundConfig,
    updateRootPackageJson,
    initGit,
    deleteYarnLock
} from "./config-generators";

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

    // Get project configuration
    const config = await promptForConfig(args);
    if (!config) {
        error("Project name is required");
        process.exit(1);
    }

    const { projectName, mode, ports, targetDir } = config;

    // ==========================================================================
    // Pre-flight Checks
    // ==========================================================================

    // Check required tools
    const toolCheck = checkRequiredTools(mode);
    if (!toolCheck.success) {
        printMissingToolsError(toolCheck.missing);
        process.exit(1);
    }

    // For full mode, verify Docker is running BEFORE starting
    if (mode === "full") {
        if (!checkDockerRunning()) {
            printDockerNotRunningError();
            process.exit(1);
        }
    }

    // ==========================================================================
    // Setup
    // ==========================================================================

    const totalSteps = mode === "playground" ? 9 : 12;

    // Check if directory exists and not empty
    if (existsSync(targetDir)) {
        const files = readdirSync(targetDir);
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
    info(`Creating ${pc.bold(projectName)} in ${pc.dim(targetDir)}`);
    info(`Mode: ${pc.bold(mode === "playground" ? "Playground" : "Full Setup")}`);

    // ==========================================================================
    // Step 1: Clone template
    // ==========================================================================
    step(1, totalSteps, "Downloading KingStack template...");
    const cloned = await cloneTemplate(targetDir);
    if (!cloned) {
        error("Failed to download template.");
        process.exit(1);
    }
    success("Template downloaded");

    // ==========================================================================
    // Step 2: Remove published packages
    // ==========================================================================
    step(2, totalSteps, "Removing published packages...");
    const removedCount = removePublishedPackages(targetDir);
    updatePlaygroundConfig(targetDir, projectName);
    success(`Removed ${removedCount} packages that are published to npm`);

    // ==========================================================================
    // Step 3: Replace namespace
    // ==========================================================================
    step(3, totalSteps, `Renaming namespace to @${projectName}...`);
    const modifiedFiles = replaceNamespace(targetDir, projectName);
    updateRootPackageJson(targetDir, projectName);
    success(`Updated ${modifiedFiles} files`);

    // ==========================================================================
    // Step 4: Update package versions
    // ==========================================================================
    step(4, totalSteps, "Updating package versions...");
    const versionsUpdated = replaceWorkspaceVersions(targetDir);
    success(`Updated ${versionsUpdated} package.json files with npm versions`);

    // ==========================================================================
    // Step 5: Generate config
    // ==========================================================================
    step(5, totalSteps, "Generating configuration...");
    generateLocalConfig(targetDir, projectName, ports);
    success("Created config/local.ts");

    // ==========================================================================
    // Step 6: Initialize git
    // ==========================================================================
    step(6, totalSteps, "Initializing git repository...");
    if (initGit(targetDir)) {
        success("Git repository initialized");
    } else {
        warn("Could not initialize git (git may not be installed)");
    }

    // ==========================================================================
    // Step 7: Install dependencies
    // ==========================================================================
    step(7, totalSteps, "Installing dependencies...");
    info("This may take a minute...");
    deleteYarnLock(targetDir);
    if (!runCommand("yarn install", targetDir)) {
        error("Failed to install dependencies. Run 'yarn install' manually.");
        process.exit(1);
    }
    success("Dependencies installed");

    // ==========================================================================
    // Step 8: Generate Prisma client
    // ==========================================================================
    step(8, totalSteps, "Generating Prisma client...");
    if (!runCommand("yarn prisma:generate", targetDir, true)) {
        warn("Prisma client generation failed. Run 'yarn prisma:generate' manually.");
    } else {
        success("Prisma client generated");
    }

    // ==========================================================================
    // Mode-specific steps
    // ==========================================================================

    if (mode === "playground") {
        // ======================================================================
        // Playground Mode
        // ======================================================================
        step(9, totalSteps, "Setting up playground environment...");
        if (!runCommand("yarn env:playground", targetDir)) {
            error("Failed to generate environment. Run 'yarn env:playground' manually.");
            process.exit(1);
        }
        success("Playground environment ready");

        startDevServer(targetDir, ports.next);

    } else {
        // ======================================================================
        // Full Mode (with Supabase)
        // ======================================================================
        step(9, totalSteps, "Generating environment files...");
        if (!runCommand("yarn env:local", targetDir)) {
            error("Failed to generate environment.");
            process.exit(1);
        }
        success("Environment files generated");

        step(10, totalSteps, "Starting Supabase...");
        info("First-time startup may take 5-10 minutes while Docker images download.");
        console.log();
        // Start Supabase in background and poll for container health
        const supabaseStarted = await startSupabase(targetDir);
        if (!supabaseStarted) {
            console.log();
            warn("Supabase failed to start within the timeout period.");
            console.log();
            console.log(pc.bold("  To complete setup manually:"));
            console.log();
            console.log(pc.dim("  1.") + ` cd ${projectName}`);
            console.log(pc.dim("  2.") + " yarn supabase:start");
            console.log(pc.dim("  3.") + " bun scripts/setup-shadow-db.ts");
            console.log(pc.dim("  4.") + " yarn prisma:migrate");
            console.log(pc.dim("  5.") + " yarn dev");
            console.log();
            process.exit(1);
        }
        success("Supabase containers running");

        step(11, totalSteps, "Setting up database...");
        info("Creating shadow database...");
        if (!runCommand("bun scripts/setup-shadow-db.ts", targetDir)) {
            warn("Shadow database setup failed. You may need to run it manually.");
        } else {
            success("Shadow database created");
        }

        info("Running migrations...");
        if (!runCommand("yarn prisma:migrate", targetDir)) {
            warn("Migrations failed. Run 'yarn prisma:migrate' manually after fixing any issues.");
        } else {
            success("Database migrated");
        }

        step(12, totalSteps, "Starting development server...");
        startDevServer(targetDir, ports.next);
    }
}

main().catch((err) => {
    error(err.message);
    process.exit(1);
});
