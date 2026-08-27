-- Review-only migration for the shared ClubSmart database.
-- This file has not been applied to Supabase.

-- A normal authenticated account may read enrollment rows only for members
-- that are actively linked to it through member_accounts.
create policy member_activities_select_linked_member
  on public.member_activities
  for select
  to authenticated
  using (
    private.can_access_member(member_id)
    and exists (
      select 1
      from public.members m
      where m.id = member_activities.member_id
        and m.organization_id = member_activities.organization_id
        and m.club_id = member_activities.club_id
    )
  );

-- The existing public catalog policy targets anon only. Authenticated mobile
-- accounts also need access to the same published, active catalog.
create policy activities_select_published_authenticated
  on public.activities
  for select
  to authenticated
  using (
    is_published = true
    and active = true
    and exists (
      select 1
      from public.clubs c
      where c.id = activities.club_id
        and c.organization_id = activities.organization_id
        and c.is_published = true
        and c.active = true
    )
  );

-- Preserve access to a currently enrolled activity even if it is not part of
-- the public catalog. The enrollment must belong to an actively linked member.
create policy activities_select_linked_member_enrollments
  on public.activities
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.member_activities ma
      where ma.activity_id = activities.id
        and ma.organization_id = activities.organization_id
        and ma.club_id = activities.club_id
        and ma.active = true
        and ma.start_date <= current_date
        and (ma.end_date is null or ma.end_date >= current_date)
        and private.can_access_member(ma.member_id)
        and exists (
          select 1
          from public.members m
          where m.id = ma.member_id
            and m.organization_id = ma.organization_id
            and m.club_id = ma.club_id
        )
    )
  );

-- Match the existing anon policy for authenticated accounts so the available
-- activities list can display schedules from the published catalog.
create policy activity_schedules_select_published_authenticated
  on public.activity_schedules
  for select
  to authenticated
  using (
    active = true
    and exists (
      select 1
      from public.activities a
      join public.clubs c on c.id = a.club_id
      where a.id = activity_schedules.activity_id
        and a.organization_id = activity_schedules.organization_id
        and a.club_id = activity_schedules.club_id
        and c.organization_id = activity_schedules.organization_id
        and a.is_published = true
        and a.active = true
        and c.is_published = true
        and c.active = true
    )
  );

-- Preserve active schedules for currently enrolled activities, including an
-- activity that is no longer published, without exposing other members' data.
create policy activity_schedules_select_linked_member_enrollments
  on public.activity_schedules
  for select
  to authenticated
  using (
    active = true
    and exists (
      select 1
      from public.member_activities ma
      where ma.activity_id = activity_schedules.activity_id
        and ma.organization_id = activity_schedules.organization_id
        and ma.club_id = activity_schedules.club_id
        and ma.active = true
        and ma.start_date <= current_date
        and (ma.end_date is null or ma.end_date >= current_date)
        and private.can_access_member(ma.member_id)
        and exists (
          select 1
          from public.members m
          where m.id = ma.member_id
            and m.organization_id = ma.organization_id
            and m.club_id = ma.club_id
        )
    )
  );
