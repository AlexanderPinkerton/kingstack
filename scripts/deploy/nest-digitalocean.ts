#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";
import {
  resolveConfig,
  validateEnvFileKeys,
  type ConfigSchema,
  type ConfigValues,
} from "@kingstack/config";
import {
  buildFirewallRules,
  formatHelp,
  getDefaultTag,
  getPublicIp,
  parseCliArgs,
  parsePort,
  renderBootstrapScript,
  renderCaddyApplyScript,
  renderCaddyFragment,
  renderCaddyInstallScript,
  renderCaddyRollbackScript,
  renderCloudInit,
  renderEnvFile,
  renderRemoteDeployScript,
  renderRemoteRollbackScript,
  resolveDomain,
  sanitizeSlug,
  selectDeploymentTargets,
  shellQuote,
  validateRequiredOptions,
  type CliOptions,
  type DeploymentTarget,
  type DigitalOceanDroplet,
} from "./nest-digitalocean-core.js";

interface RunOptions {
  capture?: boolean;
  display?: string;
  env?: NodeJS.ProcessEnv;
  quiet?: boolean;
}

interface ProjectDeploymentConfig {
  appSlug: string;
  prismaWorkspace: string;
  nestEnv: string;
  prismaEnv: NodeJS.ProcessEnv;
  port: number;
  backendUrl?: string;
}

interface DigitalOceanSshKey {
  id: number;
  name: string;
  fingerprint: string;
}

interface DigitalOceanFirewall {
  id: string;
  name: string;
  droplet_ids?: number[];
  tags?: string[];
}

const SSH_OPTIONS = [
  "-o",
  "StrictHostKeyChecking=accept-new",
  "-o",
  "ConnectTimeout=10",
  "-o",
  "ServerAliveInterval=15",
  "-o",
  "ServerAliveCountMax=8",
];

function log(message = ""): void {
  console.log(message);
}

function step(number: number, total: number, message: string): void {
  log();
  log(`[${number}/${total}] ${message}`);
}

