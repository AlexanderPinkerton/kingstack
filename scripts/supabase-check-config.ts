#!/usr/bin/env bun
/**
 * Verify Supabase configuration and provide helpful information
 * Checks config.toml exists, validates project_id, and shows current settings
 */

import * as TOML from "@iarna/toml";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const SUPABASE_DIR = join(process.cwd(), "supabase");
const CONFIG_FILE = join(SUPABASE_DIR, "config.toml");

export interface ConfigInfo {
  projectId?: string;
  apiPort?: number;
  dbPort?: number;
  studioPort?: number;
  shadowPort?: number;
}

function numberAt(
  config: Record<string, unknown>,
  sectionName: string,
  key: string,
): number | undefined {
  const section = config[sectionName];
  if (typeof section !== "object" || section === null) return undefined;

  const value = (section as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : undefined;
}

export function parseSupabaseConfig(content: string): ConfigInfo {
  const config = TOML.parse(content) as Record<string, unknown>;
  const projectId = config.project_id;

  return {
    projectId: typeof projectId === "string" ? projectId : undefined,
    apiPort: numberAt(config, "api", "port"),
    dbPort: numberAt(config, "db", "port"),
    studioPort: numberAt(config, "studio", "port"),
    shadowPort: numberAt(config, "db", "shadow_port"),
  };
}

function readConfig(): ConfigInfo {
  if (!existsSync(CONFIG_FILE)) {
    throw new Error("config.toml not found");
  }

  return parseSupabaseConfig(readFileSync(CONFIG_FILE, "utf-8"));
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
    const config = readConfig();

    console.log("✅ Supabase configuration found\n");
    console.log("📋 Current Settings:");
    console.log("─".repeat(50));

    if (config.projectId) {
      console.log(`   Project ID:     ${config.projectId}`);
      console.log(`   └─ Used to identify this project's Docker containers`);
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
    console.log(
      "   • To run multiple projects, use different ports in each config.toml",
    );
    console.log("   • Check status with: yarn supabase:status");
  } catch (error: any) {
    console.error("❌ Error reading configuration:", error.message);
    process.exit(1);
  }
}

if (import.meta.main) main();
