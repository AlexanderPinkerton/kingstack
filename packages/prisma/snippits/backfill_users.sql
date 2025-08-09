insert into public.user (id, email, name, available_scrilla)
select 
  a.id::text, -- cast UUID -> text if needed
  a.raw_user_meta_data->>'email',
  a.raw_user_meta_data->>'name',
  0
from auth.users a
on conflict (id) do update
set
  email = excluded.email,
  name = excluded.name;