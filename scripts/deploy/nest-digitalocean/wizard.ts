import { createInterface, type Interface } from "node:readline/promises";
import { schema } from "../../../config/schema.js";
import { assertTool, log } from "./commands.js";
import {
  assertDigitalOceanAccess,
  getPublicIp,
  listDroplets,
  listRegions,
  listSizes,
  listSshKeys,
  validateCidr,
  type DigitalOceanDroplet,
  type DigitalOceanRegion,
  type DigitalOceanSize,
} from "./digitalocean.js";
import {
  getDefaultTag,
  resolveDomain,
  validateDomain,
  type CliOptions,
  type DeployCommand,
} from "./options.js";
import {
  loadProjectConfig,
  type ProjectDeploymentConfig,
} from "./project-config.js";

type DeploymentMode =
  "full" | "skip-migrations" | "env-only" | "without-database";
type ExistingHostScope = "application" | "reconfigure";

interface Choice<T> {
  label: string;
  value: T;
}

export interface NestWizardResult {
  options: CliOptions;
  project: ProjectDeploymentConfig;
}

const COMMON_SIZE_SLUGS = [
  "s-1vcpu-1gb",
  "s-1vcpu-2gb",
  "s-2vcpu-2gb",
  "s-2vcpu-4gb",
  "s-4vcpu-8gb",
];

export async function runNestWizard(
  baseOptions: CliOptions,
): Promise<NestWizardResult> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "The Nest deployment wizard requires an interactive terminal. Use the explicit provision/deploy arguments for non-interactive automation.",
    );
  }

  log();
  log("KingStack NestJS deployment wizard");
  log(
    "Answer a few questions; the existing deployment plan and confirmation follow.",
  );

  const interface_ = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    let options = cloneOptions(baseOptions);
    options.command =
      options.command ||
      (await choose<DeployCommand>(interface_, "What do you want to do?", [
        {
          label: "Provision a host (guided first deployment)",
          value: "provision",
        },
        {
          label: "Deploy to existing host(s)",
          value: "deploy",
        },
      ]));
    options.environment =
      options.environment || (await chooseEnvironment(interface_));

    const project = await loadProjectConfig(options.environment);
    const tag =
      options.tag || getDefaultTag(project.appSlug, options.environment);

    assertTool("doctl", ["version"]);
    assertDigitalOceanAccess();

    if (options.command === "provision") {
      options = await configureProvision(interface_, options, tag);
    } else {
      options = await configureDeploy(interface_, options, tag);
    }
    if (options.command === "provision" || options.reconfigureHost) {
      options = await configureRouting(interface_, options, project);
      options = await configureBackendConfigUpdate(
        interface_,
        options,
        project,
      );
    }

    if (!options.dryRun) {
      options.dryRun =
        (await choose(interface_, "How should the completed plan run?", [
          {
            label: "Execute after the normal safety confirmation",
            value: false,
          },
          {
            label: "Dry run only (no cloud, database, or host changes)",
            value: true,
          },
        ])) === true;
    }

    return { options, project };
  } finally {
    interface_.close();
  }
}

