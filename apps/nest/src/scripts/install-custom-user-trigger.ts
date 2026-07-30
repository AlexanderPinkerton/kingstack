import { createSupabaseScriptConnection } from "./supabase-script-client";

const createTriggerSQL = `
update public.user
set previous_usernames = array[]::text[]
where previous_usernames is null;

alter table public.user
  alter column previous_usernames set default array[]::text[],
  alter column previous_usernames set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_username text := nullif(new.raw_user_meta_data ->> 'username', '');
  resolved_username text;
begin
  -- The application user model requires email, while Supabase Auth can also
  -- contain phone-only identities. Leave those identities in auth.users
  -- without aborting their creation.
  if new.email is null then
    return new;
  end if;

  if requested_username is not null
    and char_length(requested_username) between 3 and 40
    and requested_username ~ '^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$'
  then
    resolved_username := requested_username;
  else
    resolved_username := 'user_' || replace(new.id::text, '-', '');
  end if;

  insert into public.user (id, email, username, previous_usernames)
  values (
    new.id::text,
    new.email,
    resolved_username,
    array[]::text[]
  )
  on conflict (id) do update
  set
    email = excluded.email,
    previous_usernames = coalesce(
      public.user.previous_usernames,
      array[]::text[]
    );

  return new;
end;
$$;

revoke all on function public.handle_new_user()
from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
`;

async function main() {
  const { sql, target } = createSupabaseScriptConnection();

  try {
    console.log(`Installing auth user trigger on ${target}...`);
    await sql.begin(async (transaction) => {
      await transaction.unsafe(createTriggerSQL);
    });
    console.log("Auth user trigger installed successfully.");
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error("Failed to install auth user trigger:", error);
  process.exitCode = 1;
});
