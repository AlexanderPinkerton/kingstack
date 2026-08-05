#!/usr/bin/env bun

import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { clearFrontendDraft } from "./project-mode.js";

interface CommandResult {
  status: number;
  output: string;
}

function printHelp(): void {
  console.log(`
Enable the complete local KingStack backend for a draft project.

Usage:
  yarn backend:enable

This command refreshes local environment files, starts or reuses the project's
Supabase instance, prepares Prisma's shadow database, and applies migrations.
It does not start the persistent development servers.
`);
}

function requireProjectRoot(): void {
  const requiredPaths = [
    "package.json",
    "config/local.ts",
    "supabase/config.toml",
    "packages/prisma/schema.prisma",
  ];
  const missing = requiredPaths.filter(
    (relativePath) => !existsSync(join(process.cwd(), relativePath)),
  );

  if (missing.length > 0) {
    throw new Error(
      `Run this command from a generated KingStack project root. Missing: ${missing.join(", ")}`,
    );
  }
}

function inspect(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf-8",
    stdio: "pipe",
  });

  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`, {
      cause: result.error,
    });
  }

  return {
    status: result.status ?? 1,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
  };
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}.`,
    );
  }
}

function assertDockerRunning(): void {
  const docker = inspect("docker", ["info"]);
  if (docker.status !== 0) {
    throw new Error(
      "Docker is not running. Start Docker Desktop (or your Docker daemon), wait for it to become ready, and rerun yarn backend:enable.",
    );
  }
}

function supabaseIsRunning(): boolean {
  const status = inspect("yarn", ["supabase:status"]);

  if (status.status === 0) {
    return true;
  }

  if (
    /local development setup is not running|supabase is not running/i.test(
      status.output,
    )
  ) {
    return false;
  }

  throw new Error(
    `Could not determine the local Supabase status.\n\n${status.output}`,
  );
}

function readEnvValue(path: string, key: string): string | undefined {
  if (!existsSync(path)) return undefined;

  const prefix = `${key}=`;
  const line = readFileSync(path, "utf-8")
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(prefix));

  return line?.slice(prefix.length).replace(/^['"]|['"]$/g, "");
}

function step(number: number, total: number, label: string): void {
  console.log();
  console.log(`[${number}/${total}] ${label}`);
}

function printSuccess(): void {
  const nextEnv = join(process.cwd(), "apps", "next", ".env");
  const nestEnv = join(process.cwd(), "apps", "nest", ".env");
  const nextPort = readEnvValue(nextEnv, "PORT");
  const nestUrl = readEnvValue(nextEnv, "NEXT_PUBLIC_NEST_BACKEND_URL");
  const supabaseUrl = readEnvValue(nextEnv, "NEXT_PUBLIC_SUPABASE_URL");
  const nestPort = readEnvValue(nestEnv, "PORT");
  const appUrl = nextPort ? `http://localhost:${nextPort}/app` : "/app";

  console.log();
  console.log("✓ KingStack backend is enabled.");
  console.log();
  console.log("Next:");
  console.log("  1. Stop yarn dev:frontend if it is still running.");
  console.log("  2. Run yarn dev");
  console.log(`  3. Open ${appUrl}`);
  console.log();
  console.log("Configured services:");
  if (supabaseUrl) console.log(`  Supabase: ${supabaseUrl}`);
  if (nestUrl) {
    console.log(`  NestJS:    ${nestUrl}`);
  } else if (nestPort) {
    console.log(`  NestJS:    http://localhost:${nestPort}`);
  }
  console.log();
  console.log("Draft routes remain available with their in-memory data.");
  console.log("Stop the local backend later with: yarn supabase:stop");
}

function markBackendEnabled(): void {
  if (clearFrontendDraft()) {
    console.log("✓ Frontend-draft CI marker removed; commit this change");
  }
}

function main(): void {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  requireProjectRoot();

  console.log();
  console.log("👑 Enabling the KingStack local backend");

  const totalSteps = 5;

  step(1, totalSteps, "Checking Docker...");
  assertDockerRunning();
  console.log("✓ Docker is ready");

  step(2, totalSteps, "Refreshing local configuration...");
  run("yarn", ["env:local"]);
  console.log("✓ Environment and Supabase configuration refreshed");

  step(3, totalSteps, "Preparing Supabase...");
  if (supabaseIsRunning()) {
    console.log("✓ This project's Supabase instance is already running");
  } else {
    run("yarn", ["supabase:start"]);
    console.log("✓ Supabase started");
  }

  step(4, totalSteps, "Preparing the Prisma shadow database...");
  run("bun", ["scripts/setup-shadow-db.ts"]);
  console.log("✓ Shadow database is ready");

  step(5, totalSteps, "Applying database migrations...");
  run("yarn", ["prisma:migrate"]);
  console.log("✓ Database migrations are applied");

  markBackendEnabled();

  printSuccess();
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error();
  console.error(`✗ Backend enablement stopped: ${message}`);
  console.error();
  console.error("Fix the reported issue and rerun: yarn backend:enable");
  process.exitCode = 1;
}
