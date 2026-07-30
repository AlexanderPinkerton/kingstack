// ============================================================================
// Smart project-level port allocation
// ============================================================================

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { createServer } from "net";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import {
  AUTO_PORT_BASE_MAX,
  AUTO_PORT_BASE_MIN,
  PORT_BLOCK_BASE_MAX,
  PORT_BLOCK_BASE_MIN,
  PORT_BLOCK_SIZE,
  type PortAssignments,
} from "./constants";

const REGISTRY_VERSION = 1;
const PENDING_ALLOCATION_RETENTION_MS = 60 * 60 * 1000;
const REGISTRY_LOCK_STALE_MS = 30 * 1000;
const REGISTRY_LOCK_RETRY_MS = 50;
const REGISTRY_LOCK_RETRIES = 100;

export type PortProbe = (port: number) => Promise<boolean>;

interface PortAllocationRecord {
  projectName: string;
  projectPath: string;
  assignedAt: string;
  basePort: number;
  ports: PortAssignments;
}

interface PortRegistry {
  version: typeof REGISTRY_VERSION;
  allocations: PortAllocationRecord[];
}

export interface AllocateProjectPortsOptions {
  projectName: string;
  targetDir: string;
  preferredBase?: number;
  registryPath?: string;
  probe?: PortProbe;
  now?: Date;
}

export interface ProjectPortAllocation {
  basePort: number;
  ports: PortAssignments;
  registryPath: string;
}

export function getPortRegistryPath(): string {
  return (
    process.env.KINGSTACK_PORT_REGISTRY ??
    join(homedir(), ".kingstack", "port-allocations.json")
  );
}

export function portsFromBase(basePort: number): PortAssignments {
  return {
    next: basePort,
    nest: basePort + 1,
    supabaseDbShadowPort: basePort + 2,
    supabaseApiPort: basePort + 3,
    supabaseDbDirectPort: basePort + 4,
    supabaseDbPoolerPort: basePort + 4,
    supabaseStudioPort: basePort + 5,
    supabaseEmailPort: basePort + 6,
    supabaseAnalyticsPort: basePort + 7,
    supabaseEdgeRuntimeInspectorPort: basePort + 8,
  };
}

export function uniquePorts(ports: PortAssignments): number[] {
  return [...new Set(Object.values(ports))].sort((a, b) => a - b);
}

export function projectBlockPorts(basePort: number): number[] {
  return Array.from(
    { length: PORT_BLOCK_SIZE },
    (_, offset) => basePort + offset,
  );
}

export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolveAvailable) => {
    const server = createServer();

    server.unref();
    server.once("error", () => resolveAvailable(false));
    server.listen({ port, exclusive: true }, () => {
      server.close(() => resolveAvailable(true));
    });
  });
}

function validateBasePort(basePort: number): void {
  if (
    !Number.isInteger(basePort) ||
    basePort < PORT_BLOCK_BASE_MIN ||
    basePort > PORT_BLOCK_BASE_MAX
  ) {
    throw new Error(
      `Port block base must be an integer between ${PORT_BLOCK_BASE_MIN} and ${PORT_BLOCK_BASE_MAX}.`,
    );
  }
}

