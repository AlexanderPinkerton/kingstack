#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

interface Options {
  projectName: string;
  setup?: "draft" | "full";
  noStart: boolean;
  outputRoot: string;
}

function printHelp(): void {
  console.log(`
Test create-kingstack against the current uncommitted working tree.

Usage:
  bun scripts/test-create-kingstack <project-name> [options]

Options:
  --draft                 Select frontend-draft setup without prompting
  --full                  Select complete setup without prompting
  --no-start              Verify the project without starting its dev server
  --output-dir <path>     Output root (default: ~/kingstack-smoke-tests)
  -h, --help              Show this help

Examples:
  bun scripts/test-create-kingstack interactive-check
  bun scripts/test-create-kingstack draft-check --draft --no-start
  bun scripts/test-create-kingstack full-check --full

Without --draft or --full, the real create-kingstack setup prompt is shown.
Every run typechecks and tests the generated project before starting its
selected development server.
`);
}

function parseArgs(args: string[]): Options | null {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return null;
  }

  let projectName: string | undefined;
  let setup: Options["setup"];
  let setupFlag: Options["setup"] | undefined;
  let noStart = false;
  let outputRoot = join(homedir(), "kingstack-smoke-tests");

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--draft") {
      if (setupFlag === "full") {
        throw new Error("--draft and --full cannot be used together.");
      }
      setup = "draft";
      setupFlag = "draft";
    } else if (arg === "--full") {
      if (setupFlag === "draft") {
        throw new Error("--draft and --full cannot be used together.");
      }
      setup = "full";
      setupFlag = "full";
    } else if (arg === "--no-start") {
      noStart = true;
    } else if (arg === "--output-dir") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--output-dir requires a path.");
      }
      outputRoot = resolve(value);
      index += 1;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (projectName) {
      throw new Error(`Unexpected argument: ${arg}`);
    } else {
      projectName = arg;
    }
  }

  if (!projectName || !/^[a-z][a-z0-9-]{1,49}$/.test(projectName)) {
    throw new Error(
      "A lowercase project name of 2-50 letters, numbers, or hyphens is required.",
    );
  }

  return {
    projectName,
    setup,
    noStart,
    outputRoot,
  };
}

function run(
  command: string,
  args: string[],
  cwd: string,
  options: { allowInterrupt?: boolean; env?: NodeJS.ProcessEnv } = {},
): void {
  const result = spawnSync(command, args, {
    cwd,
    env: options.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (options.allowInterrupt && result.signal === "SIGINT") {
    return;
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with status ${result.status}`,
    );
  }
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function readSelectedSetup(
  registryPath: string,
  projectDirectory: string,
): "draft" | "full" {
  const registry = JSON.parse(readFileSync(registryPath, "utf-8")) as {
    allocations?: Array<{
      projectPath?: string;
      setup?: "draft" | "full";
    }>;
  };
  const projectPath = resolve(projectDirectory);
  const allocation = registry.allocations?.find(
    (candidate) =>
      candidate.projectPath && resolve(candidate.projectPath) === projectPath,
  );

  if (allocation?.setup === "draft" || allocation?.setup === "full") {
    return allocation.setup;
  }

  throw new Error(
    `Could not determine the selected setup from ${registryPath}.`,
  );
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (!options) return;

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, "..");
  const cliEntry = join(
    repoRoot,
    "packages",
    "create-kingstack",
    "dist",
    "index.js",
  );
  const runDirectory = join(options.outputRoot, timestamp());
  const projectDirectory = join(runDirectory, options.projectName);
  const registryPath = join(options.outputRoot, "port-allocations.json");

  mkdirSync(runDirectory, { recursive: true });

  console.log();
  console.log("👑 Local create-kingstack smoke test");
  console.log(`   Template: ${repoRoot}`);
  console.log(`   Setup:    ${options.setup ?? "interactive"}`);
  console.log(`   Output:   ${projectDirectory}`);
  console.log();

  console.log("Building the local create-kingstack package...");
  run("yarn", ["workspace", "@kingstack/create-kingstack", "build"], repoRoot);

  if (!existsSync(cliEntry)) {
    throw new Error(`Compiled CLI was not found at ${cliEntry}`);
  }

  const cliArgs = [
    cliEntry,
    options.projectName,
    "--template-dir",
    repoRoot,
    "--dir",
    runDirectory,
  ];

  if (options.setup) {
    cliArgs.push(`--${options.setup}`, "--yes");
  }

  // Keep control in this wrapper so it can validate the generated project
  // before optionally handing the terminal to the development server.
  cliArgs.push("--no-start");

  run("node", cliArgs, repoRoot, {
    env: {
      ...process.env,
      KINGSTACK_PORT_REGISTRY: registryPath,
    },
  });

  if (!existsSync(projectDirectory)) {
    console.log();
    console.log("create-kingstack smoke test cancelled.");
    return;
  }

  const selectedSetup =
    options.setup ?? readSelectedSetup(registryPath, projectDirectory);

  console.log();
  console.log("Verifying the generated project...");
  run("yarn", ["typecheck"], projectDirectory);
  run("yarn", ["test"], projectDirectory);

  console.log();
  console.log("✓ create-kingstack smoke test passed");
  console.log(`  Project retained at ${projectDirectory}`);

  if (options.noStart) {
    return;
  }

  const devScript = selectedSetup === "draft" ? "dev:frontend" : "dev";
  console.log();
  console.log(`Starting the generated project with yarn ${devScript}...`);
  run("yarn", [devScript], projectDirectory, { allowInterrupt: true });
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n✗ create-kingstack smoke test failed: ${message}`);
  process.exitCode = 1;
}
