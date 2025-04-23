import postgres from "postgres";

const sqlClient = postgres({
    host: process.env.SUPABASE_POOLER_HOST, // e.g., aws-0-us-east-1.pooler.supabase.com
    port: 6543, // Default port for Supabase pooler
    database: "postgres", // Default database for Supabase
    username: process.env.SUPABASE_POOLER_USER, // Default username for Supabase
    password: process.env.SUPABASE_DB_PASSWORD, // Replace with your actual password
    ssl: {
        rejectUnauthorized: false, // This is often required for Supabase connections
    },
    max: 1, // Optional: set the maximum number of connections in the pool
    idle_timeout: 10, // Optional: set the idle timeout for connections
});

const removeTriggerSQL = `
-- Remove the trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
`;

async function main() {
    try {
        console.log("Installing custom user trigger...");

        await sqlClient.begin(async (tx) => {
            await tx.unsafe(removeTriggerSQL); // 🛠️ Use `.unsafe()` for raw full SQL string
        });

        console.log("Custom user trigger installed successfully.");
    } catch (err) {
        console.error("Error installing trigger:", err);
    } finally {
        await sqlClient.end();
        console.log("Connection closed.");
    }
}

main().catch((err) => {
    console.error("Unexpected error:", err);
}
).finally(() => {
    process.exit(0); // Ensure the script exits after completion
});