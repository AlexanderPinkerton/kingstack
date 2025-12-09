/**
 * sync-deployment-secrets.ts
 * 
 * Syncs secrets from TypeScript config files to GitHub and Vercel.
 * This eliminates the need to manually copy/paste secrets into UIs.
 * 
 * Secret lists are defined in config/schema.ts under the 'services' section,
 * making them easy to maintain alongside envfiles and configs.
 * 
 * Usage:
 *   bun scripts/sync-deployment-secrets.ts [options]
 *   bun scripts/sync-deployment-secrets.ts --dry-run
 *   bun scripts/sync-deployment-secrets.ts --env development
 *   bun scripts/sync-deployment-secrets.ts --env production
 *   bun scripts/sync-deployment-secrets.ts --target github
 *   bun scripts/sync-deployment-secrets.ts --target vercel
 */

import { execSync } from "child_process";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { schema } from "../schema";
import { resolveConfig } from "../utils";

// CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const envFilter = args.find(arg => arg.startsWith("--env="))?.split("=")[1] ||
    (args.includes("--env") ? args[args.indexOf("--env") + 1] : null);
const targetFilter = args.find(arg => arg.startsWith("--target="))?.split("=")[1] ||
    (args.includes("--target") ? args[args.indexOf("--target") + 1] : null);

// Environments to sync
const ENVIRONMENTS = ["development", "production"];

// Get secret lists from schema (with fallback for type safety)
const GITHUB_SECRETS = schema.services?.github?.keys || [];
const VERCEL_SECRETS = schema.services?.vercel?.keys || [];

async function main() {
    console.log("🔐 Deployment Secret Sync Tool\n");

    if (isDryRun) {
        console.log("🔍 DRY RUN MODE - No changes will be made\n");
    }

    // Validate filters
    if (envFilter && !ENVIRONMENTS.includes(envFilter)) {
        console.error(`❌ Invalid environment: ${envFilter}`);
        console.error(`   Valid options: ${ENVIRONMENTS.join(", ")}\n`);
        printUsageAndExit();
    }

    if (targetFilter && !["github", "vercel"].includes(targetFilter)) {
        console.error(`❌ Invalid target: ${targetFilter}`);
        console.error(`   Valid options: github, vercel\n`);
        printUsageAndExit();
    }

    // Check CLI tools
    if (!targetFilter || targetFilter === "github") {
        checkGitHubCLI();
    }
    if (!targetFilter || targetFilter === "vercel") {
        checkVercelCLI();
    }

    // Determine which environments to sync
    const envsToSync = envFilter ? [envFilter] : ENVIRONMENTS;

    console.log(`📋 Syncing environments: ${envsToSync.join(", ")}`);
    if (targetFilter) {
        console.log(`🎯 Target: ${targetFilter} only`);
    } else {
        console.log(`🎯 Target: GitHub + Vercel`);
    }
    console.log("");

    // Sync each environment
    for (const env of envsToSync) {
        await syncEnvironment(env);
    }

    console.log("\n✅ Secret sync complete!");
    if (isDryRun) {
        console.log("\n💡 Run without --dry-run to apply changes");
    }
}

