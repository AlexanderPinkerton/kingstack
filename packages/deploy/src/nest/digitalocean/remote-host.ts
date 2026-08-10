import { remoteRun, type RemoteTarget } from "./commands.js";
import {
  renderBootstrapScript,
  renderCaddyApplyScript,
  renderCaddyFragment,
  renderCaddyInstallScript,
  renderCaddyRollbackScript,
  renderRemoteRollbackScript,
  shellQuote,
} from "./host-scripts.js";

export function bootstrapHost(target: RemoteTarget, appSlug: string): void {
  remoteRun(target, renderBootstrapScript(appSlug), {
    label: "install Docker and Caddy",
  });
}

export function verifyRemoteHost(target: RemoteTarget): void {
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

export function ensureCaddy(target: RemoteTarget): void {
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

export function applyCaddy(
  target: RemoteTarget,
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

export function rollbackTarget(
  target: RemoteTarget,
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
