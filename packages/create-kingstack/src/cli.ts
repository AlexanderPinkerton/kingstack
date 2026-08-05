// ============================================================================
// CLI argument parsing and prompts for create-kingstack
// ============================================================================

import prompts from "prompts";
import { resolve } from "path";
import {
  AUTO_PORT_BASE_MIN,
  PORT_BLOCK_BASE_MAX,
  PORT_BLOCK_BASE_MIN,
} from "./constants";
import { validateProjectName } from "./validators";
import { info } from "./utils";
import type { SetupKind } from "./setup";

// ============================================================================
// Types
// ============================================================================

export interface ParsedArgs {
  projectName?: string;
  baseDir: string;
  targetDir?: string;
  help: boolean;
  setup?: SetupKind;
  templateDir?: string;
  portBase?: number;
  noStart: boolean;
  yes: boolean;
}

export interface ProjectConfig {
  projectName: string;
  requestedPortBase?: number;
  targetDir: string;
  setup: SetupKind;
}

// ============================================================================
// Argument Parsing
// ============================================================================

export function parseArgs(rawArgs = process.argv.slice(2)): ParsedArgs {
  const result: ParsedArgs = {
    projectName: undefined,
    baseDir: process.cwd(),
    targetDir: undefined,
    help: false,
    setup: undefined,
    templateDir: undefined,
    portBase: undefined,
    noStart: false,
    yes: false,
  };

  const positionalArgs: string[] = [];

  let i = 0;
  while (i < rawArgs.length) {
    const arg = rawArgs[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
      i++;
    } else if (arg === "--draft") {
      if (result.setup === "full") {
        throw new Error("--draft and --full cannot be used together");
      }
      result.setup = "draft";
      i++;
    } else if (arg === "--full") {
      if (result.setup === "draft") {
        throw new Error("--draft and --full cannot be used together");
      }
      result.setup = "full";
      i++;
    } else if (arg === "--template-dir") {
      const nextArg = rawArgs[i + 1];
      if (!nextArg || nextArg.startsWith("-")) {
        throw new Error("--template-dir requires a path argument");
      }
      result.templateDir = resolve(nextArg);
      i += 2;
    } else if (arg === "--port-base") {
      const nextArg = rawArgs[i + 1];
      const portBase = Number(nextArg);
      if (
        !nextArg ||
        !Number.isInteger(portBase) ||
        portBase < PORT_BLOCK_BASE_MIN ||
        portBase > PORT_BLOCK_BASE_MAX
      ) {
        throw new Error(
          `--port-base requires an integer between ${PORT_BLOCK_BASE_MIN} and ${PORT_BLOCK_BASE_MAX}`,
        );
      }
      result.portBase = portBase;
      i += 2;
    } else if (arg === "--no-start") {
      result.noStart = true;
      i++;
    } else if (arg === "--yes" || arg === "-y") {
      result.yes = true;
      i++;
    } else if (arg === "--dir" || arg === "-d") {
      const nextArg = rawArgs[i + 1];
      if (!nextArg || nextArg.startsWith("-")) {
        console.error(`Error: ${arg} requires a path argument`);
        process.exit(1);
      }
      const expandedPath = nextArg.startsWith("~")
        ? nextArg.replace("~", process.env.HOME || "")
        : nextArg;
      result.baseDir = resolve(expandedPath);
      i += 2;
    } else if (arg === "--target-dir") {
      const nextArg = rawArgs[i + 1];
      if (!nextArg || nextArg.startsWith("-")) {
        throw new Error("--target-dir requires a path argument");
      }
      const expandedPath = nextArg.startsWith("~")
        ? nextArg.replace("~", process.env.HOME || "")
        : nextArg;
      result.targetDir = resolve(expandedPath);
      i += 2;
    } else if (arg.startsWith("-")) {
      console.warn(`Warning: Unknown flag ${arg}`);
      i++;
    } else {
      positionalArgs.push(arg);
      i++;
    }
  }

  if (positionalArgs.length > 0) {
    result.projectName = positionalArgs[0];
  }

  return result;
}

// ============================================================================
// Help
// ============================================================================

import pc from "picocolors";

export function printHelp(): void {
  console.log(`
  ${pc.yellow("👑 create-kingstack")} - Create a new KingStack project

  ${pc.bold("Usage:")}
    npx create-kingstack [project-name] [options]
    create-kingstack ports <command>

  ${pc.bold("Options:")}
    -d, --dir <path>   Base directory for the new project (default: current directory)
    --target-dir <path>
                       Exact project directory (overrides --dir)
    --draft            Start Next.js only; skip Docker, Supabase, and migrations
    --full             Start the complete local stack and run database setup
    --port-base <port> Use a specific ten-port project block instead of auto-detection
    --template-dir <path>
                       Copy a local Git working tree instead of downloading main
    --no-start         Generate and configure the project without a dev server
    -y, --yes          Accept default setup and automatic port selection
    -h, --help         Show this help message

  ${pc.bold("Examples:")}
    npx create-kingstack my-app
    npx create-kingstack my-app --draft
    npx create-kingstack my-app --full
    npx create-kingstack my-app --port-base 17420
    npx create-kingstack my-app --draft --no-start --yes
    npx create-kingstack my-app --dir ~/Projects
    npx create-kingstack --dir ~/Projects
    yarn dlx @kingstack/create-kingstack ports status
    bun src/index.ts test-app --dir ~/Desktop

  ${pc.bold("Interactive mode:")}
    npx create-kingstack
`);
}

// ============================================================================
// Interactive Prompts
// ============================================================================

export async function promptForConfig(
  args: ParsedArgs,
): Promise<ProjectConfig | null> {
  let projectName = args.projectName;

  const response = await prompts(
    [
      {
        type: projectName ? null : "text",
        name: "projectName",
        message: args.targetDir
          ? "Project name:"
          : "Project name (also used as directory name):",
        initial: "my-app",
        validate: validateProjectName,
      },
      {
        type: args.setup || args.yes ? null : "select",
        name: "setup",
        message: "How would you like to start?",
        choices: [
          {
            title: "Frontend draft (no backend services)",
            description:
              "Run Next.js with in-memory repositories; connect Supabase later",
            value: "draft",
          },
          {
            title: "Full stack",
            description:
              "Start Supabase, run migrations, and launch Next.js plus NestJS",
            value: "full",
          },
        ],
        initial: 0,
      },
      {
        type: args.yes || args.portBase !== undefined ? null : "confirm",
        name: "customPorts",
        message: "Choose a specific port block?",
        initial: false,
      },
      {
        type: (prev: boolean) => (prev ? "number" : null),
        name: "portBase",
        message: "Project port block base:",
        initial: AUTO_PORT_BASE_MIN,
        validate: (value: number) =>
          (Number.isInteger(value) &&
            value >= PORT_BLOCK_BASE_MIN &&
            value <= PORT_BLOCK_BASE_MAX) ||
          `Enter an integer between ${PORT_BLOCK_BASE_MIN} and ${PORT_BLOCK_BASE_MAX}`,
      },
    ],
    {
      onCancel: () => {
        console.log();
        info("Setup cancelled.");
        process.exit(0);
      },
    },
  );

  projectName = projectName || response.projectName;
  const setup = args.setup ?? response.setup ?? "draft";

  if (!projectName) {
    return null;
  }

  return {
    projectName,
    requestedPortBase:
      args.portBase ?? (response.customPorts ? response.portBase : undefined),
    targetDir: args.targetDir ?? resolve(args.baseDir, projectName),
    setup,
  };
}
