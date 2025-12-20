// ============================================================================
// Validators for create-kingstack CLI
// ============================================================================

import { spawnSync } from "child_process";
import { commandExists, warn, error } from "./utils";

// ============================================================================
// Project Name Validation
// ============================================================================

/**
 * Validate project name format
 * Returns true if valid, or error message string if invalid
 */
export function validateProjectName(name: string): boolean | string {
    if (!name) return "Project name is required";
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        return "Project name must start with a letter and contain only lowercase letters, numbers, and hyphens";
    }
    if (name.length < 2) return "Project name must be at least 2 characters";
    if (name.length > 50) return "Project name must be less than 50 characters";
    return true;
}

// ============================================================================
// Tool Validation
// ============================================================================

import pc from "picocolors";

export interface ToolStatus {
    git: boolean;
    yarn: boolean;
    bun: boolean;
    docker: boolean;
}

export interface ToolCheckResult {
    success: boolean;
    missing: string[];
    canRunPlayground: boolean;
    canRunFull: boolean;
    status: ToolStatus;
}

/**
 * Check all tools and return their status
 */
export function checkAllTools(): ToolStatus {
    return {
        git: commandExists("git"),
        yarn: commandExists("yarn"),
        bun: commandExists("bun"),
        docker: commandExists("docker"),
    };
}

/**
 * Display tool status to user upfront
 */
export function displayToolStatus(status: ToolStatus): void {
    console.log();
    console.log(pc.bold("  Checking required tools..."));
    console.log();

    const check = (name: string, available: boolean, required: boolean = true) => {
        const icon = available ? pc.green("✓") : (required ? pc.red("✗") : pc.yellow("○"));
        const label = available ? pc.dim(name) : (required ? pc.red(name) : pc.yellow(name));
        const suffix = !available && !required ? pc.dim(" (optional for playground)") : "";
        console.log(`  ${icon} ${label}${suffix}`);
    };

    check("git", status.git);
    check("yarn", status.yarn);
    check("bun", status.bun);
    check("docker", status.docker, false); // Docker is optional for playground
    console.log();
}

/**
 * Perform upfront tool validation
 * Returns what modes are available based on installed tools
 */
export function validateTools(): ToolCheckResult {
    const status = checkAllTools();
    const missing: string[] = [];

    // Core tools always required
    if (!status.git) missing.push("git - install from https://git-scm.com/");
    if (!status.yarn) missing.push("yarn - install with: npm install -g yarn");
    if (!status.bun) missing.push("bun - install from https://bun.sh/");

    const canRunPlayground = status.git && status.yarn && status.bun;
    const canRunFull = canRunPlayground && status.docker;

    return {
        success: canRunPlayground, // Can at least run playground
        missing,
        canRunPlayground,
        canRunFull,
        status,
    };
}

/**
 * Print missing tools error message
 */
export function printMissingToolsError(missing: string[]): void {
    error("Cannot proceed - missing required tools:");
    console.log();
    for (const tool of missing) {
        console.log(`  ${pc.red("•")} ${tool}`);
    }
    console.log();
}

// ============================================================================
// Docker Validation
// ============================================================================

/**
 * Check if Docker daemon is running
 * @returns true if Docker is running, false otherwise
 */
export function checkDockerRunning(): boolean {
    try {
        const result = spawnSync("docker", ["info"], {
            stdio: "ignore",
            shell: true,
        });
        return result.status === 0;
    } catch {
        return false;
    }
}

/**
 * Print Docker not running error message
 */
export function printDockerNotRunningError(): void {
    error("Docker is not running!");
    console.log();
    console.log("  Full setup mode requires Docker to run Supabase locally.");
    console.log();
    console.log("  To fix this:");
    console.log("    1. Start Docker Desktop (or your Docker daemon)");
    console.log("    2. Wait for Docker to fully start");
    console.log("    3. Run this command again");
    console.log();
    console.log("  Or choose 'Playground' mode which doesn't require Docker.");
}
