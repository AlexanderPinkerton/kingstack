import { formatHelp, parseCliArgs } from "./options.js";
import { provisionSupabase } from "./provision.js";
import type { KingStackProject } from "../project.js";

export async function runSupabaseProvisionCli(
  args: string[],
  project: KingStackProject,
): Promise<void> {
  const options = parseCliArgs(args);
  if (options.help) {
    console.log(formatHelp());
    return;
  }
  await provisionSupabase(options, project);
}
