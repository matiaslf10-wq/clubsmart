drop policy if exists activity_fee_rates_select_linked_member
on public.activity_fee_rates;

create policy activity_fee_rates_select_linked_member
on public.activity_fee_rates
for select
to authenticated
using (
  exists (
    select 1
    from public.member_accounts ma
    join public.members m
      on m.id = ma.member_id
    join public.activities a
      on a.id = activity_fee_rates.activity_id
    where ma.user_id = auth.uid()
      and ma.active = true
      and m.active = true
      and m.organization_id = activity_fee_rates.organization_id
      and m.club_id = activity_fee_rates.club_id
      and a.organization_id = activity_fee_rates.organization_id
      and a.club_id = activity_fee_rates.club_id
      and a.active = true
      and a.is_published = true
  )
);
