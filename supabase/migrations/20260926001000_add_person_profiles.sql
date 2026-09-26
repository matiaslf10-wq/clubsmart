create table if not exists public.person_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_profiles_first_name_length_check
    check (first_name is null or char_length(btrim(first_name)) >= 2),
  constraint person_profiles_last_name_length_check
    check (last_name is null or char_length(btrim(last_name)) >= 2)
);

alter table public.person_profiles enable row level security;

revoke all on table public.person_profiles from anon, authenticated;
grant select, update on table public.person_profiles to authenticated;

drop policy if exists person_profiles_select_own
  on public.person_profiles;

create policy person_profiles_select_own
  on public.person_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists person_profiles_update_own
  on public.person_profiles;

create policy person_profiles_update_own
  on public.person_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop trigger if exists person_profiles_set_updated_at
  on public.person_profiles;

create trigger person_profiles_set_updated_at
before update on public.person_profiles
for each row
execute function public.set_updated_at();

create schema if not exists private;

create or replace function private.handle_new_person_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.person_profiles (
    user_id,
    first_name,
    last_name
  )
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute
  on function private.handle_new_person_profile()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_created_person_profile
  on auth.users;

create trigger on_auth_user_created_person_profile
after insert on auth.users
for each row
execute function private.handle_new_person_profile();

insert into public.person_profiles (
  user_id,
  first_name,
  last_name
)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(linked_member.first_name), '')
  ),
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'last_name'), ''),
    nullif(trim(linked_member.last_name), '')
  )
from auth.users u
left join lateral (
  select
    m.first_name,
    m.last_name
  from public.member_accounts ma
  join public.members m
    on m.id = ma.member_id
  where ma.user_id = u.id
    and ma.active = true
    and ma.relation_type = 'self'::public.member_account_relation_type
  order by ma.created_at
  limit 1
) linked_member on true
on conflict (user_id) do nothing;
