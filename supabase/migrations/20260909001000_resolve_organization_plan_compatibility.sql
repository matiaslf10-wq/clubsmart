-- Resolves the commercial plan during the transition from
-- organizations.plan_code to subscriptions.plan.
--
-- This migration is read-only infrastructure. It does not create capability
-- tables, change RLS policies, backfill subscriptions, or modify data.

create or replace function private.resolve_organization_plan(
  requested_organization_id uuid
)
returns table (
  organization_id uuid,
  effective_plan public.subscription_plan,
  subscription_plan public.subscription_plan,
  legacy_plan text,
  subscription_status text,
  service_status text,
  plan_source text,
  has_plan_conflict boolean,
  commercial_access_enabled boolean
)
language sql
stable
security definer
set search_path to ''
as $$
  with source as (
    select
      o.id as organization_id,
      o.plan_code::text as legacy_plan,
      o.service_status::text as service_status,
      s.plan as subscription_plan,
      s.status::text as subscription_status
    from public.organizations o
    left join public.subscriptions s
      on s.organization_id = o.id
    where o.id = requested_organization_id
  )
  select
    source.organization_id,
    case
      -- A subscription that can represent Intelligence must not be
      -- downgraded merely because the legacy column cannot represent it.
      when source.subscription_plan = 'intelligence'::public.subscription_plan
        and coalesce(source.legacy_plan, '') <> 'intelligence'
        then source.subscription_plan

      when source.subscription_plan is null
        then case source.legacy_plan
          when 'essential' then 'essential'::public.subscription_plan
          when 'pro' then 'pro'::public.subscription_plan
          else null
        end

      when source.subscription_plan::text = source.legacy_plan
        then source.subscription_plan

      else case source.legacy_plan
        when 'essential' then 'essential'::public.subscription_plan
        when 'pro' then 'pro'::public.subscription_plan
        else null
      end
    end as effective_plan,
    source.subscription_plan,
    source.legacy_plan,
    source.subscription_status,
    source.service_status,
    case
      when source.subscription_plan is null
        then 'legacy_fallback'

      when source.subscription_plan = 'intelligence'::public.subscription_plan
        and coalesce(source.legacy_plan, '') <> 'intelligence'
        then 'subscription'

      when source.subscription_plan::text = source.legacy_plan
        then 'subscription'

      else 'legacy_conflict'
    end as plan_source,
    source.subscription_plan is not null
      and source.subscription_plan::text <> coalesce(source.legacy_plan, '')
      as has_plan_conflict,
    source.service_status = 'active'
      and (
        source.subscription_plan is null
        or source.subscription_status in (
          'trial',
          'active',
          'past_due'
        )
      ) as commercial_access_enabled
  from source;
$$;

revoke all on function private.resolve_organization_plan(uuid)
from public;

revoke execute on function private.resolve_organization_plan(uuid)
from anon;

revoke execute on function private.resolve_organization_plan(uuid)
from authenticated;


create or replace function public.get_my_organization_plan(
  requested_organization_id uuid
)
returns table (
  organization_id uuid,
  effective_plan public.subscription_plan,
  subscription_status text,
  service_status text,
  plan_source text,
  has_plan_conflict boolean,
  commercial_access_enabled boolean,
  organization_role public.organization_role,
  is_linked_member boolean
)
language sql
stable
security definer
set search_path to ''
as $$
  with access as (
    select
      o.id as organization_id,
      (
        select ou.role
        from public.organization_users ou
        where ou.organization_id = o.id
          and ou.user_id = (select auth.uid())
          and ou.active = true
        order by case ou.role
          when 'owner'::public.organization_role then 1
          when 'admin'::public.organization_role then 2
          when 'operator'::public.organization_role then 3
          when 'viewer'::public.organization_role then 4
        end
        limit 1
      ) as organization_role,
      exists (
        select 1
        from public.member_accounts ma
        join public.members m
          on m.id = ma.member_id
         and m.organization_id = o.id
        where ma.user_id = (select auth.uid())
          and ma.active = true
          and m.active = true
      ) as is_linked_member
    from public.organizations o
    where o.id = requested_organization_id
  )
  select
    resolved.organization_id,
    resolved.effective_plan,
    resolved.subscription_status,
    resolved.service_status,
    resolved.plan_source,
    resolved.has_plan_conflict,
    resolved.commercial_access_enabled,
    access.organization_role,
    access.is_linked_member
  from private.resolve_organization_plan(requested_organization_id) resolved
  join access
    on access.organization_id = resolved.organization_id
  where access.organization_role is not null
     or access.is_linked_member;
$$;

revoke all on function public.get_my_organization_plan(uuid)
from public;

revoke execute on function public.get_my_organization_plan(uuid)
from anon;

grant execute on function public.get_my_organization_plan(uuid)
to authenticated;