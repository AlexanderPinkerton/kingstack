export type DeployCommand = "provision" | "deploy";

export interface CliOptions {
  command?: DeployCommand;
  environment?: string;
  help: boolean;
  region?: string;
  size: string;
  name?: string;
  sshKey?: string;
  sshSources: string[];
  domain?: string;
  noDomain: boolean;
  backups: boolean;
  dryRun: boolean;
  yes: boolean;
  tag?: string;
  droplets: string[];
  envOnly: boolean;
  deployAfterProvision: boolean;
  skipMigrations: boolean;
  withoutDatabase: boolean;
}

const VALUE_FLAGS = new Set([
  "--region",
  "--size",
  "--name",
  "--ssh-key",
  "--ssh-source",
  "--domain",
  "--tag",
  "--droplet",
]);

const BOOLEAN_FLAGS = new Set([
  "--no-domain",
  "--backups",
  "--dry-run",
  "--yes",
  "--env-only",
  "--deploy",
  "--skip-migrations",
  "--without-database",
  "--help",
  "-h",
]);

export function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    help: false,
    size: "s-1vcpu-1gb",
    sshSources: [],
    noDomain: false,
    backups: false,
    dryRun: false,
    yes: false,
    droplets: [],
    envOnly: false,
    deployAfterProvision: false,
    skipMigrations: false,
    withoutDatabase: false,
  };
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (VALUE_FLAGS.has(arg)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value after ${arg}.`);
      }
      index += 1;

      switch (arg) {
        case "--region":
          options.region = value;
          break;
        case "--size":
          options.size = value;
          break;
        case "--name":
          options.name = value;
          break;
        case "--ssh-key":
          options.sshKey = value;
          break;
        case "--ssh-source":
          options.sshSources.push(value);
          break;
        case "--domain":
          options.domain = value;
          break;
        case "--tag":
          options.tag = value;
          break;
        case "--droplet":
          options.droplets.push(value);
          break;
      }
      continue;
    }

    if (BOOLEAN_FLAGS.has(arg)) {
      switch (arg) {
        case "--no-domain":
          options.noDomain = true;
          break;
        case "--backups":
          options.backups = true;
          break;
        case "--dry-run":
          options.dryRun = true;
          break;
        case "--yes":
          options.yes = true;
          break;
        case "--env-only":
          options.envOnly = true;
          break;
        case "--deploy":
          options.deployAfterProvision = true;
          break;
        case "--skip-migrations":
          options.skipMigrations = true;
          break;
        case "--without-database":
          options.withoutDatabase = true;
          break;
        case "--help":
        case "-h":
          options.help = true;
          break;
      }
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    positionals.push(arg);
  }

  if (positionals[0]) {
    if (positionals[0] !== "provision" && positionals[0] !== "deploy") {
      throw new Error(
        `Unknown command: ${positionals[0]}. Use provision or deploy.`,
      );
    }
    options.command = positionals[0];
  }
  options.environment = positionals[1];

  if (positionals.length > 2) {
    throw new Error(`Unexpected argument: ${positionals[2]}`);
  }
  if (options.domain && options.noDomain) {
    throw new Error("Use either --domain or --no-domain, not both.");
  }
  if (options.tag && options.droplets.length > 0) {
    throw new Error("Use either --tag or --droplet, not both.");
  }
  if (options.command === "provision" && options.droplets.length > 0) {
    throw new Error("--droplet is only valid with the deploy command.");
  }
  if (options.command === "deploy" && options.backups) {
    throw new Error("--backups is only valid with the provision command.");
  }
  if (options.command === "deploy" && options.deployAfterProvision) {
    throw new Error("--deploy is only valid with the provision command.");
  }
  if (options.command === "provision" && options.envOnly) {
    throw new Error("--env-only is only valid with the deploy command.");
  }
  if (
    options.command === "provision" &&
    options.skipMigrations &&
    !options.deployAfterProvision
  ) {
    throw new Error("--skip-migrations requires --deploy when provisioning.");
  }
  if (
    options.command === "provision" &&
    options.withoutDatabase &&
    !options.deployAfterProvision
  ) {
    throw new Error("--without-database requires --deploy when provisioning.");
  }
  if (options.envOnly && options.skipMigrations) {
    throw new Error("--env-only already skips migrations.");
  }

  return options;
}

export function validateRequiredOptions(options: CliOptions): void {
  if (options.help) return;
  if (!options.command) {
    throw new Error("Missing command. Use provision or deploy.");
  }
  if (!options.environment) {
    throw new Error(`Missing environment after ${options.command}.`);
  }
  if (options.command === "provision" && !options.region) {
    throw new Error("Provisioning requires --region <DigitalOcean region>.");
  }
}

export function sanitizeSlug(value: string, maxLength = 40): string {
  const withoutScope = value.includes("/")
    ? value.split("/").pop() || value
    : value;
  const slug = withoutScope
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)
    .replace(/-$/g, "");

  if (!slug) {
    throw new Error(`Cannot derive a deployment name from "${value}".`);
  }
  return slug;
}

export function getDefaultTag(appSlug: string, environment: string): string {
  const environmentSlug = sanitizeSlug(environment, 20);
  const suffix = `-${environmentSlug}-nest`;
  return `${sanitizeSlug(appSlug, 63 - suffix.length)}${suffix}`;
}

export function parsePort(value: unknown): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid Nest port: ${String(value)}`);
  }
  return port;
}

