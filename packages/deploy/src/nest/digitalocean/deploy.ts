import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertExecutable,
  assertTool,
  confirmOrThrow,
  copyToTarget,
  log,
  remoteRun,
  runCommand,
  step,
  uploadImage,
  waitForSsh,
} from "./commands.js";
import {
  assertDigitalOceanAccess,
  listDroplets,
  reconcileFirewall,
  selectDeploymentTargets,
  type DeploymentTarget,
} from "./digitalocean.js";
import {
  renderExistingDeploymentProbe,
  renderRemoteDeployScript,
  renderTrustedHttpsProbe,
  shellQuote,
} from "./host-scripts.js";
import type { CliOptions } from "./options.js";
import {
  renderNestDeploymentEnv,
  type ProjectDeploymentConfig,
} from "./project-config.js";
import { applyCaddy, rollbackTarget, verifyRemoteHost } from "./remote-host.js";
import type { KingStackProject } from "../../project.js";

export interface DeploymentResult {
  backendHost?: string;
  targetIds: number[];
  deployed: boolean;
  hostReconfigured: boolean;
}

export async function deploy(
  options: CliOptions,
  project: ProjectDeploymentConfig,
  domain: string | undefined,
  tag: string,
  projectContext: KingStackProject,
): Promise<DeploymentResult> {
  assertTool("doctl", ["version"], projectContext.root);
  assertTool("ssh", ["-V"], projectContext.root);
  assertExecutable("scp", ["-V"], projectContext.root);
  if (!options.envOnly) {
    assertTool("bash", ["--version"], projectContext.root);
    assertTool("docker", ["info"], projectContext.root);
    assertTool("gzip", ["--version"], projectContext.root);
  }
  assertDigitalOceanAccess();

  const targets = selectDeploymentTargets(
    listDroplets(),
    tag,
    options.droplets,
  );
  if (targets.length === 0) {
    throw new Error(
      `No active droplets match tag ${tag}. Provision one with: yarn deploy:nest provision ${options.environment} --region <region>`,
    );
  }
  const backendHost = options.reconfigureHost
    ? resolveDeploymentHost(options.ipHttps, domain, targets)
    : undefined;

  log();
  log("KingStack NestJS deployment");
  log(`Environment: ${options.environment}`);
  log(`Targets:     ${targets.map((target) => target.name).join(", ")}`);
  log(`Mode:        ${describeDeploymentMode(options)}`);
  log(
    `Scope:       ${options.reconfigureHost ? "application + host networking" : "application only"}`,
  );
  log(
    options.reconfigureHost
      ? `Routing:     ${backendHost ? `Caddy HTTPS for ${backendHost}` : `public TCP ${project.port}`}`
      : "Preserving:  firewall, SSH policy, Caddy, port binding, and local config",
  );
  if (options.reconfigureHost && backendHost && isIP(backendHost) === 0) {
    log(
      `DNS:         ${backendHost} must resolve to ${targets.map(({ ip }) => ip).join(", ")}`,
    );
  }

  if (options.dryRun) {
    if (options.reconfigureHost) {
      reconcileFirewall({
        tag,
        targetIds: targets.map((target) => target.id),
        useTag: options.droplets.length === 0,
        port: project.port,
        domain: backendHost,
        sshSources: options.sshSources,
        dryRun: true,
      });
    }
    log();
    log(
      "Dry run complete; no Docker, database, cloud, or remote changes were made.",
    );
    return {
      backendHost,
      targetIds: targets.map(({ id }) => id),
      deployed: false,
      hostReconfigured: false,
    };
  }

  await confirmOrThrow(
    options.reconfigureHost
      ? `Deploy and reconfigure ${options.environment} on ${targets.length} droplet(s)?`
      : `Deploy ${options.environment} to ${targets.length} droplet(s) while preserving host networking?`,
    options.yes,
  );

  const migrationsSkipped = options.skipMigrations || options.withoutDatabase;
  const applicationSteps = options.envOnly ? 2 : migrationsSkipped ? 3 : 4;
  const totalSteps = applicationSteps + (options.reconfigureHost ? 1 : 0);
  let nextStep = 1;
  step(nextStep++, totalSteps, "Checking remote hosts...");
  for (const target of targets) {
    await waitForSsh(target);
    verifyRemoteHost(target);
    if (!options.reconfigureHost) {
      remoteRun(
        target,
        renderExistingDeploymentProbe(project.appSlug, project.port),
        {
          capture: true,
          label: "verify existing deployment routing",
        },
      );
    }
  }

  let image = "";
  const revision = createRevision(
    options.envOnly ? "env" : "image",
    projectContext.root,
  );
  if (!options.envOnly) {
    step(nextStep++, totalSteps, "Building the linux/amd64 Nest image...");
    image = `${project.appSlug}-nest:${revision}`;
    runCommand(
      "docker",
      [
        "build",
        "--platform",
        "linux/amd64",
        "-f",
        "apps/nest/Dockerfile",
        "-t",
        image,
        "--label",
        `com.kingstack.app=${project.appSlug}`,
        "--label",
        `com.kingstack.revision=${revision}`,
        ".",
      ],
      {
        cwd: projectContext.root,
        display: `docker build --platform linux/amd64 -t ${image} .`,
      },
    );

    if (!migrationsSkipped) {
      step(nextStep++, totalSteps, "Applying Prisma production migrations...");
      runCommand("yarn", ["prisma:deploy"], {
        display: `yarn workspace ${project.prismaWorkspace} prisma migrate deploy`,
        cwd: projectContext.root,
        env: { ...process.env, ...project.prismaEnv },
      });
    }
  }

  if (options.reconfigureHost) {
    step(nextStep++, totalSteps, "Reconciling the DigitalOcean firewall...");
    reconcileFirewall({
      tag,
      targetIds: targets.map((target) => target.id),
      useTag: options.droplets.length === 0,
      port: project.port,
      domain: backendHost,
      sshSources: options.sshSources,
      dryRun: false,
    });
  }

  step(nextStep, totalSteps, "Rolling out and verifying containers...");
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "kingstack-deploy-"));
  const envPath = join(temporaryDirectory, "nest.env");
  writeFileSync(
    envPath,
    renderNestDeploymentEnv(project.nestEnv, options.withoutDatabase),
    { mode: 0o600 },
  );
  const successful: Array<{ target: DeploymentTarget; caddyTouched: boolean }> =
    [];

  try {
    for (const target of targets) {
      log();
      log(`Deploying ${target.name} (${target.ip})...`);
      let targetImage = image;
      if (options.envOnly) {
        targetImage = remoteRun(
          target,
          `docker inspect --format '{{.Image}}' ${shellQuote(`${project.appSlug}-nest`)}`,
          { capture: true, label: "resolve current image" },
        );
        if (!targetImage) {
          throw new Error(`${target.name} has no current Nest container.`);
        }
      } else {
        uploadImage(target, image);
      }

      copyToTarget(envPath, target, `/tmp/${project.appSlug}.env.next`);
      let appSwapped = false;
      let caddyTouched = false;
      try {
        remoteRun(
          target,
          renderRemoteDeployScript({
            appSlug: project.appSlug,
            imageReference: targetImage,
            revision,
            port: project.port,
            domain: backendHost,
            preservePortBinding: !options.reconfigureHost,
          }),
          { label: "validate candidate and switch containers" },
        );
        appSwapped = true;
        if (options.reconfigureHost) {
          caddyTouched = applyCaddy(
            target,
            project.appSlug,
            backendHost,
            project.port,
          );
          if (backendHost && isIP(backendHost)) {
            remoteRun(target, renderTrustedHttpsProbe(backendHost), {
              label: `verify trusted HTTPS for ${backendHost}`,
            });
          }
        }
        successful.push({ target, caddyTouched });
        log(`Deployed ${target.name}.`);
      } catch (error) {
        try {
          remoteRun(
            target,
            `rm -f ${shellQuote(`/tmp/${project.appSlug}.env.next`)}`,
            { capture: true, quiet: true },
          );
        } catch {
          // The connection may be the failure; the staged file is replaced on retry.
        }
        if (appSwapped) {
          try {
            rollbackTarget(target, project.appSlug, caddyTouched);
          } catch (rollbackError) {
            console.error(`Rollback failed on ${target.name}:`, rollbackError);
          }
        }
        for (const completed of successful.reverse()) {
          try {
            rollbackTarget(
              completed.target,
              project.appSlug,
              completed.caddyTouched,
            );
          } catch (rollbackError) {
            console.error(
              `Rollback failed on ${completed.target.name}:`,
              rollbackError,
            );
          }
        }
        throw error;
      }
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }

  log();
  log(`Deployment complete: ${targets.length} droplet(s) updated.`);
  log(`Logs: ssh root@<ip> 'docker logs ${project.appSlug}-nest --tail 100'`);
  return {
    backendHost,
    targetIds: targets.map(({ id }) => id),
    deployed: true,
    hostReconfigured: options.reconfigureHost,
  };
}

