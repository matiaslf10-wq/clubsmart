-- Automatically issue and revoke member card credentials with member lifecycle changes.

create or replace function private.auto_manage_member_card_credentials()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.active then
      insert into public.member_card_credentials (
        organization_id,
        club_id,
        member_id
      )
      values (
        new.organization_id,
        new.club_id,
        new.id
      )
      on conflict (member_id) where active = true do nothing;
    end if;

    return new;
  end if;

  if old.active and not new.active then
    update public.member_card_credentials
    set
      active = false,
      revoked_at = clock_timestamp()
    where member_id = new.id
      and active = true;
  elsif not old.active and new.active then
    insert into public.member_card_credentials (
      organization_id,
      club_id,
      member_id
    )
    values (
      new.organization_id,
      new.club_id,
      new.id
    )
    on conflict (member_id) where active = true do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.auto_manage_member_card_credentials() from public;
revoke execute on function private.auto_manage_member_card_credentials() from anon;
revoke execute on function private.auto_manage_member_card_credentials() from authenticated;

create trigger members_auto_manage_member_card_credentials
  after insert or update of active on public.members
  for each row
  execute function private.auto_manage_member_card_credentials();

update public.member_card_credentials c
set
  active = false,
  revoked_at = clock_timestamp()
from public.members m
where c.member_id = m.id
  and m.active = false
  and c.active = true;

insert into public.member_card_credentials (
  organization_id,
  club_id,
  member_id
)
select
  m.organization_id,
  m.club_id,
  m.id
from public.members m
where m.active = true
  and not exists (
    select 1
    from public.member_card_credentials c
    where c.member_id = m.id
      and c.active = true
  )
on conflict (member_id) where active = true do nothing;