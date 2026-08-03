import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import * as TOML from "@iarna/toml";
import type { ConfigSchema } from "../core";
import {
  coerceTomlValue,
  getEnvEntries,
  getNestedValue,
  parseEnvFile,
} from "../render";
import { inspectEnvironment } from "./check";
import { loadUserSchema } from "./utils";

interface Difference {
  key: string;
  status: "changed" | "extra" | "invalid" | "missing";
}

export async function diffCommand(
  environment: string,
  options: { cwd?: string },
): Promise<boolean> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const schema = await loadUserSchema(cwd);
  const inspection = await inspectEnvironment(schema, environment, cwd);

  if (inspection.errors.length > 0) {
    console.error(`❌ Cannot diff invalid environment "${environment}":`);
    for (const error of inspection.errors) {
      console.error(`  - ${error.key}: ${error.message}`);
    }
    return false;
  }

  const differences = [
    ...diffEnvFiles(schema, inspection.config.all, cwd),
    ...diffConfigFiles(schema, inspection.config.all, cwd),
  ];

  if (differences.length === 0) {
    console.log(`✅ Generated configuration for ${environment} is up to date`);
    return true;
  }

  console.log(`Configuration drift for ${environment} (values redacted):`);
  for (const difference of differences) {
    const marker =
      difference.status === "missing"
        ? "+"
        : difference.status === "extra"
          ? "-"
          : difference.status === "changed"
            ? "~"
            : "!";
    console.log(`  ${marker} ${difference.key} (${difference.status})`);
  }
  console.log(
    `\nRun king-config generate ${environment} to reconcile local outputs.`,
  );
  return false;
}

function diffEnvFiles(
  schema: ConfigSchema,
  config: Record<string, string>,
  cwd: string,
): Difference[] {
  const differences: Difference[] = [];

  for (const [name, definition] of Object.entries(schema.envfiles)) {
    const path = resolveInsideProject(cwd, definition.path);
    if (!existsSync(path)) {
      differences.push({ key: `envfiles.${name}`, status: "missing" });
      continue;
    }

    const actual = parseEnvFile(readFileSync(path, "utf8"));
    for (const error of actual.errors) {
      differences.push({
        key: `envfiles.${name}: ${error}`,
        status: "invalid",
      });
    }

    const expected = new Map(
      getEnvEntries(config, definition).map(({ key, value }) => [key, value]),
    );
    for (const [key, value] of expected) {
      if (!actual.entries.has(key)) {
        differences.push({
          key: `${definition.path}:${key}`,
          status: "missing",
        });
      } else if (actual.entries.get(key) !== value) {
        differences.push({
          key: `${definition.path}:${key}`,
          status: "changed",
        });
      }
    }
    for (const key of actual.entries.keys()) {
      if (!expected.has(key)) {
        differences.push({ key: `${definition.path}:${key}`, status: "extra" });
      }
    }
  }

  return differences;
}

function diffConfigFiles(
  schema: ConfigSchema,
  config: Record<string, string>,
  cwd: string,
): Difference[] {
  const differences: Difference[] = [];

  for (const [name, definition] of Object.entries(schema.configs ?? {})) {
    const path = resolveInsideProject(cwd, definition.path);
    if (!existsSync(path)) {
      differences.push({ key: `configs.${name}`, status: "missing" });
      continue;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = TOML.parse(readFileSync(path, "utf8"));
    } catch (error: unknown) {
      differences.push({
        key: `configs.${name}: ${error instanceof Error ? error.message : String(error)}`,
        status: "invalid",
      });
      continue;
    }

    for (const [destination, sourceKey] of Object.entries(
      definition.mappings,
    )) {
      const sourceValue = config[sourceKey];
      if (sourceValue === undefined) continue;
      const expected = coerceTomlValue(destination, sourceValue);
      const actual = getNestedValue(parsed, destination);
      if (actual !== expected) {
        differences.push({
          key: `${definition.path}:${destination}`,
          status: actual === undefined ? "missing" : "changed",
        });
      }
    }
  }

  return differences;
}

function resolveInsideProject(cwd: string, configuredPath: string): string {
  const destination = resolve(cwd, configuredPath);
  const pathFromRoot = relative(cwd, destination);
  if (
    isAbsolute(configuredPath) ||
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`)
  ) {
    throw new Error(
      `Output path must stay inside the project: ${configuredPath}`,
    );
  }
  return destination;
}
