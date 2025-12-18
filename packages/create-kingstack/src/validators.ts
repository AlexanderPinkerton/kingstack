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

export interface ToolCheckResult {
    success: boolean;
    missing: string[];
}

/**
 * Check that required tools are installed
 * @param mode - "playground" or "full" (full requires additional tools)
 */
export function checkRequiredTools(mode: "playground" | "full"): ToolCheckResult {
    const missing: string[] = [];

    // Always required
    if (!commandExists("git")) {
        missing.push("git");
    }

    // npm/npx needed for degit fallback and initial setup
    if (!commandExists("npx")) {
        missing.push("npx (Node.js)");
    }

    // Full mode requires Docker
    if (mode === "full" && !commandExists("docker")) {
        missing.push("docker");
    }

    return {
        success: missing.length === 0,
        missing,
    };
}

/**
 * Print missing tools error message
 */
export function printMissingToolsError(missing: string[]): void {
    error("Missing required tools:");
    console.log();
    for (const tool of missing) {
        console.log(`  • ${tool}`);
    }
    console.log();
    console.log("  Please install the missing tools and try again.");
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
