import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { shellQuote } from "./host-scripts.js";

interface RunOptions {
  capture?: boolean;
  cwd?: string;
  display?: string;
  env?: NodeJS.ProcessEnv;
  quiet?: boolean;
}

export interface RemoteTarget {
  name: string;
  ip: string;
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

export function log(message = ""): void {
  console.log(message);
}

export function step(number: number, total: number, message: string): void {
  log();
  log(`[${number}/${total}] ${message}`);
}

export function runCommand(
  command: string,
  args: string[],
  options: RunOptions = {},
): string {
  if (!options.quiet) {
    log(`> ${options.display || [command, ...args].join(" ")}`);
  }
  const result = spawnSync(command, args, {
    cwd: options.cwd,
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

export function parseJson<T>(value: string, description: string): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(`Could not parse ${description} JSON.`, { cause: error });
  }
}

export function assertTool(
  command: string,
  args: string[],
  cwd?: string,
): void {
  try {
    runCommand(command, args, { capture: true, cwd, quiet: true });
  } catch {
    throw new Error(`Required tool is unavailable: ${command}`);
  }
}

export function assertExecutable(
  command: string,
  args: string[] = [],
  cwd?: string,
): void {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
    stdio: "ignore",
  });
  if (result.error) {
    throw new Error(`Required tool is unavailable: ${command}`, {
      cause: result.error,
    });
  }
}

function sshArgs(ip: string, remoteCommand: string): string[] {
  return [...SSH_OPTIONS, `root@${ip}`, remoteCommand];
}

export function remoteRun(
  target: RemoteTarget,
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

export function copyToTarget(
  localPath: string,
  target: RemoteTarget,
  remotePath: string,
): void {
  runCommand(
    "scp",
    [...SSH_OPTIONS, localPath, `root@${target.ip}:${remotePath}`],
    { display: `scp <temporary env> root@${target.ip}:${remotePath}` },
  );
}

export function uploadImage(target: RemoteTarget, image: string): void {
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

export async function confirmOrThrow(
  message: string,
  yes: boolean,
): Promise<void> {
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

export async function waitForSsh(target: RemoteTarget): Promise<void> {
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