async function syncEnvironment(env: string) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📦 Environment: ${env}`);
    console.log("=".repeat(60));

    // Load config for this environment
    const valuesPath = join("config", `${env}.ts`);
    if (!existsSync(valuesPath)) {
        console.error(`\n❌ Error: ${valuesPath} does not exist.`);
        console.error(`💡 Tip: Copy config/example.ts to ${valuesPath} and fill in your values.\n`);
        process.exit(1);
    }

    // Dynamically import the values
    let values;
    try {
        const imported = await import(`../../${valuesPath}`);
        values = imported.values;
    } catch (error) {
        console.error(`\n❌ Error loading ${valuesPath}:`, error);
        process.exit(1);
    }

    // Resolve all configuration
    const { config, errors } = resolveConfig(schema, values);

    if (errors.length > 0) {
        console.error("\n❌ Validation errors:");
        for (const error of errors) {
            console.error(`  - ${error.key}: ${error.message}`);
        }
        process.exit(1);
    }

    // Sync to GitHub
    if (!targetFilter || targetFilter === "github") {
        await syncToGitHub(env, config.all);
    }

    // Sync to Vercel
    if (!targetFilter || targetFilter === "vercel") {
        await syncToVercel(env, config.all);
    }
}

async function syncToGitHub(env: string, config: Record<string, string>) {
    console.log(`\n🐙 Syncing to GitHub environment: ${env}`);

    const missingSecrets: string[] = [];
    const secretsToSync: Array<{ key: string; value: string }> = [];

    // Collect secrets
    for (const key of GITHUB_SECRETS) {
        const value = config[key];
        if (!value) {
            missingSecrets.push(key);
        } else {
            secretsToSync.push({ key, value });
        }
    }

    if (missingSecrets.length > 0) {
        console.warn(`\n⚠️  Warning: Missing secrets for GitHub:`);
        for (const key of missingSecrets) {
            console.warn(`   - ${key}`);
        }
    }

    console.log(`\n📝 Secrets to sync: ${secretsToSync.length}`);
    for (const { key } of secretsToSync) {
        console.log(`   ✓ ${key}`);
    }

    if (isDryRun) {
        console.log(`\n🔍 [DRY RUN] Would sync ${secretsToSync.length} secrets to GitHub`);
        return;
    }

    // Sync each secret
    console.log(`\n🚀 Syncing secrets to GitHub...`);
    let successCount = 0;
    let errorCount = 0;

    for (const { key, value } of secretsToSync) {
        try {
            // Use GitHub CLI to set environment secret
            execSync(
                `gh secret set ${key} --env ${env} --body "${value.replace(/"/g, '\\"')}"`,
                { stdio: "pipe" }
            );
            console.log(`   ✅ ${key}`);
            successCount++;
        } catch (error: any) {
            console.error(`   ❌ ${key}: ${error.message}`);
            errorCount++;
        }
    }

    console.log(`\n📊 GitHub sync results: ${successCount} succeeded, ${errorCount} failed`);
}

async function syncToVercel(env: string, config: Record<string, string>) {
    console.log(`\n▲ Syncing to Vercel environment: ${env}`);

    // Get the project ID and org ID for this environment
    const projectId = config.VERCEL_PROJECT_ID;
    const orgId = config.VERCEL_ORG_ID;

    if (!projectId) {
        console.error(`\n❌ Error: VERCEL_PROJECT_ID not found in ${env} config`);
        console.error(`   Each environment must have its own VERCEL_PROJECT_ID`);
        return;
    }

    if (!orgId) {
        console.error(`\n❌ Error: VERCEL_ORG_ID not found in ${env} config`);
        return;
    }

    console.log(`📋 Project ID: ${projectId}`);
    console.log(`📋 Org ID: ${orgId}`);

    // Write .vercel/project.json to "link" the project
    const vercelDir = ".vercel";
    const vercelProjectPath = join(vercelDir, "project.json");

    if (!existsSync(vercelDir)) {
        mkdirSync(vercelDir, { recursive: true });
    }

    const vercelProject = {
        projectId: projectId,
        orgId: orgId,
    };

    writeFileSync(vercelProjectPath, JSON.stringify(vercelProject, null, 2));
    console.log(`🔗 Linked to Vercel project: ${vercelProjectPath}`);

    const missingSecrets: string[] = [];
    const secretsToSync: Array<{ key: string; value: string }> = [];

    // Collect secrets
    for (const key of VERCEL_SECRETS) {
        const value = config[key];
        if (!value) {
            missingSecrets.push(key);
        } else {
            secretsToSync.push({ key, value });
        }
    }

    if (missingSecrets.length > 0) {
        console.warn(`\n⚠️  Warning: Missing secrets for Vercel:`);
        for (const key of missingSecrets) {
            console.warn(`   - ${key}`);
        }
    }

    console.log(`\n📝 Secrets to sync: ${secretsToSync.length}`);
    for (const { key } of secretsToSync) {
        console.log(`   ✓ ${key}`);
    }

    if (isDryRun) {
        console.log(`\n🔍 [DRY RUN] Would sync ${secretsToSync.length} secrets to Vercel project ${projectId}`);
        return;
    }

    // Always sync as "production" secrets to the respective project
    const vercelEnv = "production";

    // Sync each secret - always remove + add to ensure proper replacement
    console.log(`\n🚀 Syncing secrets to Vercel project (${vercelEnv})...`);
    let successCount = 0;
    let errorCount = 0;

    for (const { key, value } of secretsToSync) {
        try {
            // Remove existing secret (ignore errors if it doesn't exist)
            try {
                execSync(
                    `npx vercel env rm ${key} ${vercelEnv} --yes`,
                    { stdio: "pipe" }
                );
            } catch {
                // Secret doesn't exist yet, that's fine
            }

            // Add the secret to the linked project
            execSync(
                `echo "${value.replace(/"/g, '\\"')}" | npx vercel env add ${key} ${vercelEnv}`,
                { stdio: "pipe", shell: "/bin/bash" }
            );
            console.log(`   ✅ ${key}`);
            successCount++;
        } catch (error: any) {
            console.error(`   ❌ ${key}: ${error.message}`);
            errorCount++;
        }
    }

    console.log(`\n📊 Vercel sync results: ${successCount} succeeded, ${errorCount} failed`);
}

