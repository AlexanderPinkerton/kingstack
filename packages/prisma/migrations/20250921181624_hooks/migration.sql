-- Fix supabase breaking after prisma reset
grant usage on schema public to postgres, anon, authenticated, service_role;

grant all privileges on all tables in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all functions in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all sequences in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

-- If any users exist in supabase auth.users table, copy them over.
INSERT INTO public.user (id, email, username)
SELECT 
  a.id::text, -- cast UUID -> text if needed
  a.raw_user_meta_data->>'email',
  a.raw_user_meta_data->>'username'
FROM auth.users a
ON CONFLICT (id) DO UPDATE
SET
  email = excluded.email,
  username = excluded.username;

-- Install the initial user copy trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.user (id, email, username)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'username';
  )
  on conflict (id) do nothing; -- Prevents error if user already exists
  return new;
end;
$$;

-- Hook the function up to a trigger only if 'auth' schema exists
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();