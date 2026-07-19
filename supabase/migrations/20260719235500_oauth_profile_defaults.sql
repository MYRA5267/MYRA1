-- Social providers use different metadata keys for the display name. Keep the
-- auth trigger provider-agnostic and never trust a provider-supplied role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
begin
  display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'user_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'MYRA listener'
  );

  insert into public.profiles (id, username, role)
  values (
    new.id,
    left(display_name, 80),
    case
      when new.raw_user_meta_data ->> 'role' in ('artist', 'listener')
        then new.raw_user_meta_data ->> 'role'
      else 'listener'
    end
  );

  insert into public.profile_private (user_id, email)
  values (new.id, new.email);

  insert into public.subscriptions (user_id, status)
  values (new.id, 'none');

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
