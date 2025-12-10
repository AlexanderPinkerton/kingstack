#!/usr/bin/env bun
import { Command } from "commander";
import { generateCommand } from "./generate";
import { syncCommand } from "./sync";

import { version } from "../../package.json";

const program = new Command();

program
    .name("king-config")
    .description("Configuration management CLI for KingStack")
    .version(version);

program.command("generate")
    .description("Generate .env files and update configs")
    .argument("<env>", "Environment to generate (local, development, production, playground)")
    .option("--cwd <path>", "Working directory", process.cwd())
    .action((env: string, options: { cwd: string }) => {
        generateCommand(env, options);
    });

program.command("sync")
    .description("Sync secrets to external services")
    .option("--env <env>", "Environment to sync")
    .option("--target <target>", "Target service (github, vercel)")
    .option("--dry-run", "Preview changes without applying")
    .option("--cwd <path>", "Working directory", process.cwd())
    .action((options: { cwd: string; env?: string; target?: string; dryRun?: boolean }) => {
        syncCommand(options);
    });

program.parse();
