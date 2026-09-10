-- Exposes the pilot capability contract without introducing capability tables.
-- The effective plan and authorization context come from the existing RPC.

create or replace function public.get_my_organization_capabilities(
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
  is_linked_member boolean,
  capabilities text[]
)
language sql
stable
security definer
set search_path to ''
as $$
  select
    plan.organization_id,
    plan.effective_plan,
    plan.subscription_status,
    plan.service_status,
    plan.plan_source,
    plan.has_plan_conflict,
    plan.commercial_access_enabled,
    plan.organization_role,
    plan.is_linked_member,
    case plan.effective_plan
      when 'essential'::public.subscription_plan then array[
        'club.activities',
        'club.contact',
        'club.payment_link',
        'club.profile',
        'club.public_page',
        'club.schedules'
      ]::text[]

      when 'pro'::public.subscription_plan then array[
        'club.activities',
        'club.contact',
        'club.delinquency',
        'club.payment_link',
        'club.profile',
        'club.public_page',
        'club.schedules',
        'club.spaces',
        'member.activities',
        'member.card',
        'member.directory',
        'member.fees',
        'member.linked_people',
        'member.notifications',
        'member.payments',
        'member.reservations',
        'operation.card_verification',
        'organization.audit',
        'organization.exports'
      ]::text[]

      when 'intelligence'::public.subscription_plan then array[
        'club.activities',
        'club.contact',
        'club.delinquency',
        'club.payment_link',
        'club.profile',
        'club.public_page',
        'club.schedules',
        'club.spaces',
        'intelligence.analytics',
        'intelligence.communications',
        'intelligence.recommendations',
        'member.activities',
        'member.card',
        'member.directory',
        'member.fees',
        'member.linked_people',
        'member.notifications',
        'member.payments',
        'member.reservations',
        'operation.card_verification',
        'organization.audit',
        'organization.exports'
      ]::text[]

      else array[]::text[]
    end as capabilities
  from public.get_my_organization_plan(
    requested_organization_id
  ) plan;
$$;

revoke all on function public.get_my_organization_capabilities(uuid)
from public;

revoke execute on function public.get_my_organization_capabilities(uuid)
from anon;

grant execute on function public.get_my_organization_capabilities(uuid)
to authenticated;