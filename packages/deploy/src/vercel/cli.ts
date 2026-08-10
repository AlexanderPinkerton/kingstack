import { runVercelPullCli } from "./get-config.js";
import type { KingStackProject } from "../project.js";

export async function runVercelCli(
  args: string[],
  project: KingStackProject,
): Promise<void> {
  const [command, ...commandArgs] = args;
  if (!command || command === "--help" || command === "-h") {
    console.log(formatVercelHelp());
    return;
  }
  if (command !== "pull") {
    throw new Error(`Unknown Vercel command: ${command}. Use pull.`);
  }
  await runVercelPullCli(commandArgs, project);
}

export function formatVercelHelp(): string {
  return `
Manage KingStack's Vercel deployment configuration.

Usage:
  king-deploy vercel pull [environment] [options]

Commands:
  pull   Import linked-project IDs and a verified production hostname

Run king-deploy vercel pull --help for command-specific options.
`;
}
