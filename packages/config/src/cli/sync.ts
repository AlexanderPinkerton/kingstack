import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { EnvironmentDefinition } from "../core";
import { inspectEnvironment } from "./check";
import { loadUserSchema } from "./utils";

type SyncTarget = "github" | "vercel";

export async function syncCommand(options: {
  cwd?: string;
  env?: string;
  target?: string;
  dryRun?: boolean;
}): Promise<boolean> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const schema = await loadUserSchema(cwd);
  const target = parseTarget(options.target);
  const targets: SyncTarget[] = target ? [target] : ["github", "vercel"];
  const environments = options.env
    ? [options.env]
    : getDefaultSyncEnvironments(schema.environments);
  const isDryRun = options.dryRun === true;

  if (environments.length === 0) {
    console.error("❌ No environments are marked with sync: true");
    return false;
  }

  console.log(`🔐 Deployment Secret Sync${isDryRun ? " (dry run)" : ""}\n`);
  const inspections = await Promise.all(
    environments.map((environment) =>
      inspectEnvironment(schema, environment, cwd),
    ),
  );
  const invalidInspections = inspections.filter(
    (inspection) => inspection.errors.length > 0,
  );
  if (invalidInspections.length > 0) {
    for (const inspection of invalidInspections) {
      console.error(`❌ ${inspection.environment} configuration errors:`);
      printErrors(inspection.errors);
    }
    return false;
  }

  if (!isDryRun) {
    if (targets.includes("github")) checkCommandAvailable("gh", ["--version"]);
    if (targets.includes("vercel"))
      checkCommandAvailable("vercel", ["--version"]);
  }

  let failed = false;
  for (const inspection of inspections) {
    const { environment } = inspection;
    console.log(`\n📦 Environment: ${environment}`);

    for (const syncTarget of targets) {
      const keys = schema.services?.[syncTarget]?.keys;
      if (!keys) {
        console.error(`❌ No services.${syncTarget} mapping is defined`);
        failed = true;
        continue;
      }

      const succeeded =
        syncTarget === "github"
          ? syncToGitHub(
              environment,
              inspection.config.all,
              keys,
              isDryRun,
              cwd,
            )
          : syncToVercel(
              environment,
              inspection.config.all,
              keys,
              isDryRun,
              cwd,
            );
      if (!succeeded) failed = true;
    }
  }

  if (failed) {
    console.error("\n❌ Secret synchronization completed with errors");
    return false;
  }
  console.log(
    `\n✅ ${isDryRun ? "Secret synchronization plan is valid" : "Secret synchronization completed"}`,
  );
  return true;
}

function syncToGitHub(
  environment: string,
  config: Record<string, string>,
  keys: string[],
  isDryRun: boolean,
  cwd: string,
): boolean {
  console.log(`\n🐙 GitHub environment: ${environment}`);

  const secrets = collectRequiredValues(config, keys, "GitHub secret sync");
  if (!secrets) return false;

  if (isDryRun) {
    console.log(`   Would sync ${secrets.length} secrets`);
    return true;
  }

  let succeeded = true;
  for (const { key, value } of secrets) {
    const result = spawnSync(
      "gh",
      ["secret", "set", key, "--env", environment],
      {
        cwd,
        encoding: "utf8",
        input: value,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    if (result.status === 0) {
      console.log(`   ✅ ${key}`);
    } else {
      console.error(`   ❌ ${key}: ${commandError(result)}`);
      succeeded = false;
    }
  }
  return succeeded;
}

function syncToVercel(
  environment: string,
  config: Record<string, string>,
  keys: string[],
  isDryRun: boolean,
  cwd: string,
): boolean {
  const projectId = config.VERCEL_PROJECT_ID;
  const orgId = config.VERCEL_ORG_ID;
  console.log(`\n▲ Vercel project for environment: ${environment}`);

  if (!projectId || !orgId) {
    console.error("   ❌ VERCEL_PROJECT_ID and VERCEL_ORG_ID are required");
    return false;
  }
  const secrets = collectRequiredValues(
    config,
    keys,
    "Vercel environment sync",
  );
  if (!secrets) return false;
  if (isDryRun) {
    console.log(
      `   Would link the configured project and sync ${secrets.length} values`,
    );
    return true;
  }

  const vercelDirectory = resolve(cwd, ".vercel");
  if (!existsSync(vercelDirectory))
    mkdirSync(vercelDirectory, { recursive: true });
  writeFileSync(
    join(vercelDirectory, "project.json"),
    `${JSON.stringify({ projectId, orgId }, null, 2)}\n`,
  );

  // Each configured KingStack environment maps to a separate Vercel project's
  // production environment.
  const vercelEnvironment = "production";
  let succeeded = true;
  for (const { key, value } of secrets) {
    const result = spawnSync(
      "vercel",
      ["env", "add", key, vercelEnvironment, "--force"],
      {
        cwd,
        encoding: "utf8",
        input: value,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    if (result.status === 0) {
      console.log(`   ✅ ${key}`);
    } else {
      console.error(`   ❌ ${key}: ${commandError(result)}`);
      succeeded = false;
    }
  }
  return succeeded;
}

function collectRequiredValues(
  config: Record<string, string>,
  keys: string[],
  operation: string,
): Array<{ key: string; value: string }> | undefined {
  const missing = keys.filter((key) => !config[key]);
  if (missing.length > 0) {
    console.error(`   ❌ ${operation} requires: ${missing.join(", ")}`);
    return undefined;
  }
  return keys.map((key) => ({ key, value: config[key] }));
}

function getDefaultSyncEnvironments(
  environments: Record<string, EnvironmentDefinition> | undefined,
): string[] {
  if (!environments) return ["development", "production"];
  return Object.entries(environments)
    .filter(([, definition]) => definition.sync === true)
    .map(([name]) => name);
}

function parseTarget(target: string | undefined): SyncTarget | undefined {
  if (target === undefined) return undefined;
  if (target === "github" || target === "vercel") return target;
  throw new Error(`Unknown sync target "${target}"; expected github or vercel`);
}

function checkCommandAvailable(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
  });
  if (result.status !== 0) throw new Error(`${command} CLI is not available`);
}

function commandError(result: ReturnType<typeof spawnSync>): string {
  if (result.error) return result.error.message;
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
  return stderr || `command exited with status ${String(result.status)}`;
}

function printErrors(errors: Array<{ key: string; message: string }>): void {
  for (const error of errors)
    console.error(`  - ${error.key}: ${error.message}`);
}