function checkGitHubCLI() {
    try {
        execSync("gh --version", { stdio: "pipe" });
    } catch (error) {
        console.error("\n❌ GitHub CLI (gh) is not installed\n");
        console.error("GitHub CLI is a system-level tool and must be installed separately:");
        console.error("");
        console.error("  macOS:   brew install gh");
        console.error("  Linux:   See https://github.com/cli/cli/blob/trunk/docs/install_linux.md");
        console.error("  Windows: See https://github.com/cli/cli#installation");
        console.error("");
        console.error("After installation, authenticate with: gh auth login");
        console.error("");
        console.error("💡 Tip: To sync only to Vercel, use: --target vercel");
        console.error("");
        process.exit(1);
    }

    // Check if authenticated
    try {
        execSync("gh auth status", { stdio: "pipe" });
    } catch (error) {
        console.error("\n❌ GitHub CLI is not authenticated\n");
        console.error("Run: gh auth login");
        console.error("");
        console.error("💡 Tip: To sync only to Vercel, use: --target vercel");
        console.error("");
        process.exit(1);
    }
}

function checkVercelCLI() {
    try {
        execSync("npx vercel --version", { stdio: "pipe" });
    } catch (error) {
        console.error("❌ Vercel CLI is not available");
        console.error("   It should be in your devDependencies\n");
        process.exit(1);
    }

    // Check if authenticated (this will prompt if not)
    try {
        execSync("npx vercel whoami", { stdio: "pipe" });
    } catch (error) {
        console.error("❌ Vercel CLI is not authenticated");
        console.error("   Run: npx vercel login\n");
        process.exit(1);
    }
}

function printUsageAndExit() {
    console.log("Usage:");
    console.log("  bun scripts/sync-deployment-secrets.ts [options]");
    console.log("");
    console.log("Options:");
    console.log("  --dry-run              Preview changes without applying them");
    console.log("  --env <environment>    Sync only specified environment (development|production)");
    console.log("  --target <target>      Sync only to specified target (github|vercel)");
    console.log("");
    console.log("Examples:");
    console.log("  bun scripts/sync-deployment-secrets.ts");
    console.log("  bun scripts/sync-deployment-secrets.ts --dry-run");
    console.log("  bun scripts/sync-deployment-secrets.ts --env production");
    console.log("  bun scripts/sync-deployment-secrets.ts --target github");
    console.log("  bun scripts/sync-deployment-secrets.ts --env development --target vercel");
    process.exit(1);
}

main().catch((err) => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
});
