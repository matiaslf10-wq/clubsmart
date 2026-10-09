create or replace function public.store_payment_provider_secret(
  p_provider_configuration_id uuid,
  p_secret text
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_current_reference text;
  v_secret_id uuid;
begin
  select secret_reference
    into v_current_reference
  from public.club_payment_providers
  where id = p_provider_configuration_id
  for update;

  if not found then
    raise exception 'Payment provider configuration not found';
  end if;

  if v_current_reference is not null and v_current_reference <> '' then
    v_secret_id := v_current_reference::uuid;
    perform vault.update_secret(v_secret_id, p_secret);
  else
    select vault.create_secret(
      p_secret,
      'payment-provider-' || p_provider_configuration_id::text,
      'Encrypted credentials for ClubSmart payment provider'
    )
    into v_secret_id;

    update public.club_payment_providers
    set secret_reference = v_secret_id::text,
        updated_at = now()
    where id = p_provider_configuration_id;
  end if;

  return v_secret_id;
end;
$$;

create or replace function public.get_payment_provider_secret(
  p_provider_configuration_id uuid
)
returns text
language sql
security definer
set search_path = public, vault
stable
as $$
  select ds.decrypted_secret
  from public.club_payment_providers cpp
  join vault.decrypted_secrets ds
    on ds.id = cpp.secret_reference::uuid
  where cpp.id = p_provider_configuration_id;
$$;

revoke all on function public.store_payment_provider_secret(uuid, text) from public, anon, authenticated;
revoke all on function public.get_payment_provider_secret(uuid) from public, anon, authenticated;

grant execute on function public.store_payment_provider_secret(uuid, text) to service_role;
grant execute on function public.get_payment_provider_secret(uuid) to service_role;