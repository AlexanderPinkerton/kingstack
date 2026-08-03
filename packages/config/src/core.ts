/**
 * Pure schema resolution and validation for the configuration system.
 */

export interface EnvironmentDefinition {
  /** Human-readable purpose of the environment. */
  description?: string;
  /** Behavioral profile used by computed values and conditional requirements. */
  mode: string;
  /** Whether this environment is eligible for remote secret synchronization. */
  sync?: boolean;
}

export interface ResolveContext {
  environment: string;
  mode: string;
  definition?: EnvironmentDefinition;
}

export interface ConfigDefinition {
  /** Whether this value must be supplied when no default exists. */
  required?: boolean;
  /** Environment-aware requiredness, evaluated in addition to `required`. */
  requiredWhen?: (context: ResolveContext) => boolean;
  /** Default value if an environment does not provide one. */
  default?: string;
  /** Description shown by diagnostics and environment scaffolding. */
  description?: string;
  /** Whether diagnostics should treat the value as sensitive. */
  sensitive?: boolean;
  /** Optional runtime validation. Return a message when invalid. */
  validate?: (value: string, context: ResolveContext) => string | undefined;
}

export interface EnvFileConfig {
  /** Path to the .env file, relative to the project root. */
  path: string;
  /** Keys from core or computed configuration emitted without renaming. */
  keys: string[];
  /** Source configuration key to generated output key. */
  aliases?: Record<string, string>;
}

export interface ConfigFileMapping {
  /** Path to the config file, relative to the project root. */
  path: string;
  /** TOML is the only currently supported structured config format. */
  format: "toml";
  /** Destination path to source configuration key. */
  mappings: Record<string, string>;
}

export interface ServiceConfig {
  description: string;
  keys: string[];
}

export interface ConfigSchema {
  /** Canonical environment names and their behavior. */
  environments?: Record<string, EnvironmentDefinition>;
  /** User-provided configuration inputs. */
  core: Record<string, ConfigDefinition>;
  /** Values derived from resolved inputs and environment context. */
  computed: (
    core: Record<string, string>,
    context: ResolveContext,
  ) => Record<string, string>;
  envfiles: Record<string, EnvFileConfig>;
  configs?: Record<string, ConfigFileMapping>;
  services?: Record<string, ServiceConfig>;
}

export type ConfigValues = Record<string, string>;

/** Schema-linked value-file shape for editor feedback and excess-key checks. */
export type ConfigValuesFor<Schema extends ConfigSchema> = Partial<{
  [Key in keyof Schema["core"]]: string;
}>;

export interface ResolvedConfig {
  core: Record<string, string>;
  computed: Record<string, string>;
  all: Record<string, string>;
}

export interface ValidationError {
  key: string;
  message: string;
}

export interface ResolveOptions {
  environment?: string;
}

/** Preserve the schema literal while providing contextual typing. */
export function defineSchema<const Schema extends ConfigSchema>(
  schema: Schema,
): Schema {
  return schema;
}

/** Preserve value-file literals; use ConfigValuesFor for schema-linked checks. */
export function defineValues<const Values extends ConfigValues>(
  values: Values,
): Values {
  return values;
}

export function getResolveContext(
  schema: ConfigSchema,
  environment?: string,
): { context: ResolveContext; errors: ValidationError[] } {
  const name = environment ?? "default";
  const definition = schema.environments?.[name];

  if (environment && schema.environments && !definition) {
    return {
      context: { environment: name, mode: name },
      errors: [
        {
          key: `environments.${name}`,
          message: `Environment "${name}" is not declared in the schema`,
        },
      ],
    };
  }

  return {
    context: {
      environment: name,
      mode: definition?.mode ?? name,
      definition,
    },
    errors: [],
  };
}

