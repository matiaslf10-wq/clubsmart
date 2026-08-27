-- Review-only migration for the shared ClubSmart database.
-- This file has not been applied to Supabase.
--
-- Assumed columns, to verify against the shared database before applying:
-- monthly_fees(id, organization_id, club_id, member_id)
-- payments(id, organization_id, club_id, member_id, monthly_fee_id)
-- payment_subscriptions(id, organization_id, club_id, member_id)
--
-- Review queries (run separately, read-only):
-- select schemaname, tablename, policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('monthly_fees', 'payments', 'payment_subscriptions')
-- order by tablename, policyname;
--
-- select table_name, column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('monthly_fees', 'payments', 'payment_subscriptions')
-- order by table_name, ordinal_position;
--
-- select tc.table_name, tc.constraint_name, tc.constraint_type,
--        kcu.column_name, ccu.table_name as referenced_table,
--        ccu.column_name as referenced_column
-- from information_schema.table_constraints tc
-- join information_schema.key_column_usage kcu
--   on kcu.constraint_name = tc.constraint_name
--  and kcu.table_schema = tc.table_schema
-- left join information_schema.constraint_column_usage ccu
--   on ccu.constraint_name = tc.constraint_name
--  and ccu.table_schema = tc.table_schema
-- where tc.table_schema = 'public'
--   and tc.table_name in ('monthly_fees', 'payments', 'payment_subscriptions')
-- order by tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- A linked account may read only fees whose member belongs to the same
-- organization and club recorded on the fee.
create policy monthly_fees_select_linked_member
  on public.monthly_fees
  for select
  to authenticated
  using (
    private.can_access_member(member_id)
    and exists (
      select 1
      from public.members m
      where m.id = monthly_fees.member_id
        and m.organization_id = monthly_fees.organization_id
        and m.club_id = monthly_fees.club_id
    )
  );

-- A payment with a member_id must be tenant-consistent and linked to an
-- accessible member. If it references a fee, the fee must identify that same
-- member in the same tenant.
create policy payments_select_linked_member
  on public.payments
  for select
  to authenticated
  using (
    member_id is not null
    and private.can_access_member(member_id)
    and exists (
      select 1
      from public.members m
      where m.id = payments.member_id
        and m.organization_id = payments.organization_id
        and m.club_id = payments.club_id
    )
    and (
      monthly_fee_id is null
      or exists (
        select 1
        from public.monthly_fees mf
        where mf.id = payments.monthly_fee_id
          and mf.member_id = payments.member_id
          and mf.organization_id = payments.organization_id
          and mf.club_id = payments.club_id
      )
    )
  );

-- Some payment providers may store member_id as null while retaining the
-- monthly_fee_id. Such a payment is readable only through an accessible,
-- tenant-consistent fee. Payments with neither anchor remain unreadable.
create policy payments_select_linked_monthly_fee
  on public.payments
  for select
  to authenticated
  using (
    member_id is null
    and monthly_fee_id is not null
    and exists (
      select 1
      from public.monthly_fees mf
      where mf.id = payments.monthly_fee_id
        and mf.organization_id = payments.organization_id
        and mf.club_id = payments.club_id
        and private.can_access_member(mf.member_id)
        and exists (
          select 1
          from public.members m
          where m.id = mf.member_id
            and m.organization_id = mf.organization_id
            and m.club_id = mf.club_id
        )
    )
  );

-- A linked account may read the automatic-debit subscription for an
-- accessible member only when its tenant columns agree with members.
create policy payment_subscriptions_select_linked_member
  on public.payment_subscriptions
  for select
  to authenticated
  using (
    private.can_access_member(member_id)
    and exists (
      select 1
      from public.members m
      where m.id = payment_subscriptions.member_id
        and m.organization_id = payment_subscriptions.organization_id
        and m.club_id = payment_subscriptions.club_id
    )
  );