export function resolveDomain(
  backendUrl: unknown,
  override?: string,
  noDomain = false,
): string | undefined {
  if (noDomain) return undefined;
  if (override) return validateDomain(override);
  if (typeof backendUrl !== "string" || backendUrl === "") return undefined;

  let url: URL;
  try {
    url = new URL(backendUrl);
  } catch {
    throw new Error(`Invalid NEXT_PUBLIC_NEST_BACKEND_URL: ${backendUrl}`);
  }

  if (url.protocol !== "https:" || isLocalHostname(url.hostname)) {
    return undefined;
  }
  return validateDomain(url.hostname);
}

export function validateDomain(value: string): string {
  const domain = value.trim().toLowerCase().replace(/\.$/, "");
  if (
    domain.length > 253 ||
    !domain.includes(".") ||
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) ||
    domain
      .split(".")
      .some(
        (part) =>
          part.length === 0 ||
          part.length > 63 ||
          !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(part),
      )
  ) {
    throw new Error(`Invalid domain: ${value}`);
  }
  return domain;
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

export function formatHelp(): string {
  return `
Deploy the KingStack NestJS Docker image to DigitalOcean droplets.

Usage:
  yarn deploy:nest provision <environment> --region <region> [options]
  yarn deploy:nest deploy <environment> [options]

Provision options:
  --region <slug>       Required DigitalOcean region, for example nyc3
  --size <slug>         Droplet size (default: s-1vcpu-1gb)
  --name <name>         Droplet name (default: the deployment tag)
  --ssh-key <value>     SSH key ID, fingerprint, or name
  --ssh-source <cidr>   Allowed SSH source; repeatable (default: all IPv4/IPv6)
  --backups             Enable billable DigitalOcean backups
  --deploy              Deploy to the provisioned host after setup

Deploy options:
  --tag <tag>           Target every active droplet with this tag
  --droplet <name|id>   Target an exact droplet; repeatable
  --env-only            Upload configuration without building or migrating
  --skip-migrations     Build and deploy without running Prisma migrations
  --without-database    Skip migrations and the Prisma startup connection

Shared options:
  --domain <hostname>   Configure Caddy for this hostname
  --no-domain           Expose the configured Nest port without Caddy
  --dry-run             Resolve and display the plan without making changes
  --yes                 Skip the confirmation prompt
  --help, -h            Show this help

Defaults:
  The app name comes from package.json. The target tag is
  <app>-<environment>-nest. Without a domain flag, HTTPS
  NEXT_PUBLIC_NEST_BACKEND_URL config enables Caddy automatically.
`;
}