/** Validate inputs, reject stale keys, and apply defaults. */
export function validateAndResolve(
  schema: ConfigSchema,
  values: ConfigValues,
  options: ResolveOptions = {},
): { resolved: Record<string, string>; errors: ValidationError[] } {
  const { context, errors } = getResolveContext(schema, options.environment);
  const resolved: Record<string, string> = {};

  for (const [key, value] of Object.entries(values)) {
    if (!(key in schema.core)) {
      errors.push({
        key,
        message: `Unknown configuration value "${key}"; remove it or declare it in schema.core`,
      });
      continue;
    }
    if (typeof value !== "string") {
      errors.push({
        key,
        message: `Configuration value "${key}" must be a string`,
      });
    }
  }

  for (const [key, definition] of Object.entries(schema.core)) {
    const value = values[key];
    const hasValue = typeof value === "string" && value !== "";
    let required = definition.required === true;

    if (definition.requiredWhen) {
      try {
        required = definition.requiredWhen(context) || required;
      } catch (error: unknown) {
        errors.push({
          key,
          message: `Requiredness check failed for "${key}": ${getErrorMessage(error)}`,
        });
      }
    }

    if (hasValue) {
      resolved[key] = value;
    } else if (definition.default !== undefined) {
      resolved[key] = definition.default;
    } else if (required) {
      errors.push({
        key,
        message: `Required configuration value "${key}" is missing for environment "${context.environment}"`,
      });
    }

    const resolvedValue = resolved[key];
    if (resolvedValue !== undefined && definition.validate) {
      try {
        const message = definition.validate(resolvedValue, context);
        if (message) errors.push({ key, message });
      } catch (error: unknown) {
        errors.push({
          key,
          message: `Validation failed for "${key}": ${getErrorMessage(error)}`,
        });
      }
    }
  }

  return { resolved, errors };
}

/** Resolve core and computed values without performing I/O. */
export function resolveConfig(
  schema: ConfigSchema,
  values: ConfigValues,
  options: ResolveOptions = {},
): { config: ResolvedConfig; errors: ValidationError[] } {
  const { resolved: core, errors } = validateAndResolve(
    schema,
    values,
    options,
  );
  const { context } = getResolveContext(schema, options.environment);

  if (errors.length > 0) return emptyResolution(errors);

  let computedValue: unknown;
  try {
    computedValue = schema.computed(core, context);
  } catch (error: unknown) {
    return emptyResolution([
      {
        key: "computed",
        message: `Computed configuration failed: ${getErrorMessage(error)}`,
      },
    ]);
  }

  if (!isRecord(computedValue)) {
    return emptyResolution([
      {
        key: "computed",
        message: "Computed configuration must return an object",
      },
    ]);
  }

  const computed: Record<string, string> = {};
  const computedErrors: ValidationError[] = [];
  for (const [key, value] of Object.entries(computedValue)) {
    if (key in core) {
      computedErrors.push({
        key: `computed.${key}`,
        message: `Computed value "${key}" collides with a core value`,
      });
    }
    if (typeof value !== "string") {
      computedErrors.push({
        key: `computed.${key}`,
        message: `Computed value "${key}" must be a string`,
      });
    } else {
      computed[key] = value;
    }
  }

  if (computedErrors.length > 0) return emptyResolution(computedErrors);

  const all = { ...core, ...computed };
  return { config: { core, computed, all }, errors: [] };
}

