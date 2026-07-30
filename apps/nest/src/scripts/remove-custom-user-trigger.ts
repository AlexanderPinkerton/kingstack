import { createSupabaseScriptConnection } from "./supabase-script-client";

const removeTriggerSQL = `
-- Remove the trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
`;

async function main() {
  const { sql, target } = createSupabaseScriptConnection();

  try {
    console.log(`Removing auth user trigger from ${target}...`);
    await sql.begin(async (transaction) => {
      await transaction.unsafe(removeTriggerSQL);
    });
    console.log("Auth user trigger removed successfully.");
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error("Failed to remove auth user trigger:", error);
  process.exitCode = 1;
});
