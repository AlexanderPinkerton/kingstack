import { isIP } from "node:net";
import { log, parseJson, runCommand } from "./commands.js";
import { parsePort } from "./options.js";

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

export function assertDigitalOceanAccess(): void {
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

export function listDroplets(): DigitalOceanDroplet[] {
  return parseJson<DigitalOceanDroplet[]>(
    runCommand("doctl", ["compute", "droplet", "list", "--output", "json"], {
      capture: true,
      display: "doctl compute droplet list --output json",
    }),
    "DigitalOcean droplets",
  );
}

export function getSshKey(requested?: string): string {
  const keys = parseJson<DigitalOceanSshKey[]>(
    runCommand("doctl", ["compute", "ssh-key", "list", "--output", "json"], {
      capture: true,
      display: "doctl compute ssh-key list --output json",
    }),
    "DigitalOcean SSH keys",
  );

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

export function reconcileFirewall(options: {
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
