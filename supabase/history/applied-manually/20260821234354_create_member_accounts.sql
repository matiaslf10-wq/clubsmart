-- Review-only migration for the shared ClubSmart database.
-- This file has not been applied to Supabase.

create type public.member_account_relation_type as enum (
  'self',
  'guardian',
  'authorized'
);

create table public.member_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  member_id uuid not null,
  relation_type public.member_account_relation_type not null,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint member_accounts_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,

  constraint member_accounts_member_id_fkey
    foreign key (member_id)
    references public.members (id)
    on delete cascade,

  constraint member_accounts_unique_membership
    unique (user_id, member_id)
);

-- The unique constraint above supports lookups whose leading key is user_id.
-- This complementary index supports reverse lookups by member_id.
create index member_accounts_member_id_idx
  on public.member_accounts (member_id);

create trigger member_accounts_set_updated_at
  before update on public.member_accounts
  for each row
  execute function public.set_updated_at();

alter table public.member_accounts enable row level security;

-- Keep the table unavailable to anonymous clients. Authenticated writes remain
-- subject to the owner/admin policies below; there is no self-linking policy.
revoke all on table public.member_accounts from anon;
grant select, insert, update, delete on table public.member_accounts to authenticated;
grant all on table public.member_accounts to service_role;
grant usage on type public.member_account_relation_type to authenticated, service_role;

create policy member_accounts_select
  on public.member_accounts
  for select
  to authenticated
  using (
    (user_id = (select auth.uid()) and active = true)
    or exists (
      select 1
      from public.members m
      where m.id = member_accounts.member_id
        and private.has_organization_role(
          m.organization_id,
          array['owner', 'admin']::public.organization_role[]
        )
    )
  );

create policy member_accounts_insert_admin
  on public.member_accounts
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.members m
      where m.id = member_accounts.member_id
        and private.has_organization_role(
          m.organization_id,
          array['owner', 'admin']::public.organization_role[]
        )
    )
  );

create policy member_accounts_update_admin
  on public.member_accounts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.members m
      where m.id = member_accounts.member_id
        and private.has_organization_role(
          m.organization_id,
          array['owner', 'admin']::public.organization_role[]
        )
    )
  )
  with check (
    exists (
      select 1
      from public.members m
      where m.id = member_accounts.member_id
        and private.has_organization_role(
          m.organization_id,
          array['owner', 'admin']::public.organization_role[]
        )
    )
  );

create policy member_accounts_delete_admin
  on public.member_accounts
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.members m
      where m.id = member_accounts.member_id
        and private.has_organization_role(
          m.organization_id,
          array['owner', 'admin']::public.organization_role[]
        )
    )
  );

-- Deliberately deferred: members currently authorizes reads through
-- organization_users only. A later migration should add a permissive SELECT
-- policy equivalent to the following predicate so a mobile account can read
-- only its active linked members:
--
-- exists (
--   select 1
--   from public.member_accounts ma
--   where ma.member_id = members.id
--     and ma.user_id = (select auth.uid())
--     and ma.active = true
-- )
