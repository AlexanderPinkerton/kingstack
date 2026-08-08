export interface AuthConfigCliOptions {
  environment?: string;
  projectRef?: string;
  siteUrl?: string;
  requireEmailConfirmation: boolean;
  dryRun: boolean;
  yes: boolean;
  help: boolean;
}

const VALUE_FLAGS = new Set(["--project-ref", "--site-url"]);
const BOOLEAN_FLAGS = new Set([
  "--require-email-confirmation",
  "--dry-run",
  "--yes",
  "--help",
  "-h",
]);

export function parseAuthConfigCliArgs(args: string[]): AuthConfigCliOptions {
  const options: AuthConfigCliOptions = {
    requireEmailConfirmation: false,
    dryRun: false,
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
      if (arg === "--project-ref") options.projectRef = value;
      if (arg === "--site-url") options.siteUrl = value;
      continue;
    }

    if (BOOLEAN_FLAGS.has(arg)) {
      if (arg === "--require-email-confirmation") {
        options.requireEmailConfirmation = true;
      }
      if (arg === "--dry-run") options.dryRun = true;
      if (arg === "--yes") options.yes = true;
      if (arg === "--help" || arg === "-h") options.help = true;
      continue;
    }

    if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    positionals.push(arg);
  }

  if (positionals.length > 1) {
    throw new Error(`Unexpected argument: ${positionals[1]}`);
  }
  if (positionals[0]) options.environment = positionals[0];
  assertEnvironmentName(options.environment);
  return options;
}

function assertEnvironmentName(environment?: string): void {
  if (environment && !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(environment)) {
    throw new Error(
      `Invalid environment name "${environment}"; use letters, numbers, underscores, or hyphens.`,
    );
  }
}

export function formatAuthConfigHelp(): string {
  return `
Configure a hosted Supabase project's application URL and email signup flow.

Usage:
  yarn supabase:auth:configure [environment] [options]

Options:
  --project-ref <ref>             Override SUPABASE_PROJECT_REF
  --site-url <url>                Override the computed NEXT_URL
  --require-email-confirmation    Require signup email verification
                                  (default: immediately confirm new users)
  --dry-run                       Print the intended settings only
  --yes                           Skip the final confirmation
  -h, --help                      Show this help

Examples:
  yarn supabase:auth:configure production
  yarn supabase:auth:configure production --dry-run
  yarn supabase:auth:configure production --require-email-confirmation
  yarn supabase:auth:configure --project-ref abcdefghijklmnopqrst --site-url https://example.vercel.app --yes

The command updates only Supabase Auth's Site URL and email-confirmation mode.
It uses SUPABASE_ACCESS_TOKEN when set, otherwise the credentials saved by
\`yarn exec supabase login\`. The access token is never printed.
`;
}
