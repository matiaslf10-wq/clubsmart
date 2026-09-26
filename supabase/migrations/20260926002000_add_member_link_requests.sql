create table if not exists public.member_link_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id),
  relation_type public.member_account_relation_type not null default 'self',
  claimed_dni text not null,
  requester_first_name text,
  requester_last_name text,
  requester_email text,
  status text not null default 'pending',
  member_id uuid references public.members(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint member_link_requests_status_check
    check (status in ('pending', 'approved', 'rejected')),

  constraint member_link_requests_claimed_dni_check
    check (claimed_dni ~ '^[0-9]{6,9}$'),

  constraint member_link_requests_review_state_check
    check (
      (
        status = 'pending'
        and member_id is null
        and reviewed_at is null
      )
      or
      (
        status = 'approved'
        and member_id is not null
        and reviewed_at is not null
      )
      or
      (
        status = 'rejected'
        and member_id is null
        and reviewed_at is not null
      )
    )
);

create index if not exists member_link_requests_user_status_idx
  on public.member_link_requests (user_id, status);

create index if not exists member_link_requests_club_status_idx
  on public.member_link_requests (club_id, status);

create unique index if not exists member_link_requests_pending_unique
  on public.member_link_requests (user_id, club_id, claimed_dni)
  where status = 'pending';

alter table public.member_link_requests enable row level security;

revoke all on table public.member_link_requests from anon, authenticated;
grant select, insert on table public.member_link_requests to authenticated;

create or replace function private.prepare_member_link_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.claimed_dni :=
    regexp_replace(coalesce(new.claimed_dni, ''), '[^0-9]', '', 'g');

  select
    p.first_name,
    p.last_name,
    u.email
  into
    new.requester_first_name,
    new.requester_last_name,
    new.requester_email
  from auth.users u
  left join public.person_profiles p
    on p.user_id = u.id
  where u.id = new.user_id;

  if new.requester_email is null then
    raise exception 'Authenticated user not found';
  end if;

  new.status := 'pending';
  new.member_id := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.review_note := null;

  return new;
end;
$$;

revoke execute
  on function private.prepare_member_link_request()
  from public, anon, authenticated;

drop trigger if exists member_link_requests_prepare_insert
  on public.member_link_requests;

create trigger member_link_requests_prepare_insert
before insert on public.member_link_requests
for each row
execute function private.prepare_member_link_request();

drop trigger if exists member_link_requests_set_updated_at
  on public.member_link_requests;

create trigger member_link_requests_set_updated_at
before update on public.member_link_requests
for each row
execute function public.set_updated_at();

drop policy if exists member_link_requests_select
  on public.member_link_requests;

create policy member_link_requests_select
  on public.member_link_requests
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.clubs c
      where c.id = club_id
        and private.has_organization_role(
          c.organization_id,
          array[
            'owner'::public.organization_role,
            'admin'::public.organization_role
          ]
        )
    )
  );

drop policy if exists member_link_requests_insert_own
  on public.member_link_requests;

create policy member_link_requests_insert_own
  on public.member_link_requests
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.clubs c
      where c.id = club_id
        and private.is_active_published_club(
          c.id,
          c.organization_id
        )
    )
  );

create or replace function public.approve_member_link_request(
  requested_request_id uuid,
  requested_member_id uuid,
  requested_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_request public.member_link_requests%rowtype;
  requested_organization_id uuid;
  created_member_account_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select r.*
  into requested_request
  from public.member_link_requests r
  where r.id = requested_request_id
  for update;

  if not found then
    raise exception 'Link request not found';
  end if;

  if requested_request.status <> 'pending' then
    raise exception 'Link request has already been reviewed';
  end if;

  select c.organization_id
  into requested_organization_id
  from public.clubs c
  where c.id = requested_request.club_id;

  if requested_organization_id is null then
    raise exception 'Club not found';
  end if;

  if not private.has_organization_role(
    requested_organization_id,
    array[
      'owner'::public.organization_role,
      'admin'::public.organization_role
    ]
  ) then
    raise exception 'Not authorized';
  end if;

  perform 1
  from public.members m
  where m.id = requested_member_id
    and m.club_id = requested_request.club_id
    and m.active = true
    and regexp_replace(coalesce(m.dni, ''), '[^0-9]', '', 'g')
        = requested_request.claimed_dni;

  if not found then
    raise exception 'Member does not match the request';
  end if;

  insert into public.member_accounts (
    user_id,
    member_id,
    relation_type,
    active
  )
  values (
    requested_request.user_id,
    requested_member_id,
    requested_request.relation_type,
    true
  )
  on conflict (user_id, member_id)
  do update
    set relation_type = excluded.relation_type,
        active = true,
        updated_at = now()
  returning id into created_member_account_id;

  update public.member_link_requests
  set
    status = 'approved',
    member_id = requested_member_id,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = nullif(btrim(requested_review_note), '')
  where id = requested_request.id;

  return created_member_account_id;
end;
$$;

revoke execute
  on function public.approve_member_link_request(uuid, uuid, text)
  from public, anon;

grant execute
  on function public.approve_member_link_request(uuid, uuid, text)
  to authenticated;

create or replace function public.reject_member_link_request(
  requested_request_id uuid,
  requested_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_request public.member_link_requests%rowtype;
  requested_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select r.*
  into requested_request
  from public.member_link_requests r
  where r.id = requested_request_id
  for update;

  if not found then
    raise exception 'Link request not found';
  end if;

  if requested_request.status <> 'pending' then
    raise exception 'Link request has already been reviewed';
  end if;

  select c.organization_id
  into requested_organization_id
  from public.clubs c
  where c.id = requested_request.club_id;

  if requested_organization_id is null then
    raise exception 'Club not found';
  end if;

  if not private.has_organization_role(
    requested_organization_id,
    array[
      'owner'::public.organization_role,
      'admin'::public.organization_role
    ]
  ) then
    raise exception 'Not authorized';
  end if;

  update public.member_link_requests
  set
    status = 'rejected',
    member_id = null,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = nullif(btrim(requested_review_note), '')
  where id = requested_request.id;
end;
$$;

revoke execute
  on function public.reject_member_link_request(uuid, text)
  from public, anon;

grant execute
  on function public.reject_member_link_request(uuid, text)
  to authenticated;
