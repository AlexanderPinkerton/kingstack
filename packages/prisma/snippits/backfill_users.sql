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