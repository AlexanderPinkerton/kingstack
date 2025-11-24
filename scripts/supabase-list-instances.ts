#!/usr/bin/env bun
/**
 * List all running Supabase instances across all projects
 * Helps identify which projects have Supabase running
 */

import { execSync } from "child_process";

function main() {
  try {
    // Get all Docker containers with supabase in the name
    const output = execSync(
      'docker ps --format "{{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -i supabase || true',
      {
        encoding: "utf-8",
        shell: "/bin/bash",
      }
    );

    if (!output.trim()) {
      console.log("ℹ️  No Supabase instances are currently running.");
      return;
    }

    console.log("🔍 Running Supabase instances:\n");
    console.log("Container Name\t\tStatus\t\tPorts");
    console.log("─".repeat(80));

    const lines = output.trim().split("\n");
    lines.forEach((line) => {
      const [name, status, ports] = line.split("\t");
      // Extract project_id from container name (format: supabase_<project_id>_<service>)
      const projectMatch = name.match(/supabase_([^_]+)_/);
      const projectId = projectMatch ? projectMatch[1] : "unknown";

      // Extract API port from ports string
      const apiPortMatch = ports.match(/:(\d+)->54321/);
      const apiPort = apiPortMatch ? apiPortMatch[1] : "54321";

      console.log(`${name.padEnd(30)} ${status.padEnd(20)} ${ports}`);
      console.log(`  └─ Project ID: ${projectId}, API Port: ${apiPort}`);
    });

    console.log("\n💡 To stop an instance, navigate to its project directory and run: supabase stop");
  } catch (error: any) {
    console.error("❌ Error listing Supabase instances:", error.message);
    process.exit(1);
  }
}

main();

