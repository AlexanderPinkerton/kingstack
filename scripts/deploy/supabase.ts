#!/usr/bin/env bun

import { formatHelp, parseCliArgs } from "./supabase/options.js";
import { provisionSupabase } from "./supabase/provision.js";

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    console.log(formatHelp());
    return;
  }
  await provisionSupabase(options);
}

if (import.meta.main) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error();
    console.error(`Supabase provisioning stopped: ${message}`);
    process.exitCode = 1;
  });
}
