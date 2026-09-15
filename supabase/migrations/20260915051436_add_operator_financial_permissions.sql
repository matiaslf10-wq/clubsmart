alter table public.organization_users
  add column if not exists can_manage_fees boolean not null default false,
  add column if not exists can_record_payments boolean not null default false,
  add column if not exists can_view_delinquency boolean not null default false;

comment on column public.organization_users.can_manage_fees is
  'Optional owner-granted permission for an operator to manage monthly fees.';

comment on column public.organization_users.can_record_payments is
  'Optional owner-granted permission for an operator to record manual payments.';

comment on column public.organization_users.can_view_delinquency is
  'Optional owner-granted permission for an operator to view delinquency.';