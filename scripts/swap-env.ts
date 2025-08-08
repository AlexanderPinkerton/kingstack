// swap-env.ts
// Usage:
//   bun swap-env.ts [development|production]   # Swap to environment
//   bun swap-env.ts --current                  # Detect currently active environment
// Copies the specified secrets/[env]/.env.* files to their destinations, backs up previous, and prints the currently active environment with --current.

import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "fs";
import { dirname, join } from "path";

const ENVIRONMENTS = ["development", "production"];
const FILE_MAP = [
  {
    src: ".env.frontend",
    dest: "apps/frontend/.env"
  },
  {
    src: ".env.backend",
    dest: "apps/backend/.env"
  },
  {
    src: ".env.prisma",
    dest: "packages/prisma/.env"
  }
];

async function main() {
  const envArg = process.argv[2];

  if (!envArg) {
    printUsageAndExit();
  }

  if (envArg === "--current" || envArg === "status") {
    detectCurrentEnv();
    return;
  }

  if (!ENVIRONMENTS.includes(envArg)) {
    console.error(`Unknown environment: ${envArg}`);
    printUsageAndExit();
  }

  const envDir = join("secrets", envArg);
  for (const { src, dest } of FILE_MAP) {
    const srcPath = join(envDir, src);
    if (!existsSync(srcPath)) {
      console.error(`Error: ${srcPath} does not exist.`);
      process.exit(1);
    }
    const destDir = dirname(dest);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    if (existsSync(dest)) {
      renameSync(dest, dest + ".previous");
      console.log(`Backed up previous ${dest} to ${dest}.previous`);
    }
    writeFileSync(dest, readFileSync(srcPath));
    console.log(`Swapped to ${srcPath} as ${dest}`);
  }
}

function printUsageAndExit() {
  console.error("Usage:\n  bun swap-env.ts [development|production]\n  bun swap-env.ts --current");
  process.exit(1);
}

function detectCurrentEnv() {
  let found = false;
  for (const env of ENVIRONMENTS) {
    const envDir = join("secrets", env);
    let allMatch = true;
    for (const { src, dest } of FILE_MAP) {
      const srcPath = join(envDir, src);
      if (!existsSync(srcPath) || !existsSync(dest)) {
        allMatch = false;
        break;
      }
      const srcContent = readFileSync(srcPath, "utf8");
      const destContent = readFileSync(dest, "utf8");
      if (srcContent !== destContent) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) {
      console.log(`Current environment: ${env}`);
      found = true;
      break;
    }
  }
  if (!found) {
    console.log("Current environment: unknown (no match for all .env files)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});