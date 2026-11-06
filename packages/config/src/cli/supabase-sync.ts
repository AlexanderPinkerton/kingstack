import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  authManagementRequest,
  supabaseManagementToken,
} from "./supabase-management";
import type { SupabaseAuthPatch } from "../supabase-auth";

export async function syncToSupabaseAuth(options: {
  project: string;
  settings: SupabaseAuthPatch;
  environment: string;
  cwd: string;
  dryRun: boolean;
}): Promise<boolean> {
  const { project, settings, environment, cwd, dryRun } = options;
  console.log(`\nSupabase Auth project: ${project}`);
  console.log(
    "   Uses the Supabase Management API; email templates are published separately.",
  );
  console.log(
    `   Managed settings: ${Object.keys(settings).join(", ")} (values redacted)`,
  );
  for (const [field, value] of Object.entries(settings)) {
    if (typeof value === "boolean" || typeof value === "number")
      console.log(`   ${field}: ${value}`);
  }
  if (dryRun) {
    console.log(
      "   Would read current settings, save a private rollback snapshot, apply changes, and verify. No network requests made.",
    );
    return true;
  }
  try {
    const token = supabaseManagementToken();
    const current = await authManagementRequest(project, token);
    if (
      current.hook_send_email_enabled === true &&
      Object.keys(settings).some((key) => key.startsWith("smtp_"))
    )
      throw new Error(
        "A Send Email hook is enabled; review it before configuring SMTP.",
      );
    const patch: SupabaseAuthPatch = {};
    for (const [key, value] of Object.entries(settings)) {
      // The API can conceal the current SMTP password. Reapply the configured
      // secret; never infer its removal or expose it in diagnostics.
      if (key === "smtp_pass" || current[key] !== value) patch[key] = value;
    }
    if (Object.keys(patch).length === 0) {
      console.log("   Auth settings already match configuration.");
      return true;
    }
    const directory = resolve(cwd, ".local/config-backups");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    // Protect credential-bearing snapshots even in consumers that do not
    // already ignore .local. Preserve any consumer-owned ignore rules.
    writeFileSync(resolve(directory, ".gitignore"), "\n*\n", {
      flag: "a",
      mode: 0o600,
    });
    const backup = resolve(
      directory,
      `supabase-${environment}-${Date.now()}-${randomUUID()}.json`,
    );
    const previous = Object.fromEntries(
      Object.keys(patch).map((key) => [key, current[key] ?? null]),
    );
    writeFileSync(
      backup,
      JSON.stringify({ project, settings: previous }, null, 2),
      { mode: 0o600, flag: "wx" },
    );
    console.log(
      `   Private rollback snapshot: ${backup} (may contain credentials).`,
    );
    await authManagementRequest(project, token, patch);
    const saved = await authManagementRequest(project, token);
    for (const [key, value] of Object.entries(settings)) {
      if (key !== "smtp_pass" && saved[key] !== value)
        throw new Error(`Saved Auth setting did not match: ${key}`);
    }
    console.log(
      "   Auth settings applied and verified. Templates and unrelated settings were not changed.",
    );
    return true;
  } catch (error) {
    console.error(
      `   Supabase Auth sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return false;
  }
}
