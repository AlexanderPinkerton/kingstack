// ============================================================================
// Template operations for create-kingstack CLI
// ============================================================================

import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { SKIP_PATTERNS, PROCESS_EXTENSIONS, PUBLISHED_PACKAGES, PACKAGES_TO_REMOVE, REPO_URL, REPO_GIT_URL } from "./constants";
import { commandExists, warn, error, runCommandWithRetry } from "./utils";

// ============================================================================
// Template Cloning
// ============================================================================

/**
 * Clone the KingStack template to the target directory
 * Tries degit first (faster, no git history), falls back to git clone
 */
export async function cloneTemplate(targetDir: string): Promise<boolean> {
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

    // Fallback to git clone with retry
    if (commandExists("git")) {
        const success = runCommandWithRetry(
            `git clone --depth 1 ${REPO_GIT_URL} "${targetDir}"`,
            process.cwd(),
            { retries: 2 }
        );

        if (success) {
            rmSync(join(targetDir, ".git"), { recursive: true, force: true });
            return true;
        } else {
            error("git clone failed after retries");
            return false;
        }
    }

    error("Neither npx nor git is available. Please install one of them.");
    return false;
}

// ============================================================================
// File Traversal
// ============================================================================

/**
 * Get all files in a directory that should be processed for namespace replacement
 */
export function getAllFiles(dir: string, files: string[] = []): string[] {
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

/**
 * Get all package.json files in a directory
 */
export function getAllPackageJsonFiles(dir: string, files: string[] = []): string[] {
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

// ============================================================================
// Namespace Replacement
// ============================================================================

/**
 * Replace @kingstack/* namespace with @projectName/* in all files
 * Preserves published packages (like @kingstack/config)
 */
export function replaceNamespace(targetDir: string, projectName: string): number {
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

/**
 * Replace workspace:* versions with actual npm versions for published packages
 */
export function replaceWorkspaceVersions(targetDir: string): number {
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

/**
 * Remove published packages from the template (they'll be installed from npm)
 */
export function removePublishedPackages(targetDir: string): number {
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