function runCommand(
  command: string,
  args: string[],
  options: RunOptions = {},
): string {
  if (!options.quiet) {
    log(`> ${options.display || [command, ...args].join(" ")}`);
  }
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: options.env || process.env,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    const details = options.capture
      ? [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
      : "";
    throw new Error(
      `${options.display || `${command} ${args.join(" ")}`} exited with status ${result.status ?? "unknown"}.${details ? `\n${details}` : ""}`,
    );
  }

  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

function parseJson<T>(value: string, description: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Could not parse ${description} JSON.`, { cause: error });
  }
}

function readJsonFile<T>(path: string): T {
  return parseJson<T>(readFileSync(path, "utf8"), path);
}

async function loadProjectConfig(
  environment: string,
): Promise<ProjectDeploymentConfig> {
  const requiredPaths = [
    "package.json",
    "apps/nest/Dockerfile",
    "config/schema.ts",
    `config/${environment}.ts`,
    "packages/prisma/package.json",
  ];
  const missing = requiredPaths.filter((path) => !existsSync(resolve(path)));
  if (missing.length > 0) {
    throw new Error(
      `Run from a KingStack project root. Missing: ${missing.join(", ")}`,
    );
  }

  const rootPackage = readJsonFile<{ name?: string }>(resolve("package.json"));
  const prismaPackage = readJsonFile<{ name?: string }>(
    resolve("packages/prisma/package.json"),
  );
  if (!rootPackage.name) throw new Error("package.json is missing its name.");
  if (!prismaPackage.name) {
    throw new Error("packages/prisma/package.json is missing its name.");
  }

  const schemaModule = (await import(
    pathToFileURL(resolve("config/schema.ts")).href
  )) as { schema?: ConfigSchema };
  const valuesModule = (await import(
    pathToFileURL(resolve(`config/${environment}.ts`)).href
  )) as { values?: ConfigValues };
  if (!schemaModule.schema)
    throw new Error("config/schema.ts exports no schema.");
  if (!valuesModule.values) {
    throw new Error(`config/${environment}.ts exports no values.`);
  }

  const result = resolveConfig(schemaModule.schema, valuesModule.values);
  if (result.errors.length > 0) {
    throw new Error(
      `Configuration is invalid:\n${result.errors.map((error) => `- ${error.key}: ${error.message}`).join("\n")}`,
    );
  }
  const keyErrors = validateEnvFileKeys(
    schemaModule.schema,
    new Set(Object.keys(result.config.all)),
  );
  if (keyErrors.length > 0) {
    throw new Error(
      `Environment mappings are invalid:\n${keyErrors.map((error) => `- ${error.key}: ${error.message}`).join("\n")}`,
    );
  }

  const nestDefinition = schemaModule.schema.envfiles.nest;
  const prismaDefinition = schemaModule.schema.envfiles.prisma;
  if (!nestDefinition || !prismaDefinition) {
    throw new Error(
      "The KingStack schema must define nest and prisma envfiles.",
    );
  }

  const prismaEnv: NodeJS.ProcessEnv = {};
  for (const key of prismaDefinition.keys) {
    const value = result.config.all[key];
    if (value !== undefined) prismaEnv[key] = String(value);
  }

  return {
    appSlug: sanitizeSlug(rootPackage.name),
    prismaWorkspace: prismaPackage.name,
    nestEnv: renderEnvFile(result.config.all, nestDefinition),
    prismaEnv,
    port: parsePort(result.config.all.NEST_PORT),
    backendUrl:
      typeof result.config.all.NEXT_PUBLIC_NEST_BACKEND_URL === "string"
        ? result.config.all.NEXT_PUBLIC_NEST_BACKEND_URL
        : undefined,
  };
}

function assertTool(command: string, args: string[]): void {
  try {
    runCommand(command, args, { capture: true, quiet: true });
  } catch {
    throw new Error(`Required tool is unavailable: ${command}`);
  }
}

function assertDigitalOceanAccess(): void {
  try {
    runCommand("doctl", ["account", "get", "--output", "json"], {
      capture: true,
      quiet: true,
    });
  } catch {
    throw new Error(
      "DigitalOcean authentication failed. Run `doctl auth init` and retry.",
    );
  }
}

function listDroplets(): DigitalOceanDroplet[] {
  return parseJson<DigitalOceanDroplet[]>(
    runCommand("doctl", ["compute", "droplet", "list", "--output", "json"], {
      capture: true,
      display: "doctl compute droplet list --output json",
    }),
    "DigitalOcean droplets",
  );
}

function sshArgs(ip: string, remoteCommand: string): string[] {
  return [...SSH_OPTIONS, `root@${ip}`, remoteCommand];
}

function remoteRun(
  target: DeploymentTarget,
  script: string,
  options: { capture?: boolean; quiet?: boolean; label?: string } = {},
): string {
  return runCommand(
    "ssh",
    sshArgs(target.ip, `bash -o pipefail -lc ${shellQuote(script)}`),
    {
      capture: options.capture,
      quiet: options.quiet,
      display: `ssh root@${target.ip} <${options.label || "remote command"}>`,
    },
  );
}

function copyToTarget(
  localPath: string,
  target: DeploymentTarget,
  remotePath: string,
): void {
  runCommand(
    "scp",
    [...SSH_OPTIONS, localPath, `root@${target.ip}:${remotePath}`],
    { display: `scp <temporary env> root@${target.ip}:${remotePath}` },
  );
}

async function confirmOrThrow(message: string, yes: boolean): Promise<void> {
  if (yes) return;
  if (!process.stdin.isTTY) {
    throw new Error("Confirmation requires an interactive terminal or --yes.");
  }
  const interface_ = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await interface_.question(`${message} [y/N] `);
    if (!/^y(?:es)?$/i.test(answer.trim())) {
      throw new Error("Cancelled.");
    }
  } finally {
    interface_.close();
  }
}

function selectSshKey(keys: DigitalOceanSshKey[], requested?: string): string {
  if (keys.length === 0) {
    throw new Error(
      "No DigitalOcean SSH keys exist. Upload one before provisioning.",
    );
  }
  if (requested) {
    const match = keys.find(
      (key) =>
        String(key.id) === requested ||
        key.fingerprint === requested ||
        key.name === requested,
    );
    if (!match) throw new Error(`DigitalOcean SSH key not found: ${requested}`);
    return match.fingerprint;
  }
  if (keys.length === 1) return keys[0].fingerprint;
  throw new Error(
    `Multiple DigitalOcean SSH keys exist; choose one with --ssh-key:\n${keys.map((key) => `- ${key.name}: ${key.fingerprint}`).join("\n")}`,
  );
}

function reconcileFirewall(options: {
  tag: string;
  targetIds: number[];
  useTag: boolean;
  port: number;
  domain?: string;
  sshSources: string[];
  dryRun: boolean;
}): void {
  const firewallName = `${options.tag}-firewall`;
  const rules = buildFirewallRules(
    options.port,
    options.domain,
    options.sshSources,
  );
  log(
    `Firewall: ${firewallName} (SSH, ${options.domain ? "HTTP/HTTPS" : `TCP ${options.port}`})`,
  );
  if (options.dryRun) return;

  const firewalls = parseJson<DigitalOceanFirewall[]>(
    runCommand("doctl", ["compute", "firewall", "list", "--output", "json"], {
      capture: true,
      display: "doctl compute firewall list --output json",
    }),
    "DigitalOcean firewalls",
  );
  const existing = firewalls.find((firewall) => firewall.name === firewallName);
  const targetIds = new Set([
    ...(existing?.droplet_ids || []),
    ...options.targetIds,
  ]);
  const targetTags = new Set(existing?.tags || []);
  if (options.useTag) targetTags.add(options.tag);
  const sharedArgs = [
    "--name",
    firewallName,
    "--inbound-rules",
    rules.inbound,
    "--outbound-rules",
    rules.outbound,
    "--droplet-ids",
    [...targetIds].join(","),
  ];
  if (targetTags.size > 0) {
    sharedArgs.push("--tag-names", [...targetTags].join(","));
  }

  if (existing) {
    runCommand(
      "doctl",
      ["compute", "firewall", "update", existing.id, ...sharedArgs],
      { display: `doctl compute firewall update ${existing.id} <app rules>` },
    );
  } else {
    runCommand("doctl", ["compute", "firewall", "create", ...sharedArgs], {
      display: "doctl compute firewall create <app rules>",
    });
  }
}

async function waitForSsh(target: DeploymentTarget): Promise<void> {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      remoteRun(target, "true", { capture: true, quiet: true });
      return;
    } catch {
      if (attempt === 30) break;
      log(`SSH not ready on ${target.name}; retrying (${attempt}/30)...`);
      await new Promise((resolve_) => setTimeout(resolve_, 5000));
    }
  }
  throw new Error(`SSH did not become ready on ${target.name}.`);
}

function runBootstrap(target: DeploymentTarget, appSlug: string): void {
  remoteRun(target, renderBootstrapScript(appSlug), {
    label: "install Docker and Caddy",
  });
}

function verifyRemoteHost(target: DeploymentTarget): void {
  const architecture = remoteRun(target, "uname -m", {
    capture: true,
    label: "check architecture",
  });
  if (architecture !== "x86_64" && architecture !== "amd64") {
    throw new Error(
      `${target.name} uses ${architecture}; this deployment supports x86_64 only.`,
    );
  }
  remoteRun(target, "docker info >/dev/null", {
    capture: true,
    label: "check Docker",
  });
}

function ensureCaddy(target: DeploymentTarget): void {
  try {
    remoteRun(target, "command -v caddy >/dev/null", {
      capture: true,
      quiet: true,
    });
  } catch {
    const os = remoteRun(target, '. /etc/os-release && printf %s "$ID"', {
      capture: true,
      label: "check operating system",
    });
    if (os !== "ubuntu") {
      throw new Error(
        `${target.name} needs Caddy but is ${os || "an unsupported OS"}; Ubuntu is required for automatic setup.`,
      );
    }
    remoteRun(target, renderCaddyInstallScript(), {
      label: "install Caddy",
    });
  }
}

function uploadImage(target: DeploymentTarget, image: string): void {
  const ssh = [
    "ssh",
    ...SSH_OPTIONS.map(shellQuote),
    shellQuote(`root@${target.ip}`),
    shellQuote("gunzip | docker load"),
  ].join(" ");
  const pipeline = `docker save ${shellQuote(image)} | gzip -1 | ${ssh}`;
  runCommand("bash", ["-o", "pipefail", "-c", pipeline], {
    display: `docker save ${image} | gzip | ssh root@${target.ip} docker load`,
  });
}

function applyCaddy(
  target: DeploymentTarget,
  appSlug: string,
  domain: string | undefined,
  port: number,
): boolean {
  const fragmentPath = `/etc/caddy/conf.d/${appSlug}.caddy`;
  if (!domain) {
    try {
      remoteRun(target, `test -f ${shellQuote(fragmentPath)}`, {
        capture: true,
        quiet: true,
      });
    } catch {
      return false;
    }
  } else {
    ensureCaddy(target);
  }

  const contents = domain
    ? renderCaddyFragment(domain, port)
    : `# No managed domain for ${appSlug}\n`;
  remoteRun(target, renderCaddyApplyScript(appSlug, contents), {
    label: domain
      ? `configure Caddy for ${domain}`
      : "disable managed Caddy site",
  });
  return true;
}

function rollbackTarget(
  target: DeploymentTarget,
  appSlug: string,
  caddyTouched: boolean,
): void {
  if (caddyTouched) {
    try {
      remoteRun(target, renderCaddyRollbackScript(appSlug), {
        label: "restore previous Caddy site",
      });
    } catch (error) {
      console.error(`Caddy rollback failed on ${target.name}:`, error);
    }
  }
  remoteRun(target, renderRemoteRollbackScript(appSlug), {
    label: "restore previous container",
  });
}

async function provision(
  options: CliOptions,
  project: ProjectDeploymentConfig,
  domain: string | undefined,
  tag: string,
): Promise<void> {
  assertTool("doctl", ["version"]);
  assertTool("ssh", ["-V"]);
  assertDigitalOceanAccess();

  const keys = parseJson<DigitalOceanSshKey[]>(
    runCommand("doctl", ["compute", "ssh-key", "list", "--output", "json"], {
      capture: true,
      display: "doctl compute ssh-key list --output json",
    }),
    "DigitalOcean SSH keys",
  );
  const sshKey = selectSshKey(keys, options.sshKey);
  const name = sanitizeSlug(options.name || tag, 63);
  let droplets = listDroplets();
  let droplet = droplets.find((candidate) => candidate.name === name);

  log();
  log("KingStack DigitalOcean provisioning");
  log(`Environment: ${options.environment}`);
  log(`Droplet:     ${name}${droplet ? " (reuse existing)" : " (create)"}`);
  log(`Region:      ${options.region}`);
  log(`Size:        ${options.size}`);
  log(`Image:       ubuntu-24-04-x64`);
  log(`Tag:         ${tag}`);
  log(
    `Routing:     ${domain ? `Caddy HTTPS for ${domain}` : `public TCP ${project.port}`}`,
  );
  log(`Backups:     ${options.backups ? "enabled" : "disabled"}`);

  if (options.dryRun) {
    log();
    log("Dry run complete; no resources were changed.");
    return;
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

  step(nextStep++, totalSteps, "Configuring the DigitalOcean firewall...");
  reconcileFirewall({
    tag,
    targetIds: [target.id],
    useTag: true,
    port: project.port,
    domain,
    sshSources: options.sshSources,
    dryRun: false,
  });

  step(nextStep++, totalSteps, "Waiting for SSH and host bootstrap...");
  await waitForSsh(target);
  if (droplet.status === "active") {
    try {
      remoteRun(target, "cloud-init status --wait", {
        label: "wait for cloud-init",
      });
    } catch {
      log("cloud-init did not report success; checking the installed tools...");
    }
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
    runBootstrap(target, project.appSlug);
  }
  verifyRemoteHost(target);

  log();
  log(`Provisioned ${name}: ${ip}`);
  log(
    `Next: yarn deploy:nest deploy ${options.environment}${options.domain ? ` --domain ${domain}` : options.noDomain ? " --no-domain" : ""}`,
  );
}

async function deploy(
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
  log(
    `Mode:        ${options.envOnly ? "environment only" : "image + migrations"}`,
  );

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

  const totalSteps = options.envOnly ? 3 : 5;
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

    step(nextStep++, totalSteps, "Applying Prisma production migrations...");
    runCommand("yarn", ["prisma:deploy"], {
      display: `yarn workspace ${project.prismaWorkspace} prisma migrate deploy`,
      env: { ...process.env, ...project.prismaEnv },
    });
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
  writeFileSync(envPath, project.nestEnv, { mode: 0o600 });
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
    await provision(options, project, domain, tag);
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
