import { createSupabaseScriptConnection } from "./supabase-script-client";

const backfillSQL = `
insert into public.user (id, email, username, previous_usernames)
select
  a.id::text,
  a.email,
  case
    when nullif(a.raw_user_meta_data ->> 'username', '') is not null
      and char_length(a.raw_user_meta_data ->> 'username') between 3 and 40
      and (a.raw_user_meta_data ->> 'username')
        ~ '^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$'
    then a.raw_user_meta_data ->> 'username'
    else 'user_' || replace(a.id::text, '-', '')
  end,
  array[]::text[]
from auth.users a
where a.email is not null
on conflict (id) do update
set
  email = excluded.email,
  previous_usernames = coalesce(
    public.user.previous_usernames,
    array[]::text[]
  )
returning id;
`;

async function main() {
  const { sql, target } = createSupabaseScriptConnection();

  try {
    console.log(`Backfilling auth users into public.user on ${target}...`);

    const missingEmailRows = await sql<{ count: number }[]>`
      select count(*)::int as count
      from auth.users
      where email is null
    `;

    if ((missingEmailRows[0]?.count ?? 0) > 0) {
      console.warn(
        `Skipping ${missingEmailRows[0].count} auth user(s) without an email because public.user requires one.`,
      );
    }

    const rows = await sql.begin((transaction) =>
      transaction.unsafe<{ id: string }[]>(backfillSQL),
    );

    console.log(`Backfilled ${rows.length} auth user(s) successfully.`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error("Failed to backfill auth users:", error);
  process.exitCode = 1;
});
