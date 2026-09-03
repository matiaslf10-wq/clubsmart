create or replace function public.revoke_member_card_credential(
  requested_member_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  member_record public.members%rowtype;
  previous_credential_id uuid;
  actor_role text;
begin
  select m.*
  into member_record
  from public.members m
  where m.id = requested_member_id
    and private.has_organization_role(
      m.organization_id,
      array[
        'owner'::public.organization_role,
        'admin'::public.organization_role
      ]
    )
  for update;

  if not found then
    raise exception 'member not found or insufficient privilege';
  end if;

  select ou.role::text
  into actor_role
  from public.organization_users ou
  where ou.organization_id = member_record.organization_id
    and ou.user_id = auth.uid()
    and ou.active = true
    and ou.role in (
      'owner'::public.organization_role,
      'admin'::public.organization_role
    )
  order by case
    when ou.role = 'owner'::public.organization_role then 1
    else 2
  end
  limit 1;

  update public.member_card_credentials c
  set
    active = false,
    revoked_at = clock_timestamp()
  where c.member_id = member_record.id
    and c.active = true
  returning c.id
  into previous_credential_id;

  if not found then
    return false;
  end if;

  insert into public.audit_logs (
    organization_id,
    club_id,
    actor_type,
    actor_user_id,
    actor_email,
    actor_role,
    action,
    entity_type,
    entity_id,
    summary,
    source,
    metadata
  )
  values (
    member_record.organization_id,
    member_record.club_id,
    'user',
    auth.uid(),
    auth.jwt() ->> 'email',
    actor_role::text,
    'member_card.revoked',
    'member',
    member_record.id::text,
    'Member card credential revoked',
    'panel',
    jsonb_build_object(
      'previous_credential_id', previous_credential_id,
      'changed', true
    )
  );

  return true;
end;
$$;

revoke all on function public.revoke_member_card_credential(uuid)
from public;

revoke execute on function public.revoke_member_card_credential(uuid)
from anon;

grant execute on function public.revoke_member_card_credential(uuid)
to authenticated;


create or replace function public.reissue_member_card_credential(
  requested_member_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  member_record public.members%rowtype;
  previous_credential_id uuid;
  new_credential_id uuid;
  actor_role text;
begin
  select m.*
  into member_record
  from public.members m
  where m.id = requested_member_id
    and private.has_organization_role(
      m.organization_id,
      array[
        'owner'::public.organization_role,
        'admin'::public.organization_role
      ]
    )
  for update;

  if not found then
    raise exception 'member not found or insufficient privilege';
  end if;

  if not member_record.active then
    raise exception 'member is inactive';
  end if;

  if not exists (
    select 1
    from public.clubs c
    where c.id = member_record.club_id
      and c.organization_id = member_record.organization_id
      and c.active = true
  ) then
    raise exception 'club is inactive or does not belong to organization';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = member_record.organization_id
      and o.active = true
  ) then
    raise exception 'organization is inactive';
  end if;

  select ou.role::text
  into actor_role
  from public.organization_users ou
  where ou.organization_id = member_record.organization_id
    and ou.user_id = auth.uid()
    and ou.active = true
    and ou.role in (
      'owner'::public.organization_role,
      'admin'::public.organization_role
    )
  order by case
    when ou.role = 'owner'::public.organization_role then 1
    else 2
  end
  limit 1;

  update public.member_card_credentials c
  set
    active = false,
    revoked_at = clock_timestamp()
  where c.member_id = member_record.id
    and c.active = true
  returning c.id
  into previous_credential_id;

  insert into public.member_card_credentials (
    organization_id,
    club_id,
    member_id
  )
  values (
    member_record.organization_id,
    member_record.club_id,
    member_record.id
  )
  returning id
  into new_credential_id;

  insert into public.audit_logs (
    organization_id,
    club_id,
    actor_type,
    actor_user_id,
    actor_email,
    actor_role,
    action,
    entity_type,
    entity_id,
    summary,
    source,
    metadata
  )
  values (
    member_record.organization_id,
    member_record.club_id,
    'user',
    auth.uid(),
    auth.jwt() ->> 'email',
    actor_role::text,
    'member_card.reissued',
    'member',
    member_record.id::text,
    'Member card credential reissued',
    'panel',
    jsonb_build_object(
      'previous_credential_id', previous_credential_id,
      'new_credential_id', new_credential_id
    )
  );

  return new_credential_id;
end;
$$;

revoke all on function public.reissue_member_card_credential(uuid)
from public;

revoke execute on function public.reissue_member_card_credential(uuid)
from anon;

grant execute on function public.reissue_member_card_credential(uuid)
to authenticated;