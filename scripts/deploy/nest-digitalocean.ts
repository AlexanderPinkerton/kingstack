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
import { loadProjectConfig } from "./nest-digitalocean/project-config.js";
import { provision } from "./nest-digitalocean/provision.js";

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    log(formatHelp());
    return;
  }
  validateRequiredOptions(options);
  const environment = options.environment;
  if (!environment || !options.command) return;

  const project = await loadProjectConfig(environment);
  const tag = sanitizeSlug(
    options.tag || getDefaultTag(project.appSlug, environment),
    63,
  );
  const domain = resolveDomain(
    project.backendUrl,
    options.domain,
    options.noDomain,
  );

  if (options.command === "provision") {
    const target = await provision(options, project, domain, tag);
    if (options.deployAfterProvision && target) {
      await deploy(
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
    }
  } else {
    await deploy(options, project, domain, tag);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error();
  console.error(`Deployment stopped: ${message}`);
  process.exitCode = 1;
});
