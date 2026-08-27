-- Review-only migration for the shared ClubSmart database.
-- This file has not been applied to Supabase.
--
-- Assumed columns, to verify against the shared database before applying:
-- organizations(id, active)
-- clubs(id, organization_id, active, is_published)
-- club_spaces(id, organization_id, club_id, active, publicly_bookable)
-- space_availability(id, organization_id, club_id, space_id, active)
-- space_reservations(id, organization_id, club_id, space_id, member_id)
-- reservation_payments(id, organization_id, club_id, reservation_id)
--
-- Review queries (run separately, read-only):
-- select schemaname, tablename, policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in (
--     'clubs', 'club_spaces', 'space_availability',
--     'space_reservations', 'reservation_payments'
--   )
-- order by tablename, policyname;
--
-- select n.nspname as schemaname,
--        c.relname as tablename,
--        c.relrowsecurity as rls_enabled,
--        c.relforcerowsecurity as rls_forced
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname in (
--     'clubs', 'club_spaces', 'space_availability',
--     'space_reservations', 'reservation_payments'
--   )
-- order by c.relname;
--
-- select table_name, column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in (
--     'clubs', 'club_spaces', 'space_availability',
--     'space_reservations', 'reservation_payments'
--   )
-- order by table_name, ordinal_position;
--
-- select tc.table_name, tc.constraint_name, tc.constraint_type,
--        kcu.column_name, ccu.table_name as referenced_table,
--        ccu.column_name as referenced_column
-- from information_schema.table_constraints tc
-- join information_schema.key_column_usage kcu
--   on kcu.constraint_name = tc.constraint_name
--  and kcu.table_schema = tc.table_schema
-- left join information_schema.constraint_column_usage ccu
--   on ccu.constraint_name = tc.constraint_name
--  and ccu.table_schema = tc.table_schema
-- where tc.table_schema = 'public'
--   and tc.table_name in (
--     'clubs', 'club_spaces', 'space_availability',
--     'space_reservations', 'reservation_payments'
--   )
-- order by tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- These helpers must be reviewed against the existing private helper
-- conventions before applying. SECURITY DEFINER avoids organizations and
-- club_spaces RLS blocking the tenant checks made by later policies.
create or replace function private.is_active_published_club(
  requested_club_id uuid,
  requested_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.clubs c
    join public.organizations o on o.id = c.organization_id
    where c.id = requested_club_id
      and c.organization_id = requested_organization_id
      and c.active = true
      and c.is_published = true
      and o.active = true
  );
$$;

revoke all on function private.is_active_published_club(uuid, uuid) from public;
grant execute on function private.is_active_published_club(uuid, uuid) to authenticated;

create or replace function private.space_belongs_to_tenant(
  requested_space_id uuid,
  requested_organization_id uuid,
  requested_club_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.club_spaces cs
    where cs.id = requested_space_id
      and cs.organization_id = requested_organization_id
      and cs.club_id = requested_club_id
  );
$$;

revoke all on function private.space_belongs_to_tenant(uuid, uuid, uuid) from public;
grant execute on function private.space_belongs_to_tenant(uuid, uuid, uuid) to authenticated;

-- A member account may read only active, publicly bookable spaces from an
-- active and published club. The organization_id equality prevents a space
-- from crossing the tenant boundary of its club.
create policy club_spaces_select_published_authenticated
  on public.club_spaces
  for select
  to authenticated
  using (
    active = true
    and publicly_bookable = true
    and private.is_active_published_club(club_id, organization_id)
  );

create policy club_spaces_select_owner_admin
  on public.club_spaces
  for select
  to authenticated
  using (
    private.has_organization_role(
      organization_id,
      ARRAY['owner'::organization_role, 'admin'::organization_role]
    )
  );

-- Availability is visible only when its space is part of the public catalog
-- above. The space, club, and organization identifiers must agree.
create policy space_availability_select_published_authenticated
  on public.space_availability
  for select
  to authenticated
  using (
    active = true
    and private.is_active_published_club(club_id, organization_id)
    and exists (
      select 1
      from public.club_spaces cs
      where cs.id = space_availability.space_id
        and cs.organization_id = space_availability.organization_id
        and cs.club_id = space_availability.club_id
        and cs.active = true
        and cs.publicly_bookable = true
    )
  );

create policy space_availability_select_owner_admin
  on public.space_availability
  for select
  to authenticated
  using (
    private.has_organization_role(
      organization_id,
      ARRAY['owner'::organization_role, 'admin'::organization_role]
    )
  );

-- A normal account may read only reservations for an accessible member.
-- member_id is deliberately required: customer_email, names, and phone
-- numbers are not authorization anchors. The space and tenant identifiers
-- must also be internally consistent.
create policy space_reservations_select_linked_member
  on public.space_reservations
  for select
  to authenticated
  using (
    member_id is not null
    and private.can_access_member(member_id)
    and exists (
      select 1
      from public.members m
      where m.id = space_reservations.member_id
        and m.organization_id = space_reservations.organization_id
        and m.club_id = space_reservations.club_id
    )
    and private.space_belongs_to_tenant(
      space_id,
      organization_id,
      club_id
    )
  );

create policy space_reservations_select_owner_admin
  on public.space_reservations
  for select
  to authenticated
  using (
    private.has_organization_role(
      organization_id,
      ARRAY['owner'::organization_role, 'admin'::organization_role]
    )
  );

-- A payment is readable only through a reservation readable by the same
-- authenticated account. All tenant identifiers are checked at the payment
-- and reservation levels.
create policy reservation_payments_select_linked_reservation
  on public.reservation_payments
  for select
  to authenticated
  using (
    reservation_id is not null
    and exists (
      select 1
      from public.space_reservations sr
      where sr.id = reservation_payments.reservation_id
        and sr.organization_id = reservation_payments.organization_id
        and sr.club_id = reservation_payments.club_id
        and sr.member_id is not null
        and private.can_access_member(sr.member_id)
        and exists (
          select 1
          from public.members m
          where m.id = sr.member_id
            and m.organization_id = sr.organization_id
            and m.club_id = sr.club_id
        )
        and private.space_belongs_to_tenant(
          sr.space_id,
          sr.organization_id,
          sr.club_id
        )
    )
  );

create policy reservation_payments_select_owner_admin
  on public.reservation_payments
  for select
  to authenticated
  using (
    private.has_organization_role(
      organization_id,
      ARRAY['owner'::organization_role, 'admin'::organization_role]
    )
  );

-- No INSERT, UPDATE, or DELETE policies are introduced here.
-- Owner/admin SELECT policies above allow organization-level access even for
-- inactive or non-public rows. No policy is added for anon.