#!/usr/bin/env bun
/**
 * Check the status of the local Supabase instance
 * Shows running services, ports, and connection info
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const SUPABASE_DIR = join(process.cwd(), "supabase");
const CONFIG_FILE = join(SUPABASE_DIR, "config.toml");

function main() {
  // Check if Supabase is initialized
  if (!existsSync(CONFIG_FILE)) {
    console.error("❌ Supabase not initialized. Run 'supabase init' first.");
    process.exit(1);
  }

  try {
    // Run supabase status command
    const output = execSync("supabase status", {
      cwd: process.cwd(),
      encoding: "utf-8",
      stdio: "pipe",
    });

    console.log(output);
  } catch (error: any) {
    if (error.status === 1) {
      console.log("ℹ️  Supabase is not running.");
      console.log("   Start it with: yarn supabase:start");
    } else {
      console.error("❌ Error checking Supabase status:", error.message);
      process.exit(1);
    }
  }
}

main();

