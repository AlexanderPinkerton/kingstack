import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import {
  PORT_BLOCK_BASE_MAX,
  PORT_BLOCK_BASE_MIN,
  PORT_BLOCK_SIZE,
  type PortAssignments,
} from "./constants";
import {
  PORT_CONFIG_ENTRIES,
  findKingStackProjectRoot,
  readProjectPortConfig,
  standardPortBase,
  writeProjectPortConfig,
} from "./port-config";
import {
  allocateProjectPorts,
  getPortRegistryPath,
  isPortAvailable,
  listProjectPortAllocations,
  projectBlockPorts,
  releaseProjectPorts,
  replaceProjectPortAllocation,
  uniquePorts,
  type PortAllocationRecord,
  type PortProbe,
} from "./ports";

type PortCommand = "assign" | "list" | "register" | "release" | "status";

interface ParsedPortArgs {
  command?: PortCommand;
  help: boolean;
  preferredBase?: number;
}

export interface PortCliDependencies {
  cwd?: string;
  generateLocalEnvironment?: (projectRoot: string) => boolean;
  log?: (message: string) => void;
  now?: Date;
  probe?: PortProbe;
  registryPath?: string;
  warn?: (message: string) => void;
}

const PORT_LABELS: Record<keyof PortAssignments, string> = {
  next: "Next.js",
  nest: "NestJS",
  supabaseDbShadowPort: "Supabase shadow database",
  supabaseApiPort: "Supabase API",
  supabaseDbDirectPort: "Supabase database",
  supabaseDbPoolerPort: "Supabase pooler",
  supabaseStudioPort: "Supabase Studio",
  supabaseEmailPort: "Supabase email",
  supabaseAnalyticsPort: "Supabase analytics",
  supabaseEdgeRuntimeInspectorPort: "Edge Runtime inspector",
};

