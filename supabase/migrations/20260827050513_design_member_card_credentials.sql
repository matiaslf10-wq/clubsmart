-- Applied to Supabase on 2026-08-27.
-- Creates the member card credential structure and read policies.
-- No public QR verification endpoint is created here.

-- A credential is deliberately separate from members.id. The token is the
-- opaque value that a future QR code may represent; the member_id is only the
-- private relational anchor used by policies and future administrative flows.
create table public.member_card_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  club_id uuid not null,
  member_id uuid not null,
  credential_token uuid not null default gen_random_uuid(),
  active boolean not null default true,
  issued_at timestamp with time zone not null default now(),
  revoked_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  constraint member_card_credentials_token_unique
    unique (credential_token),

  constraint member_card_credentials_organization_id_fkey
    foreign key (organization_id)
    references public.organizations (id),

  constraint member_card_credentials_club_id_fkey
    foreign key (club_id)
    references public.clubs (id),

  constraint member_card_credentials_member_fkey
    foreign key (member_id)
    references public.members (id),

  constraint member_card_credentials_revocation_consistent
    check (
      (active = true and revoked_at is null)
      or (active = false and revoked_at is not null)
    ),

  constraint member_card_credentials_revoked_at_check
    check (revoked_at is null or revoked_at >= issued_at)
);

-- This is the business invariant: historical revoked credentials may remain,
-- but a member can have at most one active credential.
create unique index member_card_credentials_one_active_per_member_idx
  on public.member_card_credentials (member_id)
  where active = true;

create index member_card_credentials_member_id_idx
  on public.member_card_credentials (member_id);

create index member_card_credentials_tenant_idx
  on public.member_card_credentials (organization_id, club_id);

-- Keep the denormalized tenant columns trustworthy. The same condition is
-- repeated in RLS because policies must not rely only on a write-time check.
create or replace function private.validate_member_card_credential_tenant()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not exists (
    select 1
    from public.members m
    where m.id = new.member_id
      and m.organization_id = new.organization_id
      and m.club_id = new.club_id
  ) then
    raise exception 'member_card_credentials tenant does not match member';
  end if;

  if not exists (
    select 1
    from public.clubs c
    where c.id = new.club_id
      and c.organization_id = new.organization_id
  ) then
    raise exception 'member_card_credentials tenant does not match club';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_member_card_credential_tenant() from public;
revoke all on function private.validate_member_card_credential_tenant() from anon;
revoke all on function private.validate_member_card_credential_tenant() from authenticated;

create trigger member_card_credentials_validate_tenant
  before insert or update on public.member_card_credentials
  for each row
  execute function private.validate_member_card_credential_tenant();

create trigger member_card_credentials_set_updated_at
  before update on public.member_card_credentials
  for each row
  execute function public.set_updated_at();

alter table public.member_card_credentials enable row level security;

-- The mobile app has no write access in this stage. service_role remains the
-- backend-only path for a future issuance/revocation workflow.
revoke all on table public.member_card_credentials from anon;
revoke all on table public.member_card_credentials from authenticated;
grant select on table public.member_card_credentials to authenticated;
grant all on table public.member_card_credentials to service_role;

-- A linked account may read only the active credential for an accessible
-- member. Both tenant columns must agree with the referenced member, and the
-- member must currently be active. The member relation itself is also the
-- authorization anchor.
create policy member_card_credentials_select_linked_member
  on public.member_card_credentials
  for select
  to authenticated
  using (
    active = true
    and private.can_access_member(member_id)
    and exists (
      select 1
      from public.members m
      where m.id = member_card_credentials.member_id
        and m.active = true
        and m.organization_id = member_card_credentials.organization_id
        and m.club_id = member_card_credentials.club_id
    )
  );

-- Owner and admin access is organization-scoped and includes historical
-- revoked credentials for traceability. Tenant consistency remains required.
create policy member_card_credentials_select_owner_admin
  on public.member_card_credentials
  for select
  to authenticated
  using (
    private.has_organization_role(
      organization_id,
      ARRAY[
        'owner'::public.organization_role,
        'admin'::public.organization_role
      ]
    )
    and exists (
      select 1
      from public.members m
      where m.id = member_card_credentials.member_id
        and m.organization_id = member_card_credentials.organization_id
        and m.club_id = member_card_credentials.club_id
    )
  );

-- There is intentionally no anon grant and no anon policy. A future public QR
-- verification RPC or endpoint must check credential.active = true,
-- member.active = true, and full tenant consistency before returning a
-- minimal verification result. It must not expose this table or allow token
-- enumeration. No automatic revocation is performed when a member becomes
-- inactive.

-- Review queries to run separately against the shared database before applying:
-- select table_name, column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'member_card_credentials'
-- order by ordinal_position;
--
-- select schemaname, tablename, policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'member_card_credentials';