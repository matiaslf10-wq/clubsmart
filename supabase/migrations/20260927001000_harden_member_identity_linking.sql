create unique index if not exists members_unique_club_dni
on public.members (
  club_id,
  (regexp_replace(coalesce(dni, ''), '[^0-9]', '', 'g'))
)
where nullif(
  regexp_replace(coalesce(dni, ''), '[^0-9]', '', 'g'),
  ''
) is not null;

create unique index if not exists member_accounts_one_active_self_per_member
on public.member_accounts (member_id)
where active = true
  and relation_type = 'self'::public.member_account_relation_type;

revoke insert
on table public.member_link_requests
from authenticated;

drop policy if exists member_link_requests_insert_own
on public.member_link_requests;

create or replace function public.request_member_link(
  requested_club_id uuid,
  requested_relation_type public.member_account_relation_type,
  requested_dni text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid;
  normalized_dni text;
  requested_organization_id uuid;
  existing_member_id uuid;
  existing_self_user_id uuid;
  created_request_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  normalized_dni :=
    regexp_replace(
      coalesce(requested_dni, ''),
      '[^0-9]',
      '',
      'g'
    );

  if normalized_dni !~ '^[0-9]{6,9}$' then
    raise exception 'INVALID_DNI';
  end if;

  select c.organization_id
  into requested_organization_id
  from public.clubs c
  where c.id = requested_club_id
    and private.is_active_published_club(
      c.id,
      c.organization_id
    );

  if requested_organization_id is null then
    raise exception 'CLUB_NOT_AVAILABLE';
  end if;

  if requested_relation_type =
    'self'::public.member_account_relation_type
  then
    select m.id
    into existing_member_id
    from public.members m
    where m.club_id = requested_club_id
      and regexp_replace(
        coalesce(m.dni, ''),
        '[^0-9]',
        '',
        'g'
      ) = normalized_dni
    limit 1;

    if existing_member_id is not null then
      select ma.user_id
      into existing_self_user_id
      from public.member_accounts ma
      where ma.member_id = existing_member_id
        and ma.active = true
        and ma.relation_type =
          'self'::public.member_account_relation_type
      limit 1;

      if existing_self_user_id is not null then
        if existing_self_user_id = current_user_id then
          raise exception 'SELF_ACCOUNT_ALREADY_LINKED';
        end if;

        raise exception 'DNI_ALREADY_HAS_ACCOUNT';
      end if;
    end if;
  end if;

  if exists (
    select 1
    from public.member_link_requests r
    where r.user_id = current_user_id
      and r.club_id = requested_club_id
      and regexp_replace(
        coalesce(r.claimed_dni, ''),
        '[^0-9]',
        '',
        'g'
      ) = normalized_dni
      and r.status = 'pending'
  ) then
    raise exception 'PENDING_LINK_REQUEST_EXISTS';
  end if;

  insert into public.member_link_requests (
    user_id,
    club_id,
    relation_type,
    claimed_dni
  )
  values (
    current_user_id,
    requested_club_id,
    requested_relation_type,
    normalized_dni
  )
  returning id into created_request_id;

  return created_request_id;
end;
$$;

revoke execute
on function public.request_member_link(
  uuid,
  public.member_account_relation_type,
  text
)
from public, anon;

grant execute
on function public.request_member_link(
  uuid,
  public.member_account_relation_type,
  text
)
to authenticated;

drop function if exists public.approve_member_link_request(
  uuid,
  uuid,
  text
);

create or replace function public.approve_member_link_request(
  requested_request_id uuid,
  requested_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_request public.member_link_requests%rowtype;
  requested_organization_id uuid;
  matched_member_id uuid;
  matched_member_active boolean;
  existing_self_user_id uuid;
  created_member_account_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select r.*
  into link_request
  from public.member_link_requests r
  where r.id = requested_request_id
  for update;

  if not found then
    raise exception 'LINK_REQUEST_NOT_FOUND';
  end if;

  if link_request.status <> 'pending' then
    raise exception 'LINK_REQUEST_ALREADY_REVIEWED';
  end if;

  select c.organization_id
  into requested_organization_id
  from public.clubs c
  where c.id = link_request.club_id;

  if requested_organization_id is null then
    raise exception 'CLUB_NOT_FOUND';
  end if;

  if not private.has_organization_role(
    requested_organization_id,
    array[
      'owner'::public.organization_role,
      'admin'::public.organization_role
    ]
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select
    m.id,
    m.active
  into
    matched_member_id,
    matched_member_active
  from public.members m
  where m.club_id = link_request.club_id
    and regexp_replace(
      coalesce(m.dni, ''),
      '[^0-9]',
      '',
      'g'
    ) = link_request.claimed_dni
  limit 1;

  if link_request.relation_type =
    'self'::public.member_account_relation_type
  then
    if matched_member_id is null then
      if
        link_request.requester_first_name is null
        or char_length(
          btrim(link_request.requester_first_name)
        ) < 2
        or link_request.requester_last_name is null
        or char_length(
          btrim(link_request.requester_last_name)
        ) < 2
      then
        raise exception 'REQUESTER_PROFILE_INCOMPLETE';
      end if;

      insert into public.members (
        organization_id,
        club_id,
        first_name,
        last_name,
        dni,
        email,
        active
      )
      values (
        requested_organization_id,
        link_request.club_id,
        btrim(link_request.requester_first_name),
        btrim(link_request.requester_last_name),
        link_request.claimed_dni,
        link_request.requester_email,
        true
      )
      returning id into matched_member_id;

    elsif matched_member_active is not true then
      raise exception 'MEMBER_INACTIVE';
    end if;

    select ma.user_id
    into existing_self_user_id
    from public.member_accounts ma
    where ma.member_id = matched_member_id
      and ma.active = true
      and ma.relation_type =
        'self'::public.member_account_relation_type
    limit 1;

    if existing_self_user_id is not null
      and existing_self_user_id <> link_request.user_id
    then
      raise exception 'DNI_ALREADY_HAS_ACCOUNT';
    end if;

  else
    if matched_member_id is null
      or matched_member_active is not true
    then
      raise exception 'MEMBER_NOT_FOUND_OR_INACTIVE';
    end if;
  end if;

  insert into public.member_accounts (
    user_id,
    member_id,
    relation_type,
    active
  )
  values (
    link_request.user_id,
    matched_member_id,
    link_request.relation_type,
    true
  )
  on conflict (user_id, member_id)
  do update
    set
      relation_type = excluded.relation_type,
      active = true,
      updated_at = now()
  returning id into created_member_account_id;

  update public.member_link_requests
  set
    status = 'approved',
    member_id = matched_member_id,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note =
      nullif(btrim(requested_review_note), '')
  where id = link_request.id;

  if link_request.relation_type =
    'self'::public.member_account_relation_type
  then
    update public.member_link_requests
    set
      status = 'rejected',
      member_id = null,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note =
        'Rechazada automaticamente: el DNI ya fue vinculado a otra cuenta.'
    where id <> link_request.id
      and club_id = link_request.club_id
      and status = 'pending'
      and relation_type =
        'self'::public.member_account_relation_type
      and regexp_replace(
        coalesce(claimed_dni, ''),
        '[^0-9]',
        '',
        'g'
      ) = link_request.claimed_dni;
  end if;

  return created_member_account_id;
end;
$$;

revoke execute
on function public.approve_member_link_request(
  uuid,
  text
)
from public, anon;

grant execute
on function public.approve_member_link_request(
  uuid,
  text
)
to authenticated;
