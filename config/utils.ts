/**
 * Utility types and functions for the configuration system.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Definition of a single configuration value in the schema.
 */
export interface ConfigDefinition {
  /** Whether this value is required (no default) */
  required?: boolean;
  /** Default value if not provided */
  default?: string;
  /** Description of what this value is for */
  description?: string;
}

/**
 * Configuration for a single environment file.
 */
export interface EnvFileConfig {
  /** Path to the .env file (relative to repo root) */
  path: string;
  /** List of keys (from core or computed) to include in this file */
  keys: string[];
  /** Optional key aliases - map source key to output key name */
  aliases?: Record<string, string>;
}

/**
 * Configuration for a config file (TOML, JSON, YAML, etc.)
 */
export interface ConfigFileMapping {
  /** Path to the config file (relative to repo root) */
  path: string;
  /** Format of the config file */
  format: "toml" | "json" | "yaml";
  /** Mapping of config file paths to configuration keys */
  mappings: Record<string, string>;
}

/**
 * Configuration for external service secret syncing.
 */
export interface ServiceConfig {
  /** Description of what this service is for */
  description: string;
  /** List of keys (from core or computed) to sync to this service */
  keys: string[];
}

/**
 * Schema definition for all configuration.
 */
export interface ConfigSchema {
  /** Core configuration definitions (the inputs) */
  core: Record<string, ConfigDefinition>;
  /** Computed values derived from core configuration */
  computed: (core: Record<string, string>) => Record<string, string>;
  /** Mapping of environment files and their required keys */
  envfiles: Record<string, EnvFileConfig>;
  /** Mapping of config files to update */
  configs?: Record<string, ConfigFileMapping>;
  /** Mapping of external services to sync secrets to */
  services?: Record<string, ServiceConfig>;
}



/**
 * Values for core configuration (user-provided).
 */
export type ConfigValues = Record<string, string>;

/**
 * Resolved configuration (core + computed).
 */
export interface ResolvedConfig {
  core: Record<string, string>;
  computed: Record<string, string>;
  all: Record<string, string>;
}

// ============================================================================
// Schema Definition Helper
// ============================================================================

/**
 * Helper function to define a configuration schema with type safety.
 */
export function defineSchema(schema: ConfigSchema): ConfigSchema {
  return schema;
}

/**
 * Helper function to define configuration values with type safety.
 */
export function defineValues(values: ConfigValues): ConfigValues {
  return values;
}

// ============================================================================
// Validation
// ============================================================================

export interface ValidationError {
  key: string;
  message: string;
}

/**
 * Validates that all required configuration values are present and applies defaults.
 */
export function validateAndResolve(
  schema: ConfigSchema,
  values: ConfigValues
): { resolved: Record<string, string>; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const resolved: Record<string, string> = {};

  // Process each core secret definition
  for (const [key, definition] of Object.entries(schema.core)) {
    const value = values[key];

    if (value !== undefined && value !== "") {
      // User provided a value
      resolved[key] = value;
    } else if (definition.default !== undefined) {
      // Use default value
      resolved[key] = definition.default;
    } else if (definition.required) {
      // Missing required value
      errors.push({
        key,
        message: `Required configuration value "${key}" is missing`,
      });
    }
  }

  return { resolved, errors };
}

/**
 * Resolves all configuration (core + computed).
 */
export function resolveConfig(
  schema: ConfigSchema,
  values: ConfigValues
): { config: ResolvedConfig; errors: ValidationError[] } {
  const { resolved: core, errors } = validateAndResolve(schema, values);

  if (errors.length > 0) {
    return {
      config: { core: {}, computed: {}, all: {} },
      errors,
    };
  }

  // Compute derived values
  const computed = schema.computed(core);

  // Merge all secrets
  const all = { ...core, ...computed };

  return {
    config: { core, computed, all },
    errors: [],
  };
}

/**
 * Validates that all keys referenced in envfile configs exist.
 */
export function validateEnvFileKeys(
  schema: ConfigSchema,
  allKeys: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [envfileName, config] of Object.entries(schema.envfiles)) {
    // Validate direct keys
    for (const key of config.keys) {
      if (!allKeys.has(key)) {
        errors.push({
          key: `${envfileName}.${key}`,
          message: `Environment file "${envfileName}" references unknown key "${key}"`,
        });
      }
    }

    // Validate aliased keys (source keys must exist)
    if (config.aliases) {
      for (const [sourceKey, _targetKey] of Object.entries(config.aliases)) {
        if (!allKeys.has(sourceKey)) {
          errors.push({
            key: `${envfileName}.aliases.${sourceKey}`,
            message: `Environment file "${envfileName}" alias references unknown source key "${sourceKey}"`,
          });
        }
      }
    }
  }

  return errors;
}
