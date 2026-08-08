#!/usr/bin/env bun

import { log } from "./nest-digitalocean/commands.js";
import { deploy } from "./nest-digitalocean/deploy.js";
import {
  formatHelp,
  getDefaultTag,
  parseCliArgs,
  resolveDomain,
  sanitizeSlug,
  validateRequiredOptions,
} from "./nest-digitalocean/options.js";
import {
  loadProjectConfig,
  writeBackendHostConfig,
} from "./nest-digitalocean/project-config.js";
import { provision } from "./nest-digitalocean/provision.js";
import { runNestWizard } from "./nest-digitalocean/wizard.js";

async function main(): Promise<void> {
  let options = parseCliArgs(process.argv.slice(2));
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
    const result = await runNestWizard(options);
    options = result.options;
    project = result.project;
  }
  validateRequiredOptions(options);
  const environment = options.environment;
  if (!environment || !options.command) return;

  project ||= await loadProjectConfig(environment);
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
        },
        project,
        domain,
        tag,
      );
      updateBackendConfig(options, result.backendHost);
    }
  } else {
    const result = await deploy(options, project, domain, tag);
    updateBackendConfig(options, result.backendHost);
  }
}

function updateBackendConfig(
  options: ReturnType<typeof parseCliArgs>,
  backendHost: string | undefined,
): void {
  if (!options.updateConfig || options.dryRun || !backendHost) return;
  const environment = options.environment;
  if (!environment) return;

  const relativePath = writeBackendHostConfig(environment, backendHost);
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

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error();
  console.error(`Deployment stopped: ${message}`);
  process.exitCode = 1;
});
