import postgres from "postgres";

// psql -h aws-0-us-east-1.pooler.supabase.com -p 6543 -d postgres -U postgres.gswnatmjldebpgufckjt

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

// const sqlClient = postgres({
//     host: process.env.SUPABASE_PROJECT_HOST,
//     port: 5432,
//     database: "postgres",
//     username: "postgres",
//     password: process.env.SUPABASE_DB_PASSWORD, // Replace with your actual password
//     ssl: {
//         rejectUnauthorized: false, // This is often required for Supabase connections
//     },
//     max: 1, // Optional: set the maximum number of connections in the pool
//     idle_timeout: 10, // Optional: set the idle timeout for connections
// });

// Pull all users from the auth.users table and insert them into the public.user table
//   on conflict (id) do update
const backfillSQL = `
insert into public.user (id, email, name)
select 
  a.id::text, -- cast UUID -> text if needed
  a.raw_user_meta_data->>'email',
  a.raw_user_meta_data->>'name'
from auth.users a
on conflict (id) do update
set
  email = excluded.email,
  name = excluded.name;
`;

async function main() {
  try {
    console.log("Backfilling user data to", process.env.SUPABASE_PROJECT_HOST);

    await sqlClient.begin(async (tx) => {
      await tx.unsafe(backfillSQL); // 🛠️ Use `.unsafe()` for raw full SQL string
    });

    console.log("User data backfilled successfully.");
  } catch (err) {
    console.error("Error backfilling data:", err);
  } finally {
    await sqlClient.end();
    console.log("Connection closed.");
  }
}

main()
  .catch((err) => {
    console.error("Unexpected error:", err);
  })
  .finally(() => {
    process.exit(0); // Ensure the script exits after completion
  });
