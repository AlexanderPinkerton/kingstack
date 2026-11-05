import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { EnvironmentDefinition } from "../core";
import { inspectEnvironment } from "./check";
import { loadUserSchema } from "./utils";
import { renderJsonFile } from "../render";

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

  let vercelMajor = 65;
  if (!isDryRun) {
    if (targets.includes("github")) checkCommandAvailable("gh", ["--version"]);
    if (targets.includes("vercel")) {
      const version = checkCommandAvailable("vercel", ["--version"]);
      const match = /Vercel CLI (\d+)\./i.exec(version);
      if (!match)
        throw new Error("Could not identify the installed Vercel CLI version");
      vercelMajor = Number(match[1]);
    }
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
              schema.services?.[syncTarget]?.optionalKeys,
            )
          : syncToVercel(
              environment,
              inspection.config.all,
              keys,
              isDryRun,
              cwd,
              schema.services?.[syncTarget]?.optionalKeys,
              vercelMajor,
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
  optionalKeys: string[] = [],
): boolean {
  console.log(`\n🐙 GitHub environment: ${environment}`);

  const secrets = collectRequiredValues(
    config,
    keys,
    "GitHub secret sync",
    optionalKeys,
  );
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
  optionalKeys: string[] = [],
  vercelMajor = 65,
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
    optionalKeys,
  );
  if (!secrets) return false;
  if (isDryRun) {
    console.log(
      `   Would link the configured project and sync ${secrets.length} values`,
    );
    return true;
  }

  const vercelDirectory = resolve(cwd, ".vercel");
  const projectPath = join(vercelDirectory, "project.json");
  const projectContent = renderJsonFile(
    existsSync(projectPath) ? readFileSync(projectPath, "utf8") : "{}",
    config,
    {
      path: ".vercel/project.json",
      format: "json",
      mappings: { projectId: "VERCEL_PROJECT_ID", orgId: "VERCEL_ORG_ID" },
    },
  );
  if (!existsSync(vercelDirectory))
    mkdirSync(vercelDirectory, { recursive: true });
  writeFileSync(projectPath, projectContent);

  // Each configured KingStack environment maps to a separate Vercel project's
  // production environment.
  const vercelEnvironment = "production";
  let succeeded = true;
  for (const { key, value } of secrets) {
    const environmentArgs =
      vercelMajor >= 65
        ? ["--environment", vercelEnvironment]
        : [vercelEnvironment];
    const args = ["env", "add", key, ...environmentArgs, "--force"];
    // Vercel CLI 65 requires explicit consent for credential-shaped public
    // values. Stripe publishable keys are public by design; private keys and
    // unrelated values must retain Vercel's normal credential checks.
    if (
      vercelMajor >= 65 &&
      key.startsWith("NEXT_PUBLIC_") &&
      /^pk_(test|live)_[A-Za-z0-9]+$/.test(value)
    ) {
      args.push("--type", "config");
    }
    const result = spawnSync("vercel", args, {
      cwd,
      encoding: "utf8",
      input: value,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
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
  optionalKeys: string[] = [],
): Array<{ key: string; value: string }> | undefined {
  const missing = keys.filter((key) => !config[key]);
  if (missing.length > 0) {
    console.error(`   ❌ ${operation} requires: ${missing.join(", ")}`);
    return undefined;
  }
  return [...keys, ...optionalKeys.filter((key) => !!config[key])].map(
    (key) => ({ key, value: config[key] }),
  );
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

function checkCommandAvailable(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
  });
  if (result.status !== 0) throw new Error(`${command} CLI is not available`);
  return `${result.stdout || ""}\n${result.stderr || ""}`;
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