/** Validate every output mapping against a resolved configuration. */
export function validateSchemaMappings(
  schema: ConfigSchema,
  allKeys: Set<string>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const outputPaths = new Map<string, string>();
  const knownKeys = new Set([...Object.keys(schema.core), ...allKeys]);

  for (const [name, definition] of Object.entries(schema.environments ?? {})) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
      errors.push({
        key: `environments.${name}`,
        message: `Environment name "${name}" may contain only letters, numbers, underscores, and hyphens`,
      });
    }
    if (!definition.mode.trim()) {
      errors.push({
        key: `environments.${name}.mode`,
        message: `Environment "${name}" must declare a non-empty mode`,
      });
    }
  }

  for (const [envfileName, config] of Object.entries(schema.envfiles)) {
    registerOutputPath(
      outputPaths,
      config.path,
      `envfiles.${envfileName}`,
      errors,
    );
    const emittedNames = new Set<string>();

    for (const key of config.keys) {
      validateReferencedKey(
        knownKeys,
        key,
        `${envfileName}.${key}`,
        `Environment file "${envfileName}"`,
        errors,
      );
      if (emittedNames.has(key)) {
        errors.push({
          key: `envfiles.${envfileName}.${key}`,
          message: `Environment file "${envfileName}" emits "${key}" more than once`,
        });
      }
      validateSensitiveOutput(
        schema,
        key,
        key,
        `envfiles.${envfileName}.${key}`,
        errors,
      );
      emittedNames.add(key);
    }

    for (const [sourceKey, targetKey] of Object.entries(config.aliases ?? {})) {
      validateReferencedKey(
        knownKeys,
        sourceKey,
        `${envfileName}.aliases.${sourceKey}`,
        `Environment file "${envfileName}" alias`,
        errors,
      );
      if (emittedNames.has(targetKey)) {
        errors.push({
          key: `envfiles.${envfileName}.aliases.${sourceKey}`,
          message: `Environment file "${envfileName}" emits "${targetKey}" more than once`,
        });
      }
      validateSensitiveOutput(
        schema,
        sourceKey,
        targetKey,
        `envfiles.${envfileName}.aliases.${sourceKey}`,
        errors,
      );
      emittedNames.add(targetKey);
    }
  }

  for (const [configName, config] of Object.entries(schema.configs ?? {})) {
    registerOutputPath(
      outputPaths,
      config.path,
      `configs.${configName}`,
      errors,
    );
    for (const [destination, sourceKey] of Object.entries(config.mappings)) {
      validateReferencedKey(
        knownKeys,
        sourceKey,
        `${configName}.${destination}`,
        `Config file "${configName}" mapping`,
        errors,
      );
    }
  }

  for (const [serviceName, service] of Object.entries(schema.services ?? {})) {
    const seen = new Set<string>();
    for (const key of service.keys) {
      validateReferencedKey(
        knownKeys,
        key,
        `${serviceName}.${key}`,
        `Service "${serviceName}"`,
        errors,
      );
      if (seen.has(key)) {
        errors.push({
          key: `services.${serviceName}.${key}`,
          message: `Service "${serviceName}" references "${key}" more than once`,
        });
      }
      seen.add(key);
    }
  }

  return errors;
}

/** Backward-compatible envfile-only validation helper. */
export function validateEnvFileKeys(
  schema: ConfigSchema,
  allKeys: Set<string>,
): ValidationError[] {
  const schemaWithoutOtherMappings: ConfigSchema = {
    ...schema,
    configs: undefined,
    services: undefined,
  };
  return validateSchemaMappings(schemaWithoutOtherMappings, allKeys).filter(
    (error) => !error.key.startsWith("environments."),
  );
}

function emptyResolution(errors: ValidationError[]): {
  config: ResolvedConfig;
  errors: ValidationError[];
} {
  return { config: { core: {}, computed: {}, all: {} }, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validateReferencedKey(
  allKeys: Set<string>,
  sourceKey: string,
  errorKey: string,
  owner: string,
  errors: ValidationError[],
): void {
  if (!allKeys.has(sourceKey)) {
    errors.push({
      key: errorKey,
      message: `${owner} references unknown key "${sourceKey}"`,
    });
  }
}

function registerOutputPath(
  paths: Map<string, string>,
  path: string,
  owner: string,
  errors: ValidationError[],
): void {
  const existingOwner = paths.get(path);
  if (existingOwner) {
    errors.push({
      key: owner,
      message: `Output path "${path}" is already owned by ${existingOwner}`,
    });
  } else {
    paths.set(path, owner);
  }
}

function validateSensitiveOutput(
  schema: ConfigSchema,
  sourceKey: string,
  targetKey: string,
  owner: string,
  errors: ValidationError[],
): void {
  if (
    schema.core[sourceKey]?.sensitive === true &&
    targetKey.startsWith("NEXT_PUBLIC_")
  ) {
    errors.push({
      key: owner,
      message: `Sensitive value "${sourceKey}" cannot be emitted as public key "${targetKey}"`,
    });
  }
}
