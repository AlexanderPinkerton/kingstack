import { resolve } from "node:path";
import {
  getResolveContext,
  resolveConfig,
  validateSchemaMappings,
  type ConfigSchema,
  type ConfigValues,
  type ResolvedConfig,
  type ValidationError,
} from "../core";
import { listEnvironmentNames, loadUserSchema, loadUserValues } from "./utils";

export type ValueStatus =
  "default" | "explicit" | "invalid" | "missing" | "optional" | "unknown";

export interface EnvironmentInspection {
  config: ResolvedConfig;
  environment: string;
  errors: ValidationError[];
  statuses: Map<string, ValueStatus>;
  values?: ConfigValues;
}

export async function inspectEnvironment(
  schema: ConfigSchema,
  environment: string,
  cwd: string,
): Promise<EnvironmentInspection> {
  let values: ConfigValues;
  try {
    values = await loadUserValues(environment, cwd);
  } catch (error: unknown) {
    return {
      config: emptyConfig(),
      environment,
      errors: [
        {
          key: environment,
          message: error instanceof Error ? error.message : String(error),
        },
      ],
      statuses: buildStatuses(schema, {}, environment, []),
    };
  }

  const result = resolveConfig(schema, values, { environment });
  const errors = [...result.errors];
  if (errors.length === 0) {
    errors.push(
      ...validateSchemaMappings(
        schema,
        new Set(Object.keys(result.config.all)),
      ),
    );
  }

  return {
    config: result.config,
    environment,
    errors,
    statuses: buildStatuses(schema, values, environment, errors),
    values,
  };
}

export async function checkCommand(options: {
  all?: boolean;
  cwd?: string;
  environment?: string;
}): Promise<boolean> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const schema = await loadUserSchema(cwd);

  if (options.all && options.environment) {
    throw new Error("Choose an environment or --all, not both");
  }

  const environments = options.environment
    ? [options.environment]
    : listEnvironmentNames(schema, cwd);
  if (environments.length === 0) {
    console.error("❌ No environments were declared or discovered");
    return false;
  }

  const inspections = await Promise.all(
    environments.map((environment) =>
      inspectEnvironment(schema, environment, cwd),
    ),
  );

  printStatusMatrix(schema, inspections);

  const failed = inspections.filter(
    (inspection) => inspection.errors.length > 0,
  );
  if (failed.length === 0) {
    console.log(`\n✅ Configuration is valid for ${environments.join(", ")}`);
    return true;
  }

  console.error("\n❌ Configuration errors:");
  for (const inspection of failed) {
    console.error(`\n  ${inspection.environment}:`);
    for (const error of inspection.errors) {
      console.error(`    - ${error.key}: ${error.message}`);
    }
  }
  return false;
}

function buildStatuses(
  schema: ConfigSchema,
  values: ConfigValues,
  environment: string,
  errors: ValidationError[],
): Map<string, ValueStatus> {
  const statuses = new Map<string, ValueStatus>();
  const invalidKeys = new Set(
    errors
      .map((error) => error.key.replace(/^computed\./, ""))
      .filter((key) => key in schema.core),
  );
  const { context } = getResolveContext(schema, environment);

  for (const [key, definition] of Object.entries(schema.core)) {
    if (invalidKeys.has(key)) {
      statuses.set(key, "invalid");
      continue;
    }
    if (typeof values[key] === "string" && values[key] !== "") {
      statuses.set(key, "explicit");
      continue;
    }
    if (definition.default !== undefined) {
      statuses.set(key, "default");
      continue;
    }

    let required = definition.required === true;
    try {
      required = definition.requiredWhen?.(context) === true || required;
    } catch {
      required = true;
    }
    statuses.set(key, required ? "missing" : "optional");
  }

  for (const key of Object.keys(values)) {
    if (!(key in schema.core)) statuses.set(key, "unknown");
  }
  return statuses;
}

function printStatusMatrix(
  schema: ConfigSchema,
  inspections: EnvironmentInspection[],
): void {
  const keys = new Set(Object.keys(schema.core));
  for (const inspection of inspections) {
    for (const key of inspection.statuses.keys()) keys.add(key);
  }

  const keyList = [...keys].sort();
  const keyWidth = Math.max("KEY".length, ...keyList.map((key) => key.length));
  const columnWidths = inspections.map((inspection) =>
    Math.max(inspection.environment.length, 8),
  );

  console.log("Configuration value coverage (values redacted):\n");
  console.log(
    [
      "KEY".padEnd(keyWidth),
      ...inspections.map((inspection, index) =>
        inspection.environment.padEnd(columnWidths[index]),
      ),
    ].join("  "),
  );
  console.log(
    [
      "-".repeat(keyWidth),
      ...columnWidths.map((width) => "-".repeat(width)),
    ].join("  "),
  );

  for (const key of keyList) {
    console.log(
      [
        key.padEnd(keyWidth),
        ...inspections.map((inspection, index) =>
          (inspection.statuses.get(key) ?? "—").padEnd(columnWidths[index]),
        ),
      ].join("  "),
    );
  }
}

function emptyConfig(): ResolvedConfig {
  return { all: {}, computed: {}, core: {} };
}
