-- Review-only migration for the shared ClubSmart database.
-- This file has not been applied to Supabase.
--
-- This RPC is the only write path introduced for notification recipients.
-- It deliberately does not add INSERT, UPDATE, or DELETE policies.

create or replace function public.mark_notification_recipient_read(
  requested_recipient_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  recipient_accessible boolean;
begin
  recipient_accessible := private.can_access_notification_recipient(
    requested_recipient_id
  );

  if not recipient_accessible then
    return false;
  end if;

  update public.club_notification_recipients
  set read_at = statement_timestamp()
  where id = requested_recipient_id
    and read_at is null;

  return true;
end;
$$;

revoke all on function public.mark_notification_recipient_read(uuid) from public;
revoke execute on function public.mark_notification_recipient_read(uuid) from anon;
grant execute on function public.mark_notification_recipient_read(uuid) to authenticated;

-- No INSERT, UPDATE, or DELETE policies are introduced on
-- public.club_notification_recipients. No other notification table is changed.
