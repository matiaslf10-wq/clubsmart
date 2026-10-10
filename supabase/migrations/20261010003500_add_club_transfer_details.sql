alter table public.clubs
  add column if not exists transfer_alias text,
  add column if not exists transfer_cvu text,
  add column if not exists transfer_holder text;
