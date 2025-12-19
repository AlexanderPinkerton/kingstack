// ============================================================================
// Utility functions for create-kingstack CLI
// ============================================================================

import pc from "picocolors";
import { execSync, spawn, spawnSync } from "child_process";

// ============================================================================
// Logging Helpers
// ============================================================================

export function banner(): void {
    console.log();
    console.log(pc.yellow("  👑 create-kingstack"));
    console.log(pc.dim("  ─────────────────────────────────"));
    console.log();
}

export function success(msg: string): void {
    console.log(pc.green("  ✓ ") + msg);
}

export function info(msg: string): void {
    console.log(pc.blue("  ℹ ") + msg);
}

export function warn(msg: string): void {
    console.log(pc.yellow("  ⚠ ") + msg);
}

export function error(msg: string): void {
    console.log(pc.red("  ✗ ") + msg);
}

export function step(num: number, total: number, msg: string): void {
    console.log();
    console.log(pc.cyan(`  [${num}/${total}] `) + pc.bold(msg));
}

// ============================================================================
// Command Execution
// ============================================================================

/**
 * Check if a command exists on the system
 */
export function commandExists(cmd: string): boolean {
    try {
        execSync(`which ${cmd}`, { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

/**
 * Options for running commands
 */
export interface RunCommandOptions {
    silent?: boolean;
    timeout?: number;  // Timeout in milliseconds
}

/**
 * Run a shell command and return success/failure
 * Uses spawnSync for better real-time output streaming
 */
export function runCommand(cmd: string, cwd: string, options: RunCommandOptions | boolean = {}): boolean {
    // Handle legacy boolean parameter for backwards compatibility
    const opts: RunCommandOptions = typeof options === "boolean"
        ? { silent: options }
        : options;

    const { silent = false, timeout } = opts;

    try {
        const result = spawnSync(cmd, {
            cwd,
            stdio: silent ? "ignore" : "inherit",
            shell: true,
            timeout,
        });

        // If timed out, result.signal will be 'SIGTERM'
        if (result.signal === "SIGTERM" && timeout) {
            warn(`Command timed out after ${timeout / 1000}s (this may be okay)`);
            return true; // Treat timeout as success for long-running services
        }

        return result.status === 0;
    } catch {
        return false;
    }
}

/**
 * Run a command with retry logic for network operations
 */
export function runCommandWithRetry(
    cmd: string,
    cwd: string,
    options: { retries?: number; silent?: boolean } = {}
): boolean {
    const { retries = 3, silent = false } = options;

    for (let attempt = 1; attempt <= retries; attempt++) {
        if (runCommand(cmd, cwd, silent)) {
            return true;
        }

        if (attempt < retries) {
            warn(`Attempt ${attempt} failed, retrying...`);
        }
    }

    return false;
}

// ============================================================================
// Browser & Dev Server
// ============================================================================

/**
 * Open a URL in the default browser
 */
export function openBrowser(url: string): void {
    const platform = process.platform;
    const cmd = platform === "darwin" ? "open" :
        platform === "win32" ? "start" : "xdg-open";
    try {
        execSync(`${cmd} ${url}`, { stdio: "ignore" });
    } catch {
        // Browser open is best-effort
    }
}

/**
 * Start the development server (takes over the terminal)
 */
export function startDevServer(cwd: string, port: number): void {
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
// Supabase Start
// ============================================================================

/**
 * Start Supabase and wait for it to complete
 * Shows all output to user - no clearing or hiding
 */
export function startSupabase(cwd: string): boolean {
    info("Starting Supabase containers...");
    info("This may take a few minutes on first run.");
    console.log();

    // Stop any existing Supabase containers first to ensure clean state
    // This prevents hangs from conflicting containers
    info("Cleaning up any existing Supabase containers...");
    runCommand("yarn supabase:stop", cwd, { silent: true });
    console.log();

    // Now start fresh
    return runCommand("yarn supabase:start", cwd);
}

