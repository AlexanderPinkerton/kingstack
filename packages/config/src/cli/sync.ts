import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  EnvironmentMode,
  getResolveContext,
  type EnvironmentDefinition,
} from "../core";
import { inspectEnvironment } from "./check";
import { loadUserSchema } from "./utils";
import { renderJsonFile } from "../render";
import { resolveSupabaseAuthSettings } from "../supabase-auth";
import { syncToSupabaseAuth } from "./supabase-sync";

export async function syncCommand(options: {
  cwd?: string;
  env?: string;
  target?: string;
  dryRun?: boolean;
}): Promise<boolean> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const schema = await loadUserSchema(cwd);
  const targets = options.target
    ? [options.target]
    : Object.keys(schema.services ?? {});
  if (targets.length === 0)
    throw new Error("No sync services are declared in the schema");
  for (const target of targets) {
    const service = schema.services?.[target];
    if (!service) throw new Error(`No services.${target} mapping is defined`);
    if (
      service.provider !== "supabase-auth" &&
      target !== "github" &&
      target !== "vercel"
    )
      throw new Error(
        `Unknown sync target "${target}"; expected github, vercel, or a service with provider: supabase-auth`,
      );
  }
  const environments = options.env
    ? [options.env]
    : getDefaultSyncEnvironments(schema.environments);
  const isDryRun = options.dryRun === true;

  if (environments.length === 0) {
    console.error("❌ No environments are marked with sync: true");
    return false;
  }

  console.log(
    `🔐 Deployment Configuration Sync${isDryRun ? " (dry run)" : ""}\n`,
  );
  const inspections = await Promise.all(
    environments.map((environment) =>
      inspectEnvironment(schema, environment, cwd),
    ),
  );
  const supabasePlans = new Map<
    string,
    ReturnType<typeof resolveSupabaseAuthSettings>
  >();
  for (const inspection of inspections) {
    const { context } = getResolveContext(schema, inspection.environment);
    if (inspection.errors.length) continue;
    for (const target of targets) {
      const service = schema.services![target];
      if (service.provider !== "supabase-auth") continue;
      if (
        context.mode === EnvironmentMode.Local ||
        context.definition?.sync === false
      ) {
        inspection.errors.push({
          key: `environments.${inspection.environment}`,
          message:
            "This environment is not eligible for hosted Supabase configuration sync",
        });
        continue;
      }
      try {
        supabasePlans.set(
          `${inspection.environment}:${target}`,
          resolveSupabaseAuthSettings(service, inspection.config.all),
        );
      } catch (error) {
        inspection.errors.push({
          key: `services.${target}`,
          message:
            error instanceof Error
              ? error.message
              : "Invalid Supabase Auth configuration",
        });
      }
    }
  }
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
      const service = schema.services![syncTarget];
      if (service.provider === "supabase-auth") {
        const plan = supabasePlans.get(`${environment}:${syncTarget}`)!;
        if (
          !(await syncToSupabaseAuth({
            ...plan,
            environment,
            cwd,
            dryRun: isDryRun,
          }))
        )
          failed = true;
        continue;
      }
      const keys = service.keys;
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
              service.optionalKeys,
            )
          : syncToVercel(
              environment,
              inspection.config.all,
              keys,
              isDryRun,
              cwd,
              service.optionalKeys,
              vercelMajor,
            );
      if (!succeeded) failed = true;
    }
  }

  if (failed) {
    console.error(
      "\n❌ Configuration synchronization completed with errors; review the failed services above",
    );
    return false;
  }
  console.log(
    `\n✅ ${isDryRun ? "Configuration synchronization plan is valid" : "Configuration synchronization completed"}`,
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
