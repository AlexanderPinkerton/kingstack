import postgres from "postgres";

// This script installs a custom trigger in the Supabase database to create a user in the User table when a new user is created in the auth.users table.
// It uses the postgres library to connect to the database and execute the SQL commands.
// Make sure to set the environment variables SUPABASE_PROJECT_HOST and SUPABASE_DB_PASSWORD before running this script.
// Use Bun to run this script:
// bun run scripts/install-custom-user-trigger.ts

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

// Prisma Model Reference
// model user {
//     id         String   @id @default(cuid())
//     email      String   @unique
//     name       String?
//     posts      post[]
//     created_at DateTime @default(now())
//   }

// Raw Supabase user meta data
// {
//     "iss": "https://accounts.google.com",
//     "sub": "117336688802687046371",
//     "name": "Alexander Pinkerton",
//     "email": "alexpinkerton88@gmail.com",
//     "picture": "https://lh3.googleusercontent.com/a/ACg8ocJXFTPr1PO9t6zXWzoAWMtIb7YUCDqgZ0yCKMDHQZsI05Y9vPag=s96-c",
//     "full_name": "Alexander Pinkerton",
//     "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJXFTPr1PO9t6zXWzoAWMtIb7YUCDqgZ0yCKMDHQZsI05Y9vPag=s96-c",
//     "provider_id": "117336688802687046371",
//     "email_verified": true,
//     "phone_verified": false
//   }

// const removeTriggerSQL = `
// -- Remove the trigger and function if they exist
// DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
// DROP FUNCTION IF EXISTS public.handle_new_user();
// `;

// 🔥 Golden Rules:
// ❗ Always update this trigger when the User model changes.
// ❗ Always run this script after deploying the app to ensure the trigger is installed.
// ❗ Always test the trigger after installation to ensure it works as expected.
const createTriggerSQL = `
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.user (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'fullName', new.raw_user_meta_data ->> 'name', null))
  on conflict (id) do nothing; -- Prevents error if user already exists
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
`;

async function main() {
  try {
    console.log("Installing custom user trigger...");

    await sqlClient.begin(async (tx) => {
      await tx.unsafe(createTriggerSQL); // 🛠️ Use `.unsafe()` for raw full SQL string
    });

    console.log("Custom user trigger installed successfully.");
  } catch (err) {
    console.error("Error installing trigger:", err);
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
