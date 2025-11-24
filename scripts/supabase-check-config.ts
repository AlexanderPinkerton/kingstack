#!/usr/bin/env bun
/**
 * Verify Supabase configuration and provide helpful information
 * Checks config.toml exists, validates project_id, and shows current settings
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

const SUPABASE_DIR = join(process.cwd(), "supabase");
const CONFIG_FILE = join(SUPABASE_DIR, "config.toml");

interface ConfigInfo {
  projectId?: string;
  apiPort?: number;
  dbPort?: number;
  studioPort?: number;
  shadowPort?: number;
}

function parseConfig(): ConfigInfo {
  if (!existsSync(CONFIG_FILE)) {
    throw new Error("config.toml not found");
  }

  const content = readFileSync(CONFIG_FILE, "utf-8");
  const info: ConfigInfo = {};

  // Extract project_id
  const projectIdMatch = content.match(/project_id\s*=\s*"([^"]+)"/);
  if (projectIdMatch) {
    info.projectId = projectIdMatch[1];
  }

  // Extract ports - handle both with and without newlines
  const apiPortMatch = content.match(/\[api\][\s\S]*?port\s*=\s*(\d+)/);
  if (apiPortMatch) {
    info.apiPort = parseInt(apiPortMatch[1], 10);
  }

  const dbPortMatch = content.match(/\[db\][\s\S]*?port\s*=\s*(\d+)/);
  if (dbPortMatch) {
    info.dbPort = parseInt(dbPortMatch[1], 10);
  }

  const studioPortMatch = content.match(/\[studio\][\s\S]*?port\s*=\s*(\d+)/);
  if (studioPortMatch) {
    info.studioPort = parseInt(studioPortMatch[1], 10);
  }

  const shadowPortMatch = content.match(/shadow_port\s*=\s*(\d+)/);
  if (shadowPortMatch) {
    info.shadowPort = parseInt(shadowPortMatch[1], 10);
  }

  return info;
}

function main() {
  console.log("🔍 Checking Supabase configuration...\n");

  // Check if Supabase is initialized
  if (!existsSync(CONFIG_FILE)) {
    console.error("❌ Supabase not initialized.");
    console.log("\n💡 Run 'supabase init' to create the configuration.");
    process.exit(1);
  }

  try {
    const config = parseConfig();

    console.log("✅ Supabase configuration found\n");
    console.log("📋 Current Settings:");
    console.log("─".repeat(50));

    if (config.projectId) {
      console.log(`   Project ID:     ${config.projectId}`);
      console.log(
        `   └─ Used to identify this project's Docker containers`
      );
    } else {
      console.log("   Project ID:     ⚠️  Not set (will use directory name)");
    }

    if (config.apiPort) {
      console.log(`   API Port:       ${config.apiPort}`);
    }
    if (config.dbPort) {
      console.log(`   Database Port:  ${config.dbPort}`);
    }
    if (config.studioPort) {
      console.log(`   Studio Port:    ${config.studioPort}`);
    }
    if (config.shadowPort) {
      console.log(`   Shadow Port:    ${config.shadowPort}`);
    }

    console.log("\n💡 Tips:");
    console.log("   • The Supabase CLI automatically uses this config.toml");
    console.log("   • Each project should have a unique project_id");
    console.log("   • To run multiple projects, use different ports in each config.toml");
    console.log("   • Check status with: yarn supabase:status");
  } catch (error: any) {
    console.error("❌ Error reading configuration:", error.message);
    process.exit(1);
  }
}

main();

