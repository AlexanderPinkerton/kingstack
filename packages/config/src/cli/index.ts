#!/usr/bin/env bun
import { Command } from "commander";
import { checkCommand } from "./check";
import { diffCommand } from "./diff";
import { initEnvironmentCommand, listEnvironmentsCommand } from "./environment";
import { generateCommand } from "./generate";
import { initSchemaCommand } from "./init";
import { syncCommand } from "./sync";

import { version } from "../../package.json";

const program = new Command();

program
  .name("king-config")
  .description("TypeScript configuration management CLI")
  .version(version);

program
  .command("init")
  .description("Create a standalone starter schema and example values")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action((options: { cwd: string }) => {
    if (!initSchemaCommand(options)) process.exitCode = 1;
  });

program
  .command("generate")
  .description("Generate .env files and update configs")
  .argument("<env>", "Declared environment to generate")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (env: string, options: { cwd: string }) => {
    if (!(await generateCommand(env, options))) process.exitCode = 1;
  });

program
  .command("check")
  .description("Validate environment values and every output mapping")
  .argument("[environment]", "Environment to check (defaults to all)")
  .option("--all", "Check all declared and discovered environments")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(
    async (
      environment: string | undefined,
      options: { all?: boolean; cwd: string },
    ) => {
      if (!(await checkCommand({ ...options, environment }))) {
        process.exitCode = 1;
      }
    },
  );

program
  .command("diff")
  .description("Compare generated files with resolved configuration")
  .argument("<environment>", "Environment to compare")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (environment: string, options: { cwd: string }) => {
    if (!(await diffCommand(environment, options))) process.exitCode = 1;
  });

const environmentProgram = program
  .command("env")
  .description("Inspect and initialize environments");

environmentProgram
  .command("list")
  .description("List declared environments and value-file status")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (options: { cwd: string }) => {
    if (!(await listEnvironmentsCommand(options))) process.exitCode = 1;
  });

environmentProgram
  .command("init")
  .description("Create a values-file skeleton for a declared environment")
  .argument("<environment>", "Environment to initialize")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (environment: string, options: { cwd: string }) => {
    if (!(await initEnvironmentCommand(environment, options))) {
      process.exitCode = 1;
    }
  });

program
  .command("sync")
  .description("Sync secrets to external services")
  .option("--env <env>", "Environment to sync")
  .option("--target <target>", "Target service (github, vercel)")
  .option("--dry-run", "Preview changes without applying")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(
    async (options: {
      cwd: string;
      env?: string;
      target?: string;
      dryRun?: boolean;
    }) => {
      if (!(await syncCommand(options))) process.exitCode = 1;
    },
  );

program.parseAsync().catch((error: unknown) => {
  console.error("Configuration command failed:", error);
  process.exitCode = 1;
});
