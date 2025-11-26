/**
 * Utility types and functions for the secrets configuration system.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Definition of a single secret value in the schema.
 */
export interface SecretDefinition {
  /** Whether this secret is required (no default) */
  required?: boolean;
  /** Default value if not provided */
  default?: string;
  /** Description of what this secret is for */
  description?: string;
}

/**
 * Schema definition for all secrets.
 */
export interface SecretsSchema {
  /** Core secret definitions (the inputs) */
  core: Record<string, SecretDefinition>;
  /** Computed values derived from core secrets */
  computed: (core: Record<string, string>) => Record<string, string>;
  /** Mapping of projects to their env files and required keys */
  projects: Record<string, ProjectConfig>;
}

/**
 * Configuration for a single project's environment file.
 */
export interface ProjectConfig {
  /** Path to the .env file (relative to repo root) */
  path: string;
  /** List of keys (from core or computed) to include in this file */
  keys: string[];
}

/**
 * Values for core secrets (user-provided).
 */
export type SecretValues = Record<string, string>;

/**
 * Resolved secrets (core + computed).
 */
export interface ResolvedSecrets {
  core: Record<string, string>;
  computed: Record<string, string>;
  all: Record<string, string>;
}

// ============================================================================
// Schema Definition Helper
// ============================================================================

/**
 * Helper function to define a secrets schema with type safety.
 */
export function defineSchema(schema: SecretsSchema): SecretsSchema {
  return schema;
}

/**
 * Helper function to define secret values with type safety.
 */
export function defineValues(values: SecretValues): SecretValues {
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
 * Validates that all required secrets are present and applies defaults.
 */
export function validateAndResolve(
  schema: SecretsSchema,
  values: SecretValues
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
        message: `Required secret "${key}" is missing`,
      });
    }
  }

  return { resolved, errors };
}

/**
 * Resolves all secrets (core + computed).
 */
export function resolveSecrets(
  schema: SecretsSchema,
  values: SecretValues
): { secrets: ResolvedSecrets; errors: ValidationError[] } {
  const { resolved: core, errors } = validateAndResolve(schema, values);

  if (errors.length > 0) {
    return {
      secrets: { core: {}, computed: {}, all: {} },
      errors,
    };
  }

  // Compute derived values
  const computed = schema.computed(core);

  // Merge all secrets
  const all = { ...core, ...computed };

  return {
    secrets: { core, computed, all },
    errors: [],
  };
}

/**
 * Validates that all keys referenced in project configs exist.
 */
export function validateProjectKeys(
  schema: SecretsSchema,
  allKeys: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [projectName, config] of Object.entries(schema.projects)) {
    for (const key of config.keys) {
      if (!allKeys.has(key)) {
        errors.push({
          key: `${projectName}.${key}`,
          message: `Project "${projectName}" references unknown key "${key}"`,
        });
      }
    }
  }

  return errors;
}
