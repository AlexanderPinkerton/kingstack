// ============================================================================
// CLI argument parsing and prompts for create-kingstack
// ============================================================================

import prompts from "prompts";
import { resolve } from "path";
import { DEFAULT_PORTS } from "./constants";
import { validateProjectName } from "./validators";
import { info } from "./utils";

// ============================================================================
// Types
// ============================================================================

export interface ParsedArgs {
    projectName?: string;
    baseDir: string;
    help: boolean;
}

export interface ProjectConfig {
    projectName: string;
    mode: "playground" | "full";
    ports: typeof DEFAULT_PORTS;
    targetDir: string;
}

// ============================================================================
// Argument Parsing
// ============================================================================

export function parseArgs(): ParsedArgs {
    const rawArgs = process.argv.slice(2);
    const result: ParsedArgs = {
        projectName: undefined,
        baseDir: process.cwd(),
        help: false,
    };

    const positionalArgs: string[] = [];

    let i = 0;
    while (i < rawArgs.length) {
        const arg = rawArgs[i];

        if (arg === "--help" || arg === "-h") {
            result.help = true;
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
    -h, --help         Show this help message

  ${pc.bold("Examples:")}
    npx create-kingstack my-app
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

export async function promptForConfig(args: ParsedArgs): Promise<ProjectConfig | null> {
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
                type: "select",
                name: "mode",
                message: "Setup mode:",
                choices: [
                    {
                        title: "Playground (quick start, no database)",
                        description: "Perfect for UI development and prototyping",
                        value: "playground",
                    },
                    {
                        title: "Full setup (with Supabase)",
                        description: "Requires Docker - complete backend with auth & database",
                        value: "full",
                    },
                ],
                initial: 0,
            },
            {
                type: "confirm",
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
                type: (_prev: number, values: { customPorts: boolean }) =>
                    values.customPorts ? "number" : null,
                name: "nestPort",
                message: "NestJS port:",
                initial: DEFAULT_PORTS.nest,
            },
            {
                type: (_prev: number, values: { customPorts: boolean }) =>
                    values.customPorts ? "number" : null,
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
        }
    );

    projectName = projectName || response.projectName;
    const mode = response.mode as "playground" | "full";

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
        mode,
        ports,
        targetDir: resolve(args.baseDir, projectName),
    };
}
