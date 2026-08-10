import { runSupabaseAuthCli } from "./configure-auth.js";
import { runSupabasePullCli } from "./get-secrets.js";
import { runSupabaseProvisionCli } from "./provision-cli.js";
import type { KingStackProject } from "../project.js";

export async function runSupabaseCli(
  args: string[],
  project: KingStackProject,
): Promise<void> {
  const [command, ...commandArgs] = args;
  if (!command || command === "--help" || command === "-h") {
    console.log(formatSupabaseHelp());
    return;
  }

  switch (command) {
    case "provision":
      await runSupabaseProvisionCli(commandArgs, project);
      return;
    case "pull":
      await runSupabasePullCli(commandArgs, project);
      return;
    case "auth":
      await runSupabaseAuthCli(commandArgs, project);
      return;
    default:
      throw new Error(
        `Unknown Supabase command: ${command}. Use provision, pull, or auth.`,
      );
  }
}

export function formatSupabaseHelp(): string {
  return `
Manage KingStack's hosted Supabase deployment.

Usage:
  king-deploy supabase <command> [options]

Commands:
  provision   Provision a hosted Supabase project
  pull        Import hosted project credentials into KingStack config
  auth        Configure and verify hosted Supabase Auth settings

Run king-deploy supabase <command> --help for command-specific options.
`;
}
