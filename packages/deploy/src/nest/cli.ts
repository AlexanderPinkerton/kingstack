import { log } from "./digitalocean/commands.js";
import type { KingStackProject } from "../project.js";
import { deploy } from "./digitalocean/deploy.js";
import {
  formatHelp,
  getDefaultTag,
  parseCliArgs,
  resolveDomain,
  sanitizeSlug,
  validateRequiredOptions,
} from "./digitalocean/options.js";
import {
  loadProjectConfig,
  writeBackendHostConfig,
} from "./digitalocean/project-config.js";
import { provision } from "./digitalocean/provision.js";
import { runNestWizard } from "./digitalocean/wizard.js";

export async function runNestCli(
  args: string[],
  projectContext: KingStackProject,
): Promise<void> {
  let options = parseCliArgs(args);
  if (options.help) {
    log(formatHelp());
    return;
  }
  let project;
  const needsWizard =
    !options.command ||
    !options.environment ||
    (options.command === "provision" && !options.region);
  if (needsWizard && process.stdin.isTTY && process.stdout.isTTY) {
    const result = await runNestWizard(options, projectContext);
    options = result.options;
    project = result.project;
  }
  validateRequiredOptions(options);
  const environment = options.environment;
  if (!environment || !options.command) return;

  project ||= await loadProjectConfig(environment, projectContext);
  const tag = sanitizeSlug(
    options.tag || getDefaultTag(project.appSlug, environment),
    63,
  );
  const domain = resolveDomain(
    project.backendUrl,
    options.domain,
    options.noDomain,
  );
  if (options.updateConfig && !domain && !options.ipHttps) {
    throw new Error(
      "--update-config requires --ip-https, --domain, or an HTTPS host from the environment configuration.",
    );
  }

  if (options.command === "provision") {
    const target = await provision(options, project, domain, tag);
    if (options.deployAfterProvision && target) {
      const result = await deploy(
        {
          ...options,
          command: "deploy",
          droplets: [String(target.id)],
          tag: undefined,
          yes: true,
          deployAfterProvision: false,
          reconfigureHost: true,
        },
        project,
        domain,
        tag,
        projectContext,
      );
      updateBackendConfig(options, result.backendHost, projectContext);
    }
  } else {
    const result = await deploy(options, project, domain, tag, projectContext);
    updateBackendConfig(options, result.backendHost, projectContext);
  }
}

function updateBackendConfig(
  options: ReturnType<typeof parseCliArgs>,
  backendHost: string | undefined,
  projectContext: KingStackProject,
): void {
  if (!options.updateConfig || options.dryRun || !backendHost) return;
  const environment = options.environment;
  if (!environment) return;

  const relativePath = writeBackendHostConfig(
    environment,
    backendHost,
    projectContext,
  );
  log();
  log(`Updated ${relativePath}: NEST_HOST=${backendHost}`);
  log("Existing Supabase, Vercel, and application values were preserved.");
  log();
  log("Vercel handoff:");
  log(
    `1. Sync the computed backend URL: yarn king-config sync --env ${environment} --target vercel`,
  );
  log("2. Redeploy the frontend: yarn vercel:prod");
}
