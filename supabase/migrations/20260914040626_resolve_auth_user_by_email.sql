create or replace function public.resolve_auth_user_id_by_email(requested_email text)
returns uuid
language sql
security definer
set search_path = auth, pg_catalog
as $$
  select id
  from auth.users
  where lower(trim(email)) = lower(trim(requested_email))
  limit 1;
$$;

revoke execute on function public.resolve_auth_user_id_by_email(text) from public;
revoke execute on function public.resolve_auth_user_id_by_email(text) from anon, authenticated;
grant execute on function public.resolve_auth_user_id_by_email(text) to service_role;