export function availableRegions(
  regions: readonly DigitalOceanRegion[],
): DigitalOceanRegion[] {
  return regions
    .filter(
      ({ available, sizes }) => available === true && Boolean(sizes?.length),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function availableSizes(
  region: DigitalOceanRegion,
  sizes: readonly DigitalOceanSize[],
): DigitalOceanSize[] {
  const regionSizes = new Set(region.sizes || []);
  return sizes
    .filter(
      (size) =>
        size.available !== false &&
        (regionSizes.has(size.slug) || size.regions?.includes(region.slug)),
    )
    .sort(
      (left, right) =>
        left.price_monthly - right.price_monthly ||
        left.slug.localeCompare(right.slug),
    );
}

export function suggestedSizes(
  sizes: readonly DigitalOceanSize[],
): DigitalOceanSize[] {
  const bySlug = new Map(sizes.map((size) => [size.slug, size]));
  return COMMON_SIZE_SLUGS.flatMap((slug) => {
    const size = bySlug.get(slug);
    return size ? [size] : [];
  });
}

export function parseNumberSelection(value: string, count: number): number[] {
  const indexes = [
    ...new Set(
      value
        .split(",")
        .map((part) => Number(part.trim()) - 1)
        .filter((index) => Number.isInteger(index)),
    ),
  ];
  if (
    indexes.length === 0 ||
    indexes.some((index) => index < 0 || index >= count)
  ) {
    throw new Error(
      `Enter one or more numbers from 1 to ${count}, separated by commas.`,
    );
  }
  return indexes;
}

export function applyDeploymentMode(
  options: CliOptions,
  mode: DeploymentMode,
): CliOptions {
  return {
    ...options,
    envOnly: mode === "env-only",
    skipMigrations: mode === "skip-migrations",
    withoutDatabase: mode === "without-database",
  };
}

export function applyExistingHostScope(
  options: CliOptions,
  scope: ExistingHostScope,
): CliOptions {
  return { ...options, reconfigureHost: scope === "reconfigure" };
}

function cloneOptions(options: CliOptions): CliOptions {
  return {
    ...options,
    sshSources: [...options.sshSources],
    droplets: [...options.droplets],
  };
}

async function chooseEnvironment(interface_: Interface): Promise<string> {
  const environments = Object.entries(schema.environments)
    .filter(([, definition]) => definition.mode === "hosted")
    .map(([name, definition]) => ({
      label: `${name}${definition.description ? ` — ${definition.description}` : ""}`,
      value: name,
    }));
  if (environments.length === 0) {
    throw new Error("No hosted environments are declared in config/schema.ts.");
  }
  const defaultIndex = Math.max(
    0,
    environments.findIndex(({ value }) => value === "production"),
  );
  return choose(
    interface_,
    "Which KingStack environment?",
    environments,
    defaultIndex,
  );
}

async function configureProvision(
  interface_: Interface,
  options: CliOptions,
  tag: string,
): Promise<CliOptions> {
  const regions = availableRegions(listRegions());
  if (regions.length === 0) {
    throw new Error(
      "DigitalOcean reported no currently available Droplet regions.",
    );
  }
  const region = options.region
    ? regions.find(({ slug }) => slug === options.region)
    : await choose(
        interface_,
        "Choose the datacenter closest to the backend's users and database:",
        regions.map((candidate) => ({
          label: `${candidate.name} (${candidate.slug})`,
          value: candidate,
        })),
      );
  if (!region) {
    throw new Error(
      `DigitalOcean region ${options.region} is unavailable for new Droplets.`,
    );
  }
  options.region = region.slug;

  const sizes = availableSizes(region, listSizes());
  if (sizes.length === 0) {
    throw new Error(
      `No Droplet sizes are currently available in ${region.slug}.`,
    );
  }
  options.size = await chooseSize(interface_, region, sizes, options.size);

  if (!options.sshKey) {
    const keys = listSshKeys();
    if (keys.length === 0) {
      throw new Error(
        "No DigitalOcean SSH keys exist. Upload one before provisioning.",
      );
    }
    options.sshKey =
      keys.length === 1
        ? keys[0].fingerprint
        : await choose(
            interface_,
            "Which SSH key should receive root access?",
            keys.map((key) => ({
              label: `${key.name} (${key.fingerprint})`,
              value: key.fingerprint,
            })),
          );
    if (keys.length === 1) log(`SSH key: ${keys[0].name}`);
  }

  if (!options.name) {
    options.name = await promptText(interface_, "Droplet name", tag);
  }
  options = await configureSshFirewall(interface_, options);
  if (!options.backups) {
    options.backups = await confirm(
      interface_,
      "Enable billable DigitalOcean backups?",
      false,
    );
  }
  if (!options.deployAfterProvision) {
    options.deployAfterProvision = await confirm(
      interface_,
      "Deploy the Nest application after the host is ready?",
      true,
    );
  }
  if (options.deployAfterProvision && !hasExplicitDeploymentMode(options)) {
    options = applyDeploymentMode(
      options,
      await chooseDeploymentMode(interface_),
    );
  }
  return options;
}

async function chooseSize(
  interface_: Interface,
  region: DigitalOceanRegion,
  sizes: DigitalOceanSize[],
  currentSlug: string,
): Promise<string> {
  const suggested = suggestedSizes(sizes);
  const visible = suggested.length > 0 ? suggested : sizes.slice(0, 5);
  const custom = Symbol("custom-size");
  const choices: Array<Choice<DigitalOceanSize | typeof custom>> = [
    ...visible.map((size) => ({ label: sizeLabel(size), value: size })),
    {
      label: `Enter another size slug (${sizes.length} available in ${region.slug})`,
      value: custom,
    },
  ];
  const defaultIndex = Math.max(
    0,
    visible.findIndex(({ slug }) => slug === currentSlug),
  );
  const selected = await choose(
    interface_,
    "Choose compute. Prices are provider-reported and exclude backups/usage:",
    choices,
    defaultIndex,
  );
  if (selected !== custom) return selected.slug;

  const slug = await promptText(interface_, "DigitalOcean size slug");
  const exact = sizes.find((size) => size.slug === slug);
  if (!exact) {
    throw new Error(
      `Size ${slug} is not currently available in ${region.slug}.`,
    );
  }
  log(`Selected: ${sizeLabel(exact)}`);
  return exact.slug;
}

async function configureDeploy(
  interface_: Interface,
  options: CliOptions,
  tag: string,
): Promise<CliOptions> {
  if (!options.tag && options.droplets.length === 0) {
    const active = listDroplets()
      .filter((droplet) => droplet.status === "active" && getPublicIp(droplet))
      .sort((left, right) => left.name.localeCompare(right.name));
    if (active.length === 0) {
      throw new Error(
        "No active Droplets with public IPv4 addresses were found. Choose provision first.",
      );
    }
    const tagged = active.filter((droplet) =>
      (droplet.tags || []).includes(tag),
    );
    const exact = Symbol("exact-droplets");
    const customTag = Symbol("custom-tag");
    const choices: Array<Choice<"tagged" | typeof exact | typeof customTag>> =
      [];
    if (tagged.length > 0) {
      choices.push({
        label: `All ${tagged.length} active Droplet(s) tagged ${tag}`,
        value: "tagged",
      });
    }
    choices.push(
      {
        label: "Choose exact Droplet(s)",
        value: exact,
      },
      {
        label: "Enter a different fleet tag",
        value: customTag,
      },
    );
    const targetMode = await choose(
      interface_,
      "Which Droplets should receive this deployment?",
      choices,
    );
    if (targetMode === "tagged") {
      options.tag = tag;
    } else if (targetMode === customTag) {
      options.tag = await promptText(interface_, "DigitalOcean fleet tag");
    } else {
      options.droplets = await chooseDroplets(interface_, active, tagged);
    }
  }

  if (!options.reconfigureHost) {
    options = applyExistingHostScope(
      options,
      await choose<ExistingHostScope>(
        interface_,
        "What should this deployment change?",
        [
          {
            label:
              "Application only — preserve firewall, SSH policy, HTTPS, and local config",
            value: "application",
          },
          {
            label:
              "Reconfigure host — also manage firewall, SSH policy, HTTPS, and local config",
            value: "reconfigure",
          },
        ],
      ),
    );
  }
  if (!hasExplicitDeploymentMode(options)) {
    options = applyDeploymentMode(
      options,
      await chooseDeploymentMode(interface_),
    );
  }
  return options.reconfigureHost
    ? configureSshFirewall(interface_, options)
    : options;
}

async function chooseDroplets(
  interface_: Interface,
  droplets: DigitalOceanDroplet[],
  defaults: DigitalOceanDroplet[],
): Promise<string[]> {
  log();
  log("Available active Droplets:");
  droplets.forEach((droplet, index) => {
    log(`  ${index + 1}. ${dropletLabel(droplet)}`);
  });
  const defaultIndexes = defaults
    .map((droplet) => droplets.indexOf(droplet) + 1)
    .filter((index) => index > 0)
    .join(",");
  const suffix = defaultIndexes ? ` [${defaultIndexes}]` : "";
  const answer = (
    await interface_.question(
      `Select one or more numbers separated by commas${suffix}: `,
    )
  ).trim();
  const indexes = parseNumberSelection(
    answer || defaultIndexes,
    droplets.length,
  );
  return indexes.map((index) => String(droplets[index].id));
}

async function chooseDeploymentMode(
  interface_: Interface,
): Promise<DeploymentMode> {
  return choose(interface_, "Choose the deployment mode:", [
    {
      label: "Full image deploy + Prisma migrations",
      value: "full",
    },
    {
      label: "Image deploy; skip Prisma migrations",
      value: "skip-migrations",
    },
    {
      label: "Configuration only; reuse the current image",
      value: "env-only",
    },
    {
      label: "Image deploy with database startup disabled",
      value: "without-database",
    },
  ]);
}

async function configureSshFirewall(
  interface_: Interface,
  options: CliOptions,
): Promise<CliOptions> {
  if (options.sshSources.length > 0) return options;
  const restricted = await choose(interface_, "Who may connect over SSH?", [
    {
      label: "Anywhere (key-only login; current default)",
      value: false,
    },
    {
      label: "Only specific IPv4/IPv6 CIDR ranges",
      value: true,
    },
  ]);
  if (!restricted) return options;

  const raw = await promptText(
    interface_,
    "Allowed CIDRs, comma-separated (for one IPv4 address use /32)",
  );
  const sources = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  for (const source of sources) validateCidr(source);
  return { ...options, sshSources: sources };
}

async function configureRouting(
  interface_: Interface,
  options: CliOptions,
  project: ProjectDeploymentConfig,
): Promise<CliOptions> {
  if (options.domain || options.noDomain || options.ipHttps) return options;
  const configuredDomain = resolveDomain(project.backendUrl);
  const custom = Symbol("custom-domain");
  const publicIp = Symbol("public-ip");
  const choices: Array<
    Choice<string | undefined | typeof custom | typeof publicIp>
  > = [];
  if (configuredDomain) {
    choices.push({
      label: `Caddy HTTPS using configured ${configuredDomain}`,
      value: configuredDomain,
    });
  }
  choices.push(
    {
      label: "Trusted HTTPS using the Droplet public IP (no domain required)",
      value: publicIp,
    },
    {
      label: "Enter a custom HTTPS hostname",
      value: custom,
    },
    {
      label: `Direct public TCP port ${project.port} (diagnostics; no HTTPS)`,
      value: undefined,
    },
  );
  const routing = await choose(
    interface_,
    "How should clients reach NestJS?",
    choices,
  );
  if (routing === custom) {
    const domain = validateDomain(
      await promptText(interface_, "NestJS HTTPS hostname"),
    );
    return { ...options, domain, noDomain: false, ipHttps: false };
  }
  if (routing === publicIp) {
    return {
      ...options,
      domain: undefined,
      noDomain: false,
      ipHttps: true,
    };
  }
  return routing
    ? { ...options, domain: routing, noDomain: false, ipHttps: false }
    : {
        ...options,
        domain: undefined,
        noDomain: true,
        ipHttps: false,
      };
}

async function configureBackendConfigUpdate(
  interface_: Interface,
  options: CliOptions,
  project: ProjectDeploymentConfig,
): Promise<CliOptions> {
  const willDeploy =
    options.command === "deploy" || options.deployAfterProvision;
  if (!willDeploy) return options;

  if (options.ipHttps) {
    if (options.updateConfig) return options;
    const updateConfig = await confirm(
      interface_,
      `After deployment, update config/${options.environment}.ts NEST_HOST to the Droplet public IP?`,
      true,
    );
    return { ...options, updateConfig };
  }

  const domain = resolveDomain(
    project.backendUrl,
    options.domain,
    options.noDomain,
  );
  if (!domain) {
    log();
    log(
      "Direct HTTP is useful for diagnostics, but an HTTPS Next/Vercel frontend cannot use it directly.",
    );
    log("NEST_HOST will not be updated without an HTTPS hostname.");
    return options;
  }

  if (domain === resolveDomain(project.backendUrl) || options.updateConfig) {
    return options;
  }
  const updateConfig = await confirm(
    interface_,
    `After deployment, update config/${options.environment}.ts NEST_HOST to ${domain}?`,
    true,
  );
  return { ...options, updateConfig };
}

function hasExplicitDeploymentMode(options: CliOptions): boolean {
  return options.envOnly || options.skipMigrations || options.withoutDatabase;
}

function sizeLabel(size: DigitalOceanSize): string {
  const memory =
    size.memory >= 1024
      ? `${Number((size.memory / 1024).toFixed(1))} GB RAM`
      : `${size.memory} MB RAM`;
  return `${size.slug} — ${size.vcpus} vCPU, ${memory}, ${size.disk} GB disk, $${size.price_monthly}/month ($${size.price_hourly}/hour)${size.description ? `, ${size.description}` : ""}`;
}

function dropletLabel(droplet: DigitalOceanDroplet): string {
  const region =
    droplet.region?.name || droplet.region?.slug || "unknown region";
  const tags = droplet.tags?.length ? `; tags: ${droplet.tags.join(", ")}` : "";
  return `${droplet.name} (${droplet.id}, ${getPublicIp(droplet)}, ${region}${tags})`;
}

async function choose<T>(
  interface_: Interface,
  question: string,
  choices: readonly Choice<T>[],
  defaultIndex = 0,
): Promise<T> {
  log();
  log(question);
  choices.forEach((choice, index) => {
    log(`  ${index + 1}. ${choice.label}`);
  });
  const answer = (
    await interface_.question(`Select [${defaultIndex + 1}]: `)
  ).trim();
  const selectedIndex = answer === "" ? defaultIndex : Number(answer) - 1;
  if (!Number.isInteger(selectedIndex) || !choices[selectedIndex]) {
    throw new Error(`Enter a number from 1 to ${choices.length}.`);
  }
  return choices[selectedIndex].value;
}

async function promptText(
  interface_: Interface,
  question: string,
  defaultValue?: string,
): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = (await interface_.question(`${question}${suffix}: `)).trim();
  const value = answer || defaultValue;
  if (!value) throw new Error(`${question} is required.`);
  return value;
}

async function confirm(
  interface_: Interface,
  question: string,
  defaultYes: boolean,
): Promise<boolean> {
  const suffix = defaultYes ? " [Y/n] " : " [y/N] ";
  const answer = (await interface_.question(`${question}${suffix}`))
    .trim()
    .toLowerCase();
  if (!answer) return defaultYes;
  if (answer === "y" || answer === "yes") return true;
  if (answer === "n" || answer === "no") return false;
  throw new Error("Enter yes or no.");
}
