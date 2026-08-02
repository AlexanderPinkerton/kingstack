import { isIP } from "node:net";

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
}

export interface DigitalOceanDroplet {
  id: number;
  name: string;
  status: string;
  tags?: string[];
  networks?: {
    v4?: Array<{
      ip_address?: string;
      type?: string;
    }>;
  };
}

export interface DeploymentTarget {
  id: number;
  name: string;
  ip: string;
}

export interface EnvFileDefinition {
  keys: string[];
  aliases?: Record<string, string>;
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

export function renderEnvFile(
  allValues: Record<string, unknown>,
  definition: EnvFileDefinition,
): string {
  const lines: string[] = [];

  for (const key of definition.keys) {
    appendEnvLine(lines, key, allValues[key]);
  }
  for (const [sourceKey, targetKey] of Object.entries(
    definition.aliases || {},
  )) {
    appendEnvLine(lines, targetKey, allValues[sourceKey]);
  }

  return `${lines.join("\n")}\n`;
}

function appendEnvLine(lines: string[], key: string, rawValue: unknown): void {
  if (rawValue === undefined) return;
  const value = String(rawValue);
  if (/[\r\n\0]/.test(value)) {
    throw new Error(
      `Configuration value ${key} cannot contain a newline or NUL.`,
    );
  }
  lines.push(`${key}=${value}`);
}

export function getPublicIp(droplet: DigitalOceanDroplet): string | undefined {
  return droplet.networks?.v4?.find((network) => network.type === "public")
    ?.ip_address;
}

export function selectDeploymentTargets(
  droplets: DigitalOceanDroplet[],
  tag: string,
  requestedDroplets: string[],
): DeploymentTarget[] {
  const requested = new Set(requestedDroplets);
  const matches = droplets.filter((droplet) => {
    if (requested.size > 0) {
      return requested.has(droplet.name) || requested.has(String(droplet.id));
    }
    return (droplet.tags || []).includes(tag);
  });

  if (requested.size > 0) {
    const found = new Set(
      matches.flatMap((droplet) => [droplet.name, String(droplet.id)]),
    );
    const missing = requestedDroplets.filter((value) => !found.has(value));
    if (missing.length > 0) {
      throw new Error(`Droplet(s) not found: ${missing.join(", ")}`);
    }
  }

  return matches
    .map((droplet) => {
      if (droplet.status !== "active") {
        throw new Error(
          `Droplet ${droplet.name} is ${droplet.status}, not active.`,
        );
      }
      const ip = getPublicIp(droplet);
      if (!ip) {
        throw new Error(`Droplet ${droplet.name} has no public IPv4 address.`);
      }
      return { id: droplet.id, name: droplet.name, ip };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function renderCaddyFragment(domain: string, port: number): string {
  return `${validateDomain(domain)} {\n    reverse_proxy 127.0.0.1:${parsePort(port)}\n}\n`;
}

export function buildFirewallRules(
  port: number,
  domain: string | undefined,
  sshSources: string[],
): { inbound: string; outbound: string } {
  const sources = sshSources.length > 0 ? sshSources : ["0.0.0.0/0", "::/0"];
  for (const source of sources) validateCidr(source);

  const inbound = sources.map(
    (source) => `protocol:tcp,ports:22,address:${source}`,
  );
  if (domain) {
    for (const source of ["0.0.0.0/0", "::/0"]) {
      inbound.push(`protocol:tcp,ports:80,address:${source}`);
      inbound.push(`protocol:tcp,ports:443,address:${source}`);
    }
  } else {
    for (const source of ["0.0.0.0/0", "::/0"]) {
      inbound.push(`protocol:tcp,ports:${parsePort(port)},address:${source}`);
    }
  }

  const outbound = [
    "protocol:icmp,address:0.0.0.0/0",
    "protocol:icmp,address:::/0",
    "protocol:tcp,ports:all,address:0.0.0.0/0",
    "protocol:tcp,ports:all,address:::/0",
    "protocol:udp,ports:all,address:0.0.0.0/0",
    "protocol:udp,ports:all,address:::/0",
  ];

  return { inbound: inbound.join(" "), outbound: outbound.join(" ") };
}

function validateCidr(value: string): void {
  const separator = value.lastIndexOf("/");
  const address = separator >= 0 ? value.slice(0, separator) : "";
  const prefix = separator >= 0 ? Number(value.slice(separator + 1)) : NaN;
  const version = isIP(address);
  const maxPrefix = version === 4 ? 32 : version === 6 ? 128 : -1;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) {
    throw new Error(`Invalid SSH source CIDR: ${value}`);
  }
}

export function renderCloudInit(appSlug: string): string {
  const bootstrap = renderBootstrapScript(appSlug)
    .trimEnd()
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n");

  return `#cloud-config
ssh_pwauth: false
disable_root: false
package_update: true
packages:
  - ca-certificates
  - curl
  - debian-keyring
  - debian-archive-keyring
  - gpg
  - apt-transport-https
write_files:
  - path: /usr/local/sbin/kingstack-bootstrap
    permissions: "0755"
    content: |
${bootstrap}
runcmd:
  - [bash, /usr/local/sbin/kingstack-bootstrap]
`;
}

export function renderBootstrapScript(appSlug: string): string {
  const appDir = `/opt/kingstack/${sanitizeSlug(appSlug)}`;
  return `#!/usr/bin/env bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gpg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
printf '%s\\n' \\
  'Types: deb' \\
  'URIs: https://download.docker.com/linux/ubuntu' \\
  "Suites: \${UBUNTU_CODENAME:-$VERSION_CODENAME}" \\
  'Components: stable' \\
  "Architectures: $(dpkg --print-architecture)" \\
  'Signed-By: /etc/apt/keyrings/docker.asc' \\
  > /etc/apt/sources.list.d/docker.sources
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key -o /tmp/caddy.gpg
gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg /tmp/caddy.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
chmod o+r /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin caddy
install -d -m 0755 /etc/caddy/conf.d
install -d -m 0700 ${appDir}
systemctl enable --now docker
systemctl enable --now caddy
`;
}

export function renderCaddyInstallScript(): string {
  return `#!/usr/bin/env bash
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl debian-keyring debian-archive-keyring gpg apt-transport-https
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key -o /tmp/caddy.gpg
gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg /tmp/caddy.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
chmod o+r /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy
install -d -m 0755 /etc/caddy/conf.d
systemctl enable --now caddy
`;
}

export function renderRemoteDeployScript(options: {
  appSlug: string;
  imageReference: string;
  revision: string;
  port: number;
  domain?: string;
}): string {
  const appSlug = sanitizeSlug(options.appSlug);
  const port = parsePort(options.port);
  const current = `${appSlug}-nest`;
  const candidate = `${current}-candidate`;
  const previous = `${current}-previous`;
  const appDir = `/opt/kingstack/${appSlug}`;
  const publish = options.domain
    ? `127.0.0.1:${port}:${port}`
    : `0.0.0.0:${port}:${port}`;
  const probe = shellQuote(
    `const http=require("node:http");const port=Number(process.env.PORT||${port});const request=http.get({host:"127.0.0.1",port,path:"/"},response=>{response.resume();process.exit(0)});request.setTimeout(1000,()=>{request.destroy();process.exit(1)});request.on("error",()=>process.exit(1));`,
  );

  return `#!/usr/bin/env bash
set -euo pipefail
app_dir=${shellQuote(appDir)}
current=${shellQuote(current)}
candidate=${shellQuote(candidate)}
previous=${shellQuote(previous)}
image=${shellQuote(options.imageReference)}
revision=${shellQuote(options.revision)}
staged_env=${shellQuote(`/tmp/${appSlug}.env.next`)}
active_env="$app_dir/.env"

wait_ready() {
  local container="$1"
  for _attempt in $(seq 1 30); do
    if ! docker inspect "$container" >/dev/null 2>&1; then
      return 1
    fi
    if [ "$(docker inspect --format '{{.State.Running}}' "$container")" != "true" ]; then
      return 1
    fi
    if docker exec "$container" node -e ${probe}; then
      return 0
    fi
    sleep 2
  done
  return 1
}

restore_previous() {
  docker rm -f "$current" >/dev/null 2>&1 || true
  if docker inspect "$previous" >/dev/null 2>&1; then
    docker rename "$previous" "$current"
    docker start "$current" >/dev/null
  fi
}

install -d -m 0700 "$app_dir"
install -m 0600 "$staged_env" "$active_env"
rm -f "$staged_env"
docker rm -f "$candidate" >/dev/null 2>&1 || true

docker run -d --restart=no \
  --name "$candidate" \
  --env-file "$active_env" \
  --label com.kingstack.app=${shellQuote(appSlug)} \
  --label com.kingstack.revision="$revision" \
  "$image" >/dev/null

if ! wait_ready "$candidate"; then
  docker logs "$candidate" --tail 100 >&2 || true
  docker rm -f "$candidate" >/dev/null 2>&1 || true
  exit 1
fi

old_previous_image=""
if docker inspect "$previous" >/dev/null 2>&1; then
  old_previous_image="$(docker inspect --format '{{.Image}}' "$previous")"
  docker rm -f "$previous" >/dev/null
fi

if docker inspect "$current" >/dev/null 2>&1; then
  docker stop "$current" >/dev/null || true
  docker rename "$current" "$previous"
fi

docker rm -f "$candidate" >/dev/null
if ! docker run -d --restart=unless-stopped \
  --name "$current" \
  --env-file "$active_env" \
  --label com.kingstack.app=${shellQuote(appSlug)} \
  --label com.kingstack.revision="$revision" \
  -p ${shellQuote(publish)} \
  "$image" >/dev/null; then
  restore_previous
  exit 1
fi

if ! wait_ready "$current"; then
  docker logs "$current" --tail 100 >&2 || true
  restore_previous
  exit 1
fi

if [ -n "$old_previous_image" ]; then
  docker image rm "$old_previous_image" >/dev/null 2>&1 || true
fi
`;
}

export function renderRemoteRollbackScript(appSlugValue: string): string {
  const appSlug = sanitizeSlug(appSlugValue);
  const current = `${appSlug}-nest`;
  const previous = `${current}-previous`;
  return `#!/usr/bin/env bash
set -euo pipefail
current=${shellQuote(current)}
previous=${shellQuote(previous)}
if ! docker inspect "$previous" >/dev/null 2>&1; then
  echo "No previous container is available for $current" >&2
  exit 1
fi
failed_image=""
if docker inspect "$current" >/dev/null 2>&1; then
  failed_image="$(docker inspect --format '{{.Image}}' "$current")"
  docker rm -f "$current" >/dev/null
fi
docker rename "$previous" "$current"
docker start "$current" >/dev/null
if [ -n "$failed_image" ]; then
  docker image rm "$failed_image" >/dev/null 2>&1 || true
fi
`;
}

export function renderCaddyApplyScript(
  appSlugValue: string,
  fragmentContents: string,
): string {
  const appSlug = sanitizeSlug(appSlugValue);
  const fragment = `/etc/caddy/conf.d/${appSlug}.caddy`;
  const previous = `${fragment}.previous`;
  const previousMissing = `${previous}.missing`;
  const encoded = Buffer.from(fragmentContents, "utf8").toString("base64");

  return `#!/usr/bin/env bash
set -euo pipefail
root=/etc/caddy/Caddyfile
fragment=${shellQuote(fragment)}
previous=${shellQuote(previous)}
previous_missing=${shellQuote(previousMissing)}
root_candidate=/tmp/kingstack.Caddyfile
root_previous=/tmp/kingstack.Caddyfile.previous
fragment_candidate=/tmp/kingstack.fragment.caddy

install -d -m 0755 /etc/caddy/conf.d
touch "$root"
cp "$root" "$root_previous"
cp "$root" "$root_candidate"
if ! grep -Fqx 'import /etc/caddy/conf.d/*.caddy' "$root_candidate"; then
  printf '\nimport /etc/caddy/conf.d/*.caddy\n' >> "$root_candidate"
fi

rm -f "$previous" "$previous_missing"
if [ -f "$fragment" ]; then
  cp "$fragment" "$previous"
else
  touch "$previous_missing"
fi
printf %s ${shellQuote(encoded)} | base64 -d > "$fragment_candidate"
install -m 0644 "$fragment_candidate" "$fragment"

restore_files() {
  cp "$root_previous" "$root"
  if [ -f "$previous" ]; then
    cp "$previous" "$fragment"
  else
    rm -f "$fragment"
  fi
}

if ! caddy validate --adapter caddyfile --config "$root_candidate"; then
  restore_files
  exit 1
fi
install -m 0644 "$root_candidate" "$root"
if ! caddy reload --adapter caddyfile --config "$root"; then
  restore_files
  caddy reload --adapter caddyfile --config "$root" || true
  exit 1
fi
`;
}

export function renderCaddyRollbackScript(appSlugValue: string): string {
  const appSlug = sanitizeSlug(appSlugValue);
  const fragment = `/etc/caddy/conf.d/${appSlug}.caddy`;
  const previous = `${fragment}.previous`;
  const previousMissing = `${previous}.missing`;
  return `#!/usr/bin/env bash
set -euo pipefail
fragment=${shellQuote(fragment)}
previous=${shellQuote(previous)}
previous_missing=${shellQuote(previousMissing)}
if [ -f "$previous" ]; then
  cp "$previous" "$fragment"
elif [ -f "$previous_missing" ]; then
  printf '# No managed domain for ${appSlug}\n' > "$fragment"
else
  exit 0
fi
caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile
caddy reload --adapter caddyfile --config /etc/caddy/Caddyfile
`;
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

Deploy options:
  --tag <tag>           Target every active droplet with this tag
  --droplet <name|id>   Target an exact droplet; repeatable
  --env-only            Upload configuration without building or migrating

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
