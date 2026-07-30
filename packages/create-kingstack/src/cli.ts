// ============================================================================
// CLI argument parsing and prompts for create-kingstack
// ============================================================================

import prompts from "prompts";
import { resolve } from "path";
import { DEFAULT_PORTS } from "./constants";
import { validateProjectName } from "./validators";
import { info } from "./utils";
import type { SetupKind } from "./setup";

// ============================================================================
// Types
// ============================================================================

export interface ParsedArgs {
  projectName?: string;
  baseDir: string;
  help: boolean;
  setup?: SetupKind;
  templateDir?: string;
  noStart: boolean;
  yes: boolean;
}

export interface ProjectConfig {
  projectName: string;
  ports: typeof DEFAULT_PORTS;
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
    help: false,
    setup: undefined,
    templateDir: undefined,
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

  ${pc.bold("Options:")}
    -d, --dir <path>   Base directory for the new project (default: current directory)
    --draft            Start Next.js only; skip Docker, Supabase, and migrations
    --full             Start the complete local stack and run database setup
    --template-dir <path>
                       Copy a local Git working tree instead of downloading main
    --no-start         Generate and configure the project without a dev server
    -y, --yes          Accept default setup and port choices
    -h, --help         Show this help message

  ${pc.bold("Examples:")}
    npx create-kingstack my-app
    npx create-kingstack my-app --draft
    npx create-kingstack my-app --full
    npx create-kingstack my-app --draft --no-start --yes
    npx create-kingstack my-app --dir ~/Projects
    npx create-kingstack --dir ~/Projects
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
        message: "Project name (also used as directory name):",
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
        type: args.yes ? null : "confirm",
        name: "customPorts",
        message: "Customize ports?",
        initial: false,
      },
      {
        type: (prev: boolean) => (prev ? "number" : null),
        name: "nextPort",
        message: "Next.js port:",
        initial: DEFAULT_PORTS.next,
      },
      {
        type: (
          _prev: number,
          values: { customPorts: boolean; setup?: SetupKind },
        ) =>
          values.customPorts &&
          (args.setup ?? values.setup ?? "draft") === "full"
            ? "number"
            : null,
        name: "nestPort",
        message: "NestJS port:",
        initial: DEFAULT_PORTS.nest,
      },
      {
        type: (
          _prev: number,
          values: { customPorts: boolean; setup?: SetupKind },
        ) =>
          values.customPorts &&
          (args.setup ?? values.setup ?? "draft") === "full"
            ? "number"
            : null,
        name: "supabaseBasePort",
        message: "Supabase base port:",
        initial: DEFAULT_PORTS.supabaseApiPort,
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

  // Calculate ports
  const ports = { ...DEFAULT_PORTS };
  if (response.customPorts) {
    ports.next = response.nextPort || DEFAULT_PORTS.next;
    ports.nest = response.nestPort || DEFAULT_PORTS.nest;
    const basePort = response.supabaseBasePort || DEFAULT_PORTS.supabaseApiPort;
    ports.supabaseApiPort = basePort;
    ports.supabaseDbDirectPort = basePort + 1;
    ports.supabaseDbPoolerPort = basePort + 1;
    ports.supabaseStudioPort = basePort + 2;
    ports.supabaseAnalyticsPort = basePort + 3;
    ports.supabaseEmailPort = basePort + 4;
    ports.supabaseDbShadowPort = basePort - 1;
  }

  return {
    projectName,
    ports,
    targetDir: resolve(args.baseDir, projectName),
    setup,
  };
}
