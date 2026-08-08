import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertTool,
  confirmOrThrow,
  log,
  remoteRun,
  runCommand,
  step,
  waitForSsh,
} from "./commands.js";
import {
  assertDigitalOceanAccess,
  getPublicIp,
  getSshKey,
  listDroplets,
  reconcileFirewall,
  type DeploymentTarget,
} from "./digitalocean.js";
import { renderCloudInit } from "./host-scripts.js";
import { sanitizeSlug, type CliOptions } from "./options.js";
import type { ProjectDeploymentConfig } from "./project-config.js";
import { bootstrapHost, ensureCaddy, verifyRemoteHost } from "./remote-host.js";

export async function provision(
  options: CliOptions,
  project: ProjectDeploymentConfig,
  domain: string | undefined,
  tag: string,
): Promise<DeploymentTarget | undefined> {
  assertTool("doctl", ["version"]);
  assertTool("ssh", ["-V"]);
  assertDigitalOceanAccess();

  const sshKey = getSshKey(options.sshKey);
  const name = sanitizeSlug(options.name || tag, 63);
  let droplets = listDroplets();
  let droplet = droplets.find((candidate) => candidate.name === name);

  log();
  log("KingStack DigitalOcean provisioning");
  log(`Environment: ${options.environment}`);
  log(`Droplet:     ${name}${droplet ? " (reuse existing)" : " (create)"}`);
  log(`Region:      ${options.region}`);
  log(`Size:        ${options.size}`);
  log("Image:       ubuntu-24-04-x64");
  log(`Tag:         ${tag}`);
  log(
    `Routing:     ${options.ipHttps ? "Caddy HTTPS for the Droplet public IP" : domain ? `Caddy HTTPS for ${domain}` : `public TCP ${project.port}`}`,
  );
  log(`Backups:     ${options.backups ? "enabled" : "disabled"}`);
  log(`Deploy:      ${options.deployAfterProvision ? "after setup" : "no"}`);

  if (options.dryRun) {
    log();
    log("Dry run complete; no resources were changed.");
    return undefined;
  }

  await confirmOrThrow(
    droplet
      ? `Reuse and configure ${name}?`
      : `Create billable DigitalOcean droplet ${name}?`,
    options.yes,
  );

  const needsTag = Boolean(droplet && !(droplet.tags || []).includes(tag));
  const totalSteps = droplet ? (needsTag ? 4 : 3) : 4;
  let nextStep = 1;
  if (!droplet) {
    step(nextStep++, totalSteps, "Creating the droplet...");
    const temporaryDirectory = mkdtempSync(
      join(tmpdir(), "kingstack-cloud-init-"),
    );
    const cloudInitPath = join(temporaryDirectory, "cloud-init.yml");
    try {
      writeFileSync(cloudInitPath, renderCloudInit(project.appSlug), {
        mode: 0o600,
      });
      const createArgs = [
        "compute",
        "droplet",
        "create",
        name,
        "--image",
        "ubuntu-24-04-x64",
        "--size",
        options.size,
        "--region",
        options.region || "",
        "--ssh-keys",
        sshKey,
        "--tag-name",
        tag,
        "--user-data-file",
        cloudInitPath,
        "--enable-monitoring",
        "--enable-private-networking",
        "--wait",
      ];
      if (options.backups) createArgs.push("--enable-backups");
      runCommand("doctl", createArgs, {
        display: `doctl compute droplet create ${name} <provisioning options>`,
      });
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }

    droplets = listDroplets();
    droplet = droplets.find((candidate) => candidate.name === name);
    if (!droplet) throw new Error(`Created droplet ${name} was not found.`);
  } else if (needsTag) {
    step(nextStep++, totalSteps, "Applying the deployment tag...");
    runCommand(
      "doctl",
      ["compute", "droplet", "tag", String(droplet.id), "--tag-name", tag],
      { display: `doctl compute droplet tag ${droplet.id} --tag-name ${tag}` },
    );
  }

  const ip = getPublicIp(droplet);
  if (!ip) throw new Error(`Droplet ${name} has no public IPv4 address.`);
  if (droplet.status !== "active") {
    throw new Error(`Droplet ${name} is ${droplet.status}, not active.`);
  }
  const target: DeploymentTarget = { id: droplet.id, name, ip };
  const backendHost = options.ipHttps ? target.ip : domain;

  step(nextStep++, totalSteps, "Configuring the DigitalOcean firewall...");
  reconcileFirewall({
    tag,
    targetIds: [target.id],
    useTag: true,
    port: project.port,
    domain: backendHost,
    sshSources: options.sshSources,
    dryRun: false,
  });

  step(nextStep++, totalSteps, "Waiting for SSH and host bootstrap...");
  await waitForSsh(target);
  try {
    remoteRun(target, "cloud-init status --wait", {
      label: "wait for cloud-init",
    });
  } catch {
    log("cloud-init did not report success; checking the installed tools...");
  }

  step(nextStep, totalSteps, "Ensuring Docker and Caddy are installed...");
  let dockerInstalled = true;
  try {
    remoteRun(target, "command -v docker >/dev/null", {
      capture: true,
      quiet: true,
    });
  } catch {
    dockerInstalled = false;
  }

  if (dockerInstalled) {
    remoteRun(
      target,
      "systemctl enable --now docker >/dev/null && docker info >/dev/null",
      { capture: true, label: "start Docker" },
    );
    ensureCaddy(target);
  } else {
    const os = remoteRun(target, '. /etc/os-release && printf %s "$ID"', {
      capture: true,
      label: "check operating system",
    });
    if (os !== "ubuntu") {
      throw new Error(
        `${target.name} needs Docker but is ${os || "an unsupported OS"}; Ubuntu is required for automatic setup.`,
      );
    }
    bootstrapHost(target, project.appSlug);
  }
  verifyRemoteHost(target);

  log();
  log(`Provisioned ${name}: ${ip}`);
  if (!options.deployAfterProvision) {
    log(
      `Next: yarn deploy:nest deploy ${options.environment}${options.ipHttps ? " --ip-https" : options.domain ? ` --domain ${domain}` : options.noDomain ? " --no-domain" : ""}`,
    );
  }
  return target;
}
