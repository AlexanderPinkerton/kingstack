import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  resolveConfig,
  validateEnvFileKeys,
  type ConfigSchema,
  type ConfigValues,
} from "@kingstack/config";
import { parsePort, sanitizeSlug } from "./options.js";

interface EnvFileDefinition {
  keys: string[];
  aliases?: Record<string, string>;
}

export interface ProjectDeploymentConfig {
  appSlug: string;
  prismaWorkspace: string;
  nestEnv: string;
  prismaEnv: NodeJS.ProcessEnv;
  port: number;
  backendUrl?: string;
}

function readJsonFile<T>(path: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (error) {
    throw new Error(`Could not parse ${path} JSON.`, { cause: error });
  }
}

export async function loadProjectConfig(
  environment: string,
): Promise<ProjectDeploymentConfig> {
  const requiredPaths = [
    "package.json",
    "apps/nest/Dockerfile",
    "config/schema.ts",
    `config/${environment}.ts`,
    "packages/prisma/package.json",
  ];
  const missing = requiredPaths.filter((path) => !existsSync(resolve(path)));
  if (missing.length > 0) {
    throw new Error(
      `Run from a KingStack project root. Missing: ${missing.join(", ")}`,
    );
  }

  const rootPackage = readJsonFile<{ name?: string }>(resolve("package.json"));
  const prismaPackage = readJsonFile<{ name?: string }>(
    resolve("packages/prisma/package.json"),
  );
  if (!rootPackage.name) throw new Error("package.json is missing its name.");
  if (!prismaPackage.name) {
    throw new Error("packages/prisma/package.json is missing its name.");
  }

  const schemaModule = (await import(
    pathToFileURL(resolve("config/schema.ts")).href
  )) as { schema?: ConfigSchema };
  const valuesModule = (await import(
    pathToFileURL(resolve(`config/${environment}.ts`)).href
  )) as { values?: ConfigValues };
  if (!schemaModule.schema)
    throw new Error("config/schema.ts exports no schema.");
  if (!valuesModule.values) {
    throw new Error(`config/${environment}.ts exports no values.`);
  }

  const result = resolveConfig(schemaModule.schema, valuesModule.values, {
    environment,
  });
  if (result.errors.length > 0) {
    throw new Error(
      `Configuration is invalid:\n${result.errors.map((error) => `- ${error.key}: ${error.message}`).join("\n")}`,
    );
  }
  const keyErrors = validateEnvFileKeys(
    schemaModule.schema,
    new Set(Object.keys(result.config.all)),
  );
  if (keyErrors.length > 0) {
    throw new Error(
      `Environment mappings are invalid:\n${keyErrors.map((error) => `- ${error.key}: ${error.message}`).join("\n")}`,
    );
  }

  validateHostedNestConfig(result.config.all, environment);

  const nestDefinition = schemaModule.schema.envfiles.nest;
  const prismaDefinition = schemaModule.schema.envfiles.prisma;
  if (!nestDefinition || !prismaDefinition) {
    throw new Error(
      "The KingStack schema must define nest and prisma envfiles.",
    );
  }

  const prismaEnv: NodeJS.ProcessEnv = {};
  for (const key of prismaDefinition.keys) {
    const value = result.config.all[key];
    if (value !== undefined) prismaEnv[key] = String(value);
  }

  return {
    appSlug: sanitizeSlug(rootPackage.name),
    prismaWorkspace: prismaPackage.name,
    nestEnv: renderEnvFile(result.config.all, nestDefinition),
    prismaEnv,
    port: parsePort(result.config.all.NEST_PORT),
    backendUrl:
      typeof result.config.all.NEXT_PUBLIC_NEST_BACKEND_URL === "string"
        ? result.config.all.NEXT_PUBLIC_NEST_BACKEND_URL
        : undefined,
  };
}

export function validateHostedNestConfig(
  allValues: Record<string, unknown>,
  environment: string,
): void {
  if (allValues.LOG_FORMAT === "pretty") {
    throw new Error(
      `config/${environment}.ts sets LOG_FORMAT=pretty. Hosted Nest deployments require LOG_FORMAT="json".`,
    );
  }
}

export function renderNestDeploymentEnv(
  nestEnv: string,
  withoutDatabase: boolean,
): string {
  if (!withoutDatabase) return nestEnv;
  return `${nestEnv.trimEnd()}\nPRISMA_CONNECT_ON_START=false\n`;
}

export function renderEnvFile(
  allValues: Record<string, unknown>,
  definition: EnvFileDefinition,
): string {
  const lines: string[] = [];

  for (const key of definition.keys) {
    appendEnvLine(lines, key, allValues[key]);
  }
  for (const [sourceKey, targetKey] of Object.entries(
    definition.aliases || {},
  )) {
    appendEnvLine(lines, targetKey, allValues[sourceKey]);
  }

  return `${lines.join("\n")}\n`;
}

function appendEnvLine(lines: string[], key: string, rawValue: unknown): void {
  if (rawValue === undefined) return;
  const value = String(rawValue);
  if (/[\r\n\0]/.test(value)) {
    throw new Error(
      `Configuration value ${key} cannot contain a newline or NUL.`,
    );
  }
  lines.push(`${key}=${value}`);
}
