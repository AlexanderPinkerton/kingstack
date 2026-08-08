export interface GetVercelConfigCliOptions {
  environment?: string;
  host?: string;
  print: boolean;
  yes: boolean;
  help: boolean;
}

const VALUE_FLAGS = new Set(["--host"]);
const BOOLEAN_FLAGS = new Set(["--print", "--yes", "--help", "-h"]);

export function parseGetVercelConfigCliArgs(
  args: string[],
): GetVercelConfigCliOptions {
  const options: GetVercelConfigCliOptions = {
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
      options.host = normalizeHostname(value);
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

export function normalizeHostname(value: string): string {
  const trimmed = value.trim();
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch (error) {
    throw new Error(`Invalid hostname "${value}".`, { cause: error });
  }
  if (
    !url.hostname ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `Invalid hostname "${value}"; provide only a hostname such as app.example.com.`,
    );
  }
  return url.hostname.toLowerCase();
}

function assertEnvironmentName(environment?: string): void {
  if (environment && !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(environment)) {
    throw new Error(
      `Invalid environment name "${environment}"; use letters, numbers, underscores, or hyphens.`,
    );
  }
}

export function formatGetVercelConfigHelp(): string {
  return `
Import linked Vercel project metadata into KingStack configuration.

Usage:
  yarn vercel:config:pull [environment] [options]
  yarn vercel:config:pull --print [options]

Options:
  --host <hostname>  Select a production domain without prompting
  --print            Print a TypeScript values block instead of writing
  --yes              Skip the final destination confirmation
  -h, --help         Show this help

Examples:
  yarn vercel:config:pull production
  yarn vercel:config:pull production --host app.example.com --yes
  yarn vercel:config:pull --print

The command reads .vercel/project.json and the linked project's verified
production domains. It imports NEXT_HOST, VERCEL_ORG_ID, and VERCEL_PROJECT_ID.
Vercel access tokens cannot be retrieved after creation and remain unchanged.
`;
}
