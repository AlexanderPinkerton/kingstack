import { runNestCli } from "./nest/cli.js";
import { resolveKingStackProject } from "./project.js";
import { runSupabaseCli } from "./supabase/cli.js";
import { runVercelCli } from "./vercel/cli.js";

export interface DeployCliContext {
  version: string;
  currentWorkingDirectory?: () => string;
}

export async function runDeployCli(
  args: string[],
  context: DeployCliContext,
): Promise<void> {
  const parsed = parseGlobalOptions(args);
  const project = resolveKingStackProject(
    parsed.cwd,
    (context.currentWorkingDirectory || process.cwd)(),
  );

  const [provider, ...providerArgs] = parsed.args;
  if (!provider || provider === "--help" || provider === "-h") {
    console.log(formatDeployHelp(context.version));
    return;
  }
  if (provider === "--version" || provider === "-v") {
    console.log(context.version);
    return;
  }

  switch (provider) {
    case "nest":
      await runNestCli(providerArgs, project);
      return;
    case "supabase":
      await runSupabaseCli(providerArgs, project);
      return;
    case "vercel":
      await runVercelCli(providerArgs, project);
      return;
    default:
      throw new Error(
        `Unknown deployment provider: ${provider}. Use nest, supabase, or vercel.`,
      );
  }
}

export function formatDeployHelp(version: string): string {
  return `
KingStack deployment CLI ${version}

Usage:
  king-deploy [--cwd <path>] <provider> [command] [options]

Providers:
  nest       Provision or deploy NestJS on DigitalOcean
  supabase   Provision, import, or configure hosted Supabase
  vercel     Import linked Vercel deployment configuration

Global options:
  --cwd <path>   Run against a KingStack project at this path
  --version, -v  Show the installed deployment package version
  --help, -h     Show this help

Existing KingStack Yarn command aliases remain supported.
`;
}

function parseGlobalOptions(args: string[]): {
  args: string[];
  cwd?: string;
} {
  const remaining: string[] = [];
  let cwd: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg !== "--cwd") {
      remaining.push(arg);
      continue;
    }
    if (cwd) throw new Error("Specify --cwd only once.");
    const value = args[index + 1];
    if (!value || value.startsWith("-")) {
      throw new Error("Missing path after --cwd.");
    }
    cwd = value;
    index += 1;
  }
  return { args: remaining, cwd };
}
