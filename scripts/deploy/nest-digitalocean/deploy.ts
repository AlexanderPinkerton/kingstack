import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
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
import { renderRemoteDeployScript, shellQuote } from "./host-scripts.js";
import type { CliOptions } from "./options.js";
import {
  renderNestDeploymentEnv,
  type ProjectDeploymentConfig,
} from "./project-config.js";
import { applyCaddy, rollbackTarget, verifyRemoteHost } from "./remote-host.js";

export async function deploy(
  options: CliOptions,
  project: ProjectDeploymentConfig,
  domain: string | undefined,
  tag: string,
): Promise<void> {
  assertTool("doctl", ["version"]);
  assertTool("ssh", ["-V"]);
  assertTool("which", ["scp"]);
  if (!options.envOnly) {
    assertTool("docker", ["info"]);
    assertTool("gzip", ["--version"]);
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

  log();
  log("KingStack NestJS deployment");
  log(`Environment: ${options.environment}`);
  log(`Targets:     ${targets.map((target) => target.name).join(", ")}`);
  log(
    `Routing:     ${domain ? `Caddy HTTPS for ${domain}` : `public TCP ${project.port}`}`,
  );
  log(`Mode:        ${describeDeploymentMode(options)}`);

  if (options.dryRun) {
    reconcileFirewall({
      tag,
      targetIds: targets.map((target) => target.id),
      useTag: options.droplets.length === 0,
      port: project.port,
      domain,
      sshSources: options.sshSources,
      dryRun: true,
    });
    log();
    log(
      "Dry run complete; no Docker, database, cloud, or remote changes were made.",
    );
    return;
  }

  await confirmOrThrow(
    `Deploy ${options.environment} to ${targets.length} droplet(s)?`,
    options.yes,
  );

  const migrationsSkipped = options.skipMigrations || options.withoutDatabase;
  const totalSteps = options.envOnly ? 3 : migrationsSkipped ? 4 : 5;
  let nextStep = 1;
  step(nextStep++, totalSteps, "Checking remote hosts...");
  for (const target of targets) {
    await waitForSsh(target);
    verifyRemoteHost(target);
  }

  let image = "";
  const revision = createRevision(options.envOnly ? "env" : "image");
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
      { display: `docker build --platform linux/amd64 -t ${image} .` },
    );

    if (!migrationsSkipped) {
      step(nextStep++, totalSteps, "Applying Prisma production migrations...");
      runCommand("yarn", ["prisma:deploy"], {
        display: `yarn workspace ${project.prismaWorkspace} prisma migrate deploy`,
        env: { ...process.env, ...project.prismaEnv },
      });
    }
  }

  step(nextStep++, totalSteps, "Reconciling the DigitalOcean firewall...");
  reconcileFirewall({
    tag,
    targetIds: targets.map((target) => target.id),
    useTag: options.droplets.length === 0,
    port: project.port,
    domain,
    sshSources: options.sshSources,
    dryRun: false,
  });

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
            domain,
          }),
          { label: "validate candidate and switch containers" },
        );
        appSwapped = true;
        caddyTouched = applyCaddy(
          target,
          project.appSlug,
          domain,
          project.port,
        );
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

function createRevision(prefix: string): string {
  let commit = "nogit";
  try {
    commit = runCommand("git", ["rev-parse", "--short=12", "HEAD"], {
      capture: true,
      quiet: true,
    }).toLowerCase();
  } catch {
    // A generated project can deploy before its first commit.
  }
  return `${prefix}-${commit}-${Date.now().toString(36)}`;
}
