import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { resolveConfig } from "../core";
import { loadUserSchema, loadUserValues } from "./utils";

export async function syncCommand(options: { cwd?: string; env?: string; target?: string; dryRun?: boolean }) {
    const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
    const envsToSync = options.env ? [options.env] : ["development", "production"];
    const isDryRun = !!options.dryRun;

    console.log("🔐 Deployment Secret Sync Tool\n");

    try {
        const schema = await loadUserSchema(cwd);

        // Check CLI tools
        if (!options.target || options.target === "github") checkGitHubCLI();
        if (!options.target || options.target === "vercel") checkVercelCLI();

        for (const env of envsToSync) {
            console.log(`\n📦 Environment: ${env}`);
            const values = await loadUserValues(env, cwd);
            const { config, errors } = resolveConfig(schema, values);

            if (errors.length > 0) {
                console.error("❌ Validation errors:");
                errors.forEach(e => console.error(`  - ${e.key}: ${e.message}`));
                process.exit(1);
            }

            if (!options.target || options.target === "github") {
                await syncToGitHub(env, config.all, schema.services?.github?.keys || [], isDryRun);
            }
            if (!options.target || options.target === "vercel") {
                await syncToVercel(env, config.all, schema.services?.vercel?.keys || [], isDryRun, cwd);
            }
        }
    } catch (error: any) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

async function syncToGitHub(env: string, config: Record<string, string>, keys: string[], isDryRun: boolean) {
    console.log(`\n🐙 Syncing to GitHub environment: ${env}`);
    const secretsToSync = keys.map(key => ({ key, value: config[key] })).filter(s => s.value);

    if (isDryRun) {
        console.log(`🔍 [DRY RUN] Would sync ${secretsToSync.length} secrets to GitHub`);
        return;
    }

    for (const { key, value } of secretsToSync) {
        try {
            execSync(`gh secret set ${key} --env ${env} --body "${value.replace(/"/g, '\\"')}"`, { stdio: "pipe" });
            console.log(`   ✅ ${key}`);
        } catch (e: any) {
            console.error(`   ❌ ${key}: ${e.message}`);
        }
    }
}

async function syncToVercel(env: string, config: Record<string, string>, keys: string[], isDryRun: boolean, cwd: string) {
    console.log(`\n▲ Syncing to Vercel environment: ${env}`);

    const projectId = config.VERCEL_PROJECT_ID;
    const orgId = config.VERCEL_ORG_ID;

    if (!projectId) {
        console.error(`\n❌ Error: VERCEL_PROJECT_ID not found in ${env} config`);
        return;
    }
    if (!orgId) {
        console.error(`\n❌ Error: VERCEL_ORG_ID not found in ${env} config`);
        return;
    }

    // Link project
    const vercelDir = resolve(cwd, ".vercel");
    const vercelProjectPath = join(vercelDir, "project.json");

    if (!existsSync(vercelDir)) {
        mkdirSync(vercelDir, { recursive: true });
    }

    const vercelProject = { projectId, orgId };
    writeFileSync(vercelProjectPath, JSON.stringify(vercelProject, null, 2));
    console.log(`🔗 Linked to Vercel project: ${vercelProjectPath}`);

    const secretsToSync = keys.map(key => ({ key, value: config[key] })).filter(s => s.value);

    if (isDryRun) {
        console.log(`🔍 [DRY RUN] Would sync ${secretsToSync.length} secrets to Vercel`);
        return;
    }

    const vercelEnv = "production"; // Always sync as production to the mapped project
    console.log(`\n🚀 Syncing secrets to Vercel project...`);

    for (const { key, value } of secretsToSync) {
        try {
            try {
                execSync(`npx vercel env rm ${key} ${vercelEnv} --yes`, { stdio: "pipe", cwd });
            } catch { }

            execSync(`echo "${value.replace(/"/g, '\\"')}" | npx vercel env add ${key} ${vercelEnv}`, { stdio: "pipe", shell: "/bin/bash", cwd });
            console.log(`   ✅ ${key}`);
        } catch (e: any) {
            console.error(`   ❌ ${key}: ${e.message}`);
        }
    }
}

function checkGitHubCLI() {
    try {
        execSync("gh --version", { stdio: "pipe" });
    } catch {
        throw new Error("GitHub CLI (gh) is not installed");
    }
}

function checkVercelCLI() {
    try {
        execSync("npx vercel --version", { stdio: "pipe" });
    } catch {
        throw new Error("Vercel CLI is not available");
    }
}