function loadRegistry(registryPath: string): PortRegistry {
  if (!existsSync(registryPath)) {
    return { version: REGISTRY_VERSION, allocations: [] };
  }

  try {
    const registry = JSON.parse(
      readFileSync(registryPath, "utf-8"),
    ) as PortRegistry;

    if (
      registry.version !== REGISTRY_VERSION ||
      !Array.isArray(registry.allocations)
    ) {
      throw new Error("unsupported registry format");
    }

    return registry;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not read KingStack port registry at ${registryPath}: ${reason}`,
      { cause: error },
    );
  }
}

function saveRegistry(registryPath: string, registry: PortRegistry): void {
  mkdirSync(dirname(registryPath), { recursive: true });
  const temporaryPath = `${registryPath}.${process.pid}.tmp`;

  try {
    writeFileSync(temporaryPath, JSON.stringify(registry, null, 2) + "\n", {
      encoding: "utf-8",
      mode: 0o600,
    });
    renameSync(temporaryPath, registryPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

async function acquireRegistryLock(registryPath: string): Promise<() => void> {
  mkdirSync(dirname(registryPath), { recursive: true });
  const lockPath = `${registryPath}.lock`;

  for (let attempt = 0; attempt < REGISTRY_LOCK_RETRIES; attempt += 1) {
    try {
      mkdirSync(lockPath);
      return () => rmSync(lockPath, { recursive: true, force: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;

      try {
        const age = Date.now() - statSync(lockPath).mtimeMs;
        if (age > REGISTRY_LOCK_STALE_MS) {
          rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }

      await new Promise((resolveDelay) =>
        setTimeout(resolveDelay, REGISTRY_LOCK_RETRY_MS),
      );
    }
  }

  throw new Error(
    `Timed out waiting for KingStack port registry lock at ${lockPath}.`,
  );
}

function keepAllocation(allocation: PortAllocationRecord, now: Date): boolean {
  if (existsSync(allocation.projectPath)) {
    return true;
  }

  const assignedAt = Date.parse(allocation.assignedAt);
  return (
    Number.isFinite(assignedAt) &&
    now.getTime() - assignedAt < PENDING_ALLOCATION_RETENTION_MS
  );
}

async function unavailablePorts(
  candidates: number[],
  reservedPorts: Set<number>,
  probe: PortProbe,
): Promise<number[]> {
  const results = await Promise.all(
    candidates.map(async (port) => {
      if (reservedPorts.has(port)) return port;
      return (await probe(port)) ? null : port;
    }),
  );

  return results.filter((port): port is number => port !== null);
}

export async function allocateProjectPorts(
  options: AllocateProjectPortsOptions,
): Promise<ProjectPortAllocation> {
  const {
    projectName,
    preferredBase,
    probe = isPortAvailable,
    now = new Date(),
  } = options;
  const targetDir = resolve(options.targetDir);
  const registryPath = resolve(options.registryPath ?? getPortRegistryPath());
  const releaseRegistryLock = await acquireRegistryLock(registryPath);

  try {
    const registry = loadRegistry(registryPath);
    const allocations = registry.allocations.filter(
      (allocation) =>
        resolve(allocation.projectPath) !== targetDir &&
        keepAllocation(allocation, now),
    );
    const reservedPorts = new Set(
      allocations.flatMap((allocation) =>
        projectBlockPorts(allocation.basePort),
      ),
    );

    const bases =
      preferredBase === undefined
        ? Array.from(
            {
              length:
                Math.floor(
                  (AUTO_PORT_BASE_MAX - AUTO_PORT_BASE_MIN) / PORT_BLOCK_SIZE,
                ) + 1,
            },
            (_, index) => AUTO_PORT_BASE_MIN + index * PORT_BLOCK_SIZE,
          )
        : [preferredBase];

    for (const basePort of bases) {
      validateBasePort(basePort);
      const ports = portsFromBase(basePort);
      const unavailable = await unavailablePorts(
        projectBlockPorts(basePort),
        reservedPorts,
        probe,
      );

      if (unavailable.length > 0) {
        if (preferredBase !== undefined) {
          throw new Error(
            `Requested port block ${basePort}-${basePort + PORT_BLOCK_SIZE - 1} is unavailable. Busy or reserved ports: ${unavailable.join(", ")}.`,
          );
        }
        continue;
      }

      allocations.push({
        projectName,
        projectPath: targetDir,
        assignedAt: now.toISOString(),
        basePort,
        ports,
      });
      saveRegistry(registryPath, {
        version: REGISTRY_VERSION,
        allocations,
      });

      return {
        basePort,
        ports,
        registryPath,
      };
    }

    throw new Error(
      `No complete KingStack port block is available between ${AUTO_PORT_BASE_MIN} and ${AUTO_PORT_BASE_MAX + PORT_BLOCK_SIZE - 1}.`,
    );
  } finally {
    releaseRegistryLock();
  }
}
