-- Adds member_id to secure member card verification without
-- changing the existing RPC used by previous app versions.

create or replace function public.verify_member_card_credential_v2(
  requested_token uuid
)
returns table (
  valid boolean,
  member_id uuid,
  first_name text,
  last_name text,
  club_name text
)
language sql
stable
security definer
set search_path to ''
as $$
  with verification as (
    select
      c.active = true
      and c.revoked_at is null
      and m.active = true
      and cl.active = true
      and o.active = true
      and c.organization_id = m.organization_id
      and c.club_id = m.club_id
      and c.organization_id = cl.organization_id
      and private.has_organization_role(
        c.organization_id,
        array[
          'owner'::public.organization_role,
          'admin'::public.organization_role,
          'operator'::public.organization_role
        ]
      ) as is_valid,
      m.id as member_id,
      m.first_name,
      m.last_name,
      cl.name as club_name
    from (select requested_token as credential_token) request
    left join public.member_card_credentials c
      on c.credential_token = request.credential_token
    left join public.members m
      on m.id = c.member_id
    left join public.clubs cl
      on cl.id = c.club_id
    left join public.organizations o
      on o.id = c.organization_id
  )
  select
    coalesce(is_valid, false),
    case when is_valid then member_id end,
    case when is_valid then first_name end,
    case when is_valid then last_name end,
    case when is_valid then club_name end
  from verification;
$$;

revoke all on function public.verify_member_card_credential_v2(uuid) from public;
revoke execute on function public.verify_member_card_credential_v2(uuid) from anon;
grant execute on function public.verify_member_card_credential_v2(uuid) to authenticated;
