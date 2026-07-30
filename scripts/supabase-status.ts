#!/usr/bin/env bun
/**
 * Check the status of the local Supabase instance
 * Shows running services, ports, and connection info
 */

import { spawnSync } from "child_process";
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

  const result = spawnSync("supabase", ["status"], {
    cwd: process.cwd(),
    encoding: "utf-8",
    stdio: "pipe",
  });

  if (result.error) {
    console.error("❌ Could not run the Supabase CLI:", result.error.message);
    process.exit(1);
  }

  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();

  if (result.status === 0) {
    console.log(output);
    return;
  }

  const dockerAccessDenied =
    /permission denied.*docker|docker.*permission denied|operation not permitted/i.test(
      output,
    );

  if (dockerAccessDenied) {
    console.error("⚠️  Supabase status is unknown.");
    console.error(
      "   This process cannot access the Docker socket; that does not mean Supabase is stopped.",
    );
    console.error(
      "   Retry outside the sandbox or grant Docker access, then run: yarn supabase status",
    );
    console.error(`\n${output}`);
    process.exit(2);
  }

  const definitelyStopped =
    /local development setup is not running|supabase is not running|no such container:\s*supabase_db_/i.test(
      output,
    );

  if (definitelyStopped) {
    console.log("ℹ️  Supabase is not running.");
    console.log("   Start it with: yarn supabase:start");
    process.exit(1);
  }

  console.error(
    "❌ Supabase status check failed; its running state is unknown.",
  );
  console.error(output);
  process.exit(result.status ?? 1);
}

main();
