alter table public.organization_users
  add column if not exists can_view_fees boolean not null default false;

update public.organization_users
set can_manage_fees = false
where role = 'operator'
  and can_manage_fees = true;

comment on column public.organization_users.can_view_fees is
  'Optional owner-granted permission for an operator to view monthly fees in read-only mode.';

comment on column public.organization_users.can_manage_fees is
  'Deprecated for operators. Operators must never manage monthly fees.';