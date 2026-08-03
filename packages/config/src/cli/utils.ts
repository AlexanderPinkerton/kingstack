import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { ConfigSchema, ConfigValues } from "../core";

const RESERVED_CONFIG_FILES = new Set(["example", "schema"]);

export async function loadUserSchema(
  cwd: string = process.cwd(),
): Promise<ConfigSchema> {
  const schemaPath = resolve(cwd, "config/schema.ts");
  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  const imported = (await import(pathToFileURL(schemaPath).href)) as {
    schema?: unknown;
  };
  if (!isRecord(imported.schema)) {
    throw new Error(
      `Schema module at ${schemaPath} must export an object named "schema"`,
    );
  }
  if (!isRecord(imported.schema.core)) {
    throw new Error(`Schema at ${schemaPath} must define a core object`);
  }
  if (typeof imported.schema.computed !== "function") {
    throw new Error(`Schema at ${schemaPath} must define a computed function`);
  }
  if (!isRecord(imported.schema.envfiles)) {
    throw new Error(`Schema at ${schemaPath} must define an envfiles object`);
  }
  return imported.schema as unknown as ConfigSchema;
}

export async function loadUserValues(
  environment: string,
  cwd: string = process.cwd(),
): Promise<ConfigValues> {
  assertEnvironmentName(environment);
  const valuesPath = resolve(cwd, `config/${environment}.ts`);
  if (!existsSync(valuesPath)) {
    throw new Error(`Values file not found at ${valuesPath}`);
  }

  const imported = (await import(pathToFileURL(valuesPath).href)) as {
    values?: unknown;
  };
  if (!isRecord(imported.values)) {
    throw new Error(
      `Values module at ${valuesPath} must export an object named "values"`,
    );
  }
  return imported.values as ConfigValues;
}

export function listEnvironmentNames(
  schema: ConfigSchema,
  cwd: string = process.cwd(),
): string[] {
  const names = new Set(Object.keys(schema.environments ?? {}));
  const configDirectory = resolve(cwd, "config");

  if (existsSync(configDirectory)) {
    for (const filename of readdirSync(configDirectory)) {
      const match = /^(.+)\.ts$/.exec(filename);
      if (match && !RESERVED_CONFIG_FILES.has(match[1])) names.add(match[1]);
    }
  }

  return [...names].sort();
}

export function valuesFileExists(
  environment: string,
  cwd: string = process.cwd(),
): boolean {
  assertEnvironmentName(environment);
  return existsSync(resolve(cwd, `config/${environment}.ts`));
}

export function assertEnvironmentName(environment: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(environment)) {
    throw new Error(
      `Invalid environment name "${environment}"; use letters, numbers, underscores, or hyphens`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
