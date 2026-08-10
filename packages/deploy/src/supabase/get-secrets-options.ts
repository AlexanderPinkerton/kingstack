export interface GetSecretsCliOptions {
  environment?: string;
  projectRef?: string;
  poolerRegion?: string;
  apiKeyName?: string;
  print: boolean;
  yes: boolean;
  help: boolean;
}

const VALUE_FLAGS = new Set([
  "--project-ref",
  "--pooler-region",
  "--api-key-name",
]);
const BOOLEAN_FLAGS = new Set(["--print", "--yes", "--help", "-h"]);

export function parseGetSecretsCliArgs(args: string[]): GetSecretsCliOptions {
  const options: GetSecretsCliOptions = {
    print: false,
    yes: false,
    help: false,
  };
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (VALUE_FLAGS.has(arg)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value after ${arg}.`);
      }
      index += 1;

      switch (arg) {
        case "--project-ref":
          options.projectRef = value;
          break;
        case "--pooler-region":
          options.poolerRegion = normalizePoolerRegion(value);
          break;
        case "--api-key-name":
          options.apiKeyName = value;
          break;
      }
      continue;
    }

    if (BOOLEAN_FLAGS.has(arg)) {
      switch (arg) {
        case "--print":
          options.print = true;
          break;
        case "--yes":
          options.yes = true;
          break;
        case "--help":
        case "-h":
          options.help = true;
          break;
      }
      continue;
    }

    if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    positionals.push(arg);
  }

  if (positionals.length > 1) {
    throw new Error(`Unexpected argument: ${positionals[1]}`);
  }
  if (positionals[0]) options.environment = positionals[0];
  if (options.environment && options.print) {
    throw new Error(
      "Choose a config environment or --print; they are separate destinations.",
    );
  }
  assertEnvironmentName(options.environment);
  return options;
}

export function normalizePoolerRegion(value: string): string {
  const normalized = value.trim().replace(/\.pooler\.supabase\.com$/i, "");
  if (!/^aws-\d+-[a-z0-9-]+$/.test(normalized)) {
    throw new Error(
      `Invalid pooler region "${value}". Expected a value such as aws-0-us-east-1 or its full pooler hostname.`,
    );
  }
  return normalized;
}

function assertEnvironmentName(environment?: string): void {
  if (environment && !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(environment)) {
    throw new Error(
      `Invalid environment name "${environment}"; use letters, numbers, underscores, or hyphens.`,
    );
  }
}

export function formatGetSecretsHelp(): string {
  return `
Import hosted Supabase credentials into KingStack configuration.

Usage:
  yarn supabase:provision:get-secrets [environment] [options]
  yarn supabase:provision:get-secrets --print [options]

Options:
  --project-ref <ref>       Supabase project reference; omit to choose
  --pooler-region <region>  Pooler shard from Connect (default: aws-0-<region>)
  --api-key-name <name>     Modern API key pair name (default: default)
  --print                   Print a TypeScript values block instead of writing
  --yes                     Skip the final destination confirmation
  -h, --help                Show this help

Examples:
  yarn supabase:provision:get-secrets development
  yarn supabase:provision:get-secrets production --project-ref abcdefghijklmnopqrst
  yarn supabase:provision:get-secrets --print --project-ref abcdefghijklmnopqrst

The database password is never accepted as a command argument. Enter it at the
masked prompt, or provide SUPABASE_DB_PASSWORD in the process environment for
non-interactive use. --print deliberately writes secrets to the terminal.
`;
}