export function parsePortCliArgs(args: string[]): ParsedPortArgs {
  const parsed: ParsedPortArgs = { help: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--help" || argument === "-h") {
      parsed.help = true;
    } else if (argument === "--port-base") {
      const value = Number(args[index + 1]);
      if (
        !Number.isInteger(value) ||
        value < PORT_BLOCK_BASE_MIN ||
        value > PORT_BLOCK_BASE_MAX
      ) {
        throw new Error(
          `--port-base requires an integer between ${PORT_BLOCK_BASE_MIN} and ${PORT_BLOCK_BASE_MAX}.`,
        );
      }
      parsed.preferredBase = value;
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown ports option: ${argument}`);
    } else if (!parsed.command) {
      if (!isPortCommand(argument)) {
        throw new Error(`Unknown ports command: ${argument}`);
      }
      parsed.command = argument;
    } else {
      throw new Error(`Unexpected ports argument: ${argument}`);
    }
  }

  if (parsed.preferredBase !== undefined && parsed.command !== "assign") {
    throw new Error("--port-base can only be used with ports assign.");
  }
  return parsed;
}

function isPortCommand(value: string): value is PortCommand {
  return ["assign", "list", "register", "release", "status"].includes(value);
}

function printPortHelp(log: (message: string) => void): void {
  log(`
Manage this machine's KingStack project port reservations.

Usage:
  create-kingstack ports status
  create-kingstack ports list
  create-kingstack ports register
  create-kingstack ports assign [--port-base <port>]
  create-kingstack ports release

Commands:
  status    Compare this project's config, registry entry, and listening ports.
  list      List active project allocations in the machine-local registry.
  register  Register an existing standard ten-port configuration.
  assign    Allocate a fresh block and update this project's local config.
  release   Remove this project's registry entry without changing its config.

Run from an existing project with:
  yarn dlx @kingstack/create-kingstack ports status
`);
}

function defaultGenerateLocalEnvironment(projectRoot: string): boolean {
  const result = spawnSync("yarn", ["env:local"], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (result.error) {
    throw new Error(`Could not run yarn env:local: ${result.error.message}`, {
      cause: result.error,
    });
  }
  return result.status === 0;
}

function samePorts(left: PortAssignments, right: PortAssignments): boolean {
  return PORT_CONFIG_ENTRIES.every(
    ([, assignmentKey]) => left[assignmentKey] === right[assignmentKey],
  );
}

function findProjectAllocation(
  allocations: PortAllocationRecord[],
  projectRoot: string,
): PortAllocationRecord | undefined {
  const resolvedRoot = resolve(projectRoot);
  return allocations.find(
    (allocation) => resolve(allocation.projectPath) === resolvedRoot,
  );
}

function findRegistryConflicts(
  allocations: PortAllocationRecord[],
  projectRoot: string,
  ports: PortAssignments,
): PortAllocationRecord[] {
  const configuredPorts = new Set(uniquePorts(ports));
  const resolvedRoot = resolve(projectRoot);
  return allocations.filter(
    (allocation) =>
      resolve(allocation.projectPath) !== resolvedRoot &&
      projectBlockPorts(allocation.basePort).some((port) =>
        configuredPorts.has(port),
      ),
  );
}

async function busyPorts(
  ports: PortAssignments,
  probe: PortProbe,
): Promise<number[]> {
  const results = await Promise.all(
    uniquePorts(ports).map(async (port) => ((await probe(port)) ? null : port)),
  );
  return results.filter((port): port is number => port !== null);
}

function printPorts(
  ports: PortAssignments,
  log: (message: string) => void,
): void {
  for (const [, assignmentKey] of PORT_CONFIG_ENTRIES) {
    if (
      assignmentKey === "supabaseDbPoolerPort" &&
      ports.supabaseDbPoolerPort === ports.supabaseDbDirectPort
    ) {
      continue;
    }
    log(`  ${PORT_LABELS[assignmentKey]}: ${ports[assignmentKey]}`);
  }
}

async function showStatus(
  dependencies: Required<
    Pick<PortCliDependencies, "cwd" | "log" | "now" | "probe" | "registryPath">
  >,
): Promise<number> {
  const projectRoot = findKingStackProjectRoot(dependencies.cwd);
  const config = readProjectPortConfig(projectRoot);
  const allocations = listProjectPortAllocations(dependencies);
  const registered = findProjectAllocation(allocations, projectRoot);
  const conflicts = findRegistryConflicts(
    allocations,
    projectRoot,
    config.ports,
  );
  const basePort = standardPortBase(config.ports);
  const listening = await busyPorts(config.ports, dependencies.probe);
  const registryMatches =
    registered !== undefined &&
    basePort !== undefined &&
    registered.basePort === basePort &&
    samePorts(registered.ports, config.ports);

  dependencies.log(`Project: ${config.projectName}`);
  dependencies.log(`Path: ${projectRoot}`);
  dependencies.log(
    `Config layout: ${basePort === undefined ? "legacy or customized" : `standard block ${basePort}-${basePort + PORT_BLOCK_SIZE - 1}`}`,
  );
  dependencies.log(
    `Registry: ${registered ? `block ${registered.basePort}-${registered.basePort + PORT_BLOCK_SIZE - 1}` : "not registered"}`,
  );
  dependencies.log("Configured ports:");
  printPorts(config.ports, dependencies.log);
  dependencies.log(
    `Listening now: ${listening.length > 0 ? listening.join(", ") : "none"}`,
  );

  if (conflicts.length > 0) {
    dependencies.log("Registry conflicts:");
    for (const conflict of conflicts) {
      dependencies.log(
        `  ${conflict.projectName}: ${conflict.basePort}-${conflict.basePort + PORT_BLOCK_SIZE - 1} (${conflict.projectPath})`,
      );
    }
  } else {
    dependencies.log("Registry conflicts: none");
  }

  if (registryMatches && conflicts.length === 0) {
    dependencies.log("Status: configuration and registry agree.");
    return 0;
  }

  dependencies.log(
    basePort === undefined
      ? "Recommendation: run ports assign to move this project to a standard block."
      : registered
        ? "Recommendation: run ports assign to reconcile this project with the registry."
        : "Recommendation: run ports register to claim the configured block, or ports assign for a fresh block.",
  );
  return 1;
}

function listAllocations(
  dependencies: Required<
    Pick<PortCliDependencies, "log" | "now" | "registryPath">
  >,
): void {
  const allocations = listProjectPortAllocations(dependencies).sort(
    (left, right) => left.basePort - right.basePort,
  );

  dependencies.log(`Registry: ${dependencies.registryPath}`);
  if (allocations.length === 0) {
    dependencies.log("No active KingStack port allocations.");
    return;
  }

  for (const allocation of allocations) {
    dependencies.log(
      `${allocation.basePort}-${allocation.basePort + PORT_BLOCK_SIZE - 1}  ${allocation.projectName}  ${allocation.projectPath}${existsSync(allocation.projectPath) ? "" : " (project directory missing)"}`,
    );
  }
}

async function registerProject(
  dependencies: Required<
    Pick<PortCliDependencies, "cwd" | "log" | "now" | "probe" | "registryPath">
  >,
): Promise<void> {
  const projectRoot = findKingStackProjectRoot(dependencies.cwd);
  const config = readProjectPortConfig(projectRoot);
  const basePort = standardPortBase(config.ports);
  if (basePort === undefined) {
    throw new Error(
      "This project does not use the standard contiguous KingStack port layout. Run ports assign instead.",
    );
  }

  const registered = findProjectAllocation(
    listProjectPortAllocations(dependencies),
    projectRoot,
  );
  if (
    registered?.basePort === basePort &&
    samePorts(registered.ports, config.ports)
  ) {
    dependencies.log(
      `Already registered: ${basePort}-${basePort + PORT_BLOCK_SIZE - 1}`,
    );
    return;
  }

  await allocateProjectPorts({
    projectName: config.projectName,
    targetDir: projectRoot,
    preferredBase: basePort,
    registryPath: dependencies.registryPath,
    probe: dependencies.probe,
    now: dependencies.now,
  });
  dependencies.log(
    `Registered ${config.projectName}: ${basePort}-${basePort + PORT_BLOCK_SIZE - 1}`,
  );
}

async function assignProject(
  preferredBase: number | undefined,
  dependencies: Required<
    Pick<
      PortCliDependencies,
      | "cwd"
      | "generateLocalEnvironment"
      | "log"
      | "now"
      | "probe"
      | "registryPath"
      | "warn"
    >
  >,
): Promise<void> {
  const projectRoot = findKingStackProjectRoot(dependencies.cwd);
  const config = readProjectPortConfig(projectRoot);
  const previousAllocation = findProjectAllocation(
    listProjectPortAllocations(dependencies),
    projectRoot,
  );
  const listening = await busyPorts(config.ports, dependencies.probe);
  if (listening.length > 0) {
    dependencies.warn(
      `Configured ports currently listening: ${listening.join(", ")}. Running processes keep their old ports until restarted.`,
    );
  }

  const currentBase = standardPortBase(config.ports);
  const currentBlock = new Set(
    preferredBase === undefined && currentBase !== undefined
      ? projectBlockPorts(currentBase)
      : [],
  );
  const allocationProbe: PortProbe = (port) =>
    currentBlock.has(port) ? Promise.resolve(false) : dependencies.probe(port);

  const allocation = await allocateProjectPorts({
    projectName: config.projectName,
    targetDir: projectRoot,
    preferredBase,
    registryPath: dependencies.registryPath,
    probe: allocationProbe,
    now: dependencies.now,
  });

  try {
    writeProjectPortConfig(config, allocation.ports);
  } catch (error) {
    try {
      await replaceProjectPortAllocation(
        projectRoot,
        previousAllocation,
        dependencies,
      );
    } catch (rollbackError) {
      const writeMessage =
        error instanceof Error ? error.message : String(error);
      const rollbackMessage =
        rollbackError instanceof Error
          ? rollbackError.message
          : String(rollbackError);
      throw new Error(
        `Could not update config/local.ts (${writeMessage}), and registry rollback also failed: ${rollbackMessage}`,
        { cause: rollbackError },
      );
    }
    throw error;
  }

  dependencies.log(
    `Assigned ${config.projectName}: ${allocation.basePort}-${allocation.basePort + PORT_BLOCK_SIZE - 1}`,
  );
  dependencies.log("Updated config/local.ts.");
  if (!dependencies.generateLocalEnvironment(projectRoot)) {
    throw new Error(
      "Port assignment is saved, but yarn env:local failed. Fix the reported configuration error and rerun yarn env:local.",
    );
  }
  dependencies.log("Generated local environment and Supabase configuration.");
}

async function releaseProject(
  dependencies: Required<
    Pick<PortCliDependencies, "cwd" | "log" | "now" | "registryPath">
  >,
): Promise<void> {
  const projectRoot = findKingStackProjectRoot(dependencies.cwd);
  const released = await releaseProjectPorts(projectRoot, dependencies);
  dependencies.log(
    released
      ? `Released the port allocation for ${projectRoot}. Configuration was not changed.`
      : `No port allocation is registered for ${projectRoot}.`,
  );
}

export async function runPortCli(
  args: string[],
  overrides: PortCliDependencies = {},
): Promise<number> {
  const parsed = parsePortCliArgs(args);
  const dependencies = {
    cwd: overrides.cwd ?? process.cwd(),
    generateLocalEnvironment:
      overrides.generateLocalEnvironment ?? defaultGenerateLocalEnvironment,
    log: overrides.log ?? console.log,
    now: overrides.now ?? new Date(),
    probe: overrides.probe ?? isPortAvailable,
    registryPath: resolve(overrides.registryPath ?? getPortRegistryPath()),
    warn: overrides.warn ?? console.warn,
  };

  if (parsed.help || !parsed.command) {
    printPortHelp(dependencies.log);
    return 0;
  }

  switch (parsed.command) {
    case "status":
      return showStatus(dependencies);
    case "list":
      listAllocations(dependencies);
      return 0;
    case "register":
      await registerProject(dependencies);
      return 0;
    case "assign":
      await assignProject(parsed.preferredBase, dependencies);
      return 0;
    case "release":
      await releaseProject(dependencies);
      return 0;
  }
}