export function resolveDeploymentHost(
  ipHttps: boolean,
  configuredHost: string | undefined,
  targets: readonly DeploymentTarget[],
): string | undefined {
  const usesPublicIp =
    ipHttps || Boolean(configuredHost && isIP(configuredHost));
  if (usesPublicIp && targets.length !== 1) {
    throw new Error(
      `Public-IP HTTPS requires exactly one Droplet; selected ${targets.length}. Use --domain with DNS or choose one exact Droplet.`,
    );
  }
  return ipHttps ? targets[0].ip : configuredHost;
}

function describeDeploymentMode(options: CliOptions): string {
  if (options.envOnly) {
    return options.withoutDatabase
      ? "environment only (database disabled)"
      : "environment only";
  }
  if (options.withoutDatabase) return "image (database disabled)";
  if (options.skipMigrations) return "image (migrations skipped)";
  return "image + migrations";
}

function createRevision(prefix: string, projectRoot: string): string {
  let commit = "nogit";
  try {
    commit = runCommand("git", ["rev-parse", "--short=12", "HEAD"], {
      capture: true,
      cwd: projectRoot,
      quiet: true,
    }).toLowerCase();
  } catch {
    // A generated project can deploy before its first commit.
  }
  return `${prefix}-${commit}-${Date.now().toString(36)}`;
}
