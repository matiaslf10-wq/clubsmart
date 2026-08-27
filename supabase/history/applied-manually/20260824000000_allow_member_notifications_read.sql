-- Review-only migration for the shared ClubSmart database.
-- This file has not been applied to Supabase.
--
-- This file assumes:
-- club_notifications(id, organization_id, club_id, status)
-- club_notification_recipients(
--   id, organization_id, club_id, notification_id, member_id, reservation_id
-- )
-- space_reservations(id, organization_id, club_id, member_id)
--
-- The helpers below are deliberately narrow read-only authorization helpers.
-- They query the notification graph inside SECURITY DEFINER functions so the
-- policies do not recurse through club_notifications and its recipients.

create or replace function private.can_access_notification_recipient(
  requested_recipient_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.club_notification_recipients r
    join public.club_notifications n
      on n.id = r.notification_id
     and n.organization_id = r.organization_id
     and n.club_id = r.club_id
    join public.members m
      on m.id = r.member_id
     and m.organization_id = r.organization_id
     and m.club_id = r.club_id
    where r.id = requested_recipient_id
      and r.member_id is not null
      and private.can_access_member(r.member_id)
      and n.status = 'published'
      and n.reservation_id is not distinct from r.reservation_id
      and (
        r.reservation_id is null
        or exists (
          select 1
          from public.space_reservations sr
          where sr.id = r.reservation_id
            and sr.organization_id = r.organization_id
            and sr.club_id = r.club_id
            and sr.member_id = r.member_id
        )
      )
  );
$$;

revoke all on function private.can_access_notification_recipient(uuid) from public;
grant execute on function private.can_access_notification_recipient(uuid) to authenticated;

create or replace function private.can_access_notification(
  requested_notification_id uuid,
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
    from public.club_notifications n
    join public.club_notification_recipients r
      on r.notification_id = n.id
     and r.organization_id = n.organization_id
     and r.club_id = n.club_id
    join public.members m
      on m.id = r.member_id
     and m.organization_id = r.organization_id
     and m.club_id = r.club_id
    where n.id = requested_notification_id
      and n.organization_id = requested_organization_id
      and n.club_id = requested_club_id
      and n.status = 'published'
      and r.member_id is not null
      and private.can_access_member(r.member_id)
      and n.reservation_id is not distinct from r.reservation_id
      and (
        r.reservation_id is null
        or exists (
          select 1
          from public.space_reservations sr
          where sr.id = r.reservation_id
            and sr.organization_id = r.organization_id
            and sr.club_id = r.club_id
            and sr.member_id = r.member_id
        )
      )
  );
$$;

revoke all on function private.can_access_notification(uuid, uuid, uuid) from public;
grant execute on function private.can_access_notification(uuid, uuid, uuid) to authenticated;

-- A normal member account may read only its own accessible, materialized
-- recipients. Authorization is anchored exclusively in member_id.
create policy club_notification_recipients_select_linked_member
  on public.club_notification_recipients
  for select
  to authenticated
  using (
    private.can_access_notification_recipient(id)
  );

-- Owner, admin, and operator access is organization-scoped. It does not grant
-- access across organizations and introduces no write policy.
create policy club_notification_recipients_select_owner_admin_operator
  on public.club_notification_recipients
  for select
  to authenticated
  using (
    private.has_organization_role(
      organization_id,
      ARRAY[
        'owner'::organization_role,
        'admin'::organization_role,
        'operator'::organization_role
      ]
    )
  );

-- A normal member account may read a published notification only when a
-- tenant-consistent recipient row exists for one of its accessible members.
-- audience_type alone is intentionally not an authorization condition.
create policy club_notifications_select_linked_member
  on public.club_notifications
  for select
  to authenticated
  using (
    private.can_access_notification(
      id,
      organization_id,
      club_id
    )
  );

create policy club_notifications_select_owner_admin_operator
  on public.club_notifications
  for select
  to authenticated
  using (
    private.has_organization_role(
      organization_id,
      ARRAY[
        'owner'::organization_role,
        'admin'::organization_role,
        'operator'::organization_role
      ]
    )
  );

-- notification_deliveries intentionally remains unchanged and inaccessible
-- to member accounts. No INSERT, UPDATE, or DELETE policies are introduced.
-- Marking a recipient as read is deferred to a separate, narrowly scoped
-- increment for UPDATE of read_at on the recipient owned by the member.
