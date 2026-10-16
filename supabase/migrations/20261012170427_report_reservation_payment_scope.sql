create or replace function public.report_reservation_payment(
  p_reservation_id uuid,
  p_payment_scope text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_reservation public.space_reservations%rowtype;
  v_relation public.member_account_relation_type;
  v_existing public.reservation_payments%rowtype;
  v_payment public.reservation_payments%rowtype;
  v_scope text;
  v_amount numeric;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Debes iniciar sesión para informar un pago.'
      using errcode = '42501';
  end if;

  v_scope := lower(trim(coalesce(p_payment_scope, '')));

  if v_scope not in ('deposit', 'total') then
    raise exception 'Tipo de pago inválido.';
  end if;

  select sr.*
    into v_reservation
  from public.space_reservations sr
  where sr.id = p_reservation_id
    and sr.member_id is not null;

  if not found then
    raise exception 'La reserva no existe.';
  end if;

  select ma.relation_type
    into v_relation
  from public.member_accounts ma
  where ma.user_id = v_user_id
    and ma.member_id = v_reservation.member_id
    and ma.active = true
  limit 1;

  if not found then
    raise exception 'No tienes acceso a esta reserva.'
      using errcode = '42501';
  end if;

  if v_relation not in ('self', 'guardian') then
    raise exception 'Este vínculo no permite informar pagos de reservas.'
      using errcode = '42501';
  end if;

  if v_reservation.status in ('cancelled', 'rejected', 'completed') then
    raise exception 'No se puede informar un pago para esta reserva.';
  end if;

  if v_scope = 'deposit' then
    if coalesce(v_reservation.deposit_amount, 0) <= 0 then
      raise exception 'Esta reserva no requiere seña.';
    end if;

    if coalesce(v_reservation.paid_amount, 0) >= v_reservation.deposit_amount then
      raise exception 'La seña de esta reserva ya figura pagada.';
    end if;

    v_amount :=
      v_reservation.deposit_amount -
      coalesce(v_reservation.paid_amount, 0);
  else
    if coalesce(v_reservation.amount, 0) <= 0 then
      raise exception 'Esta reserva no tiene un importe total válido.';
    end if;

    if coalesce(v_reservation.paid_amount, 0) >= v_reservation.amount then
      raise exception 'Esta reserva ya figura pagada en su totalidad.';
    end if;

    v_amount :=
      v_reservation.amount -
      coalesce(v_reservation.paid_amount, 0);
  end if;

  select rp.*
    into v_existing
  from public.reservation_payments rp
  where rp.reservation_id = p_reservation_id
    and rp.status = 'pending'
    and rp.source = 'manual'
    and rp.payment_method = 'transfer'
    and coalesce(rp.metadata->>'reported_by_member_app', '') = 'true'
  order by rp.created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'reservation_id', v_existing.reservation_id,
      'amount', v_existing.amount,
      'status', v_existing.status,
      'payment_scope',
        coalesce(v_existing.metadata->>'payment_scope', 'deposit'),
      'already_reported', true
    );
  end if;

  insert into public.reservation_payments (
    organization_id,
    club_id,
    reservation_id,
    amount,
    status,
    source,
    payment_method,
    notes,
    metadata,
    created_by_user_id
  )
  values (
    v_reservation.organization_id,
    v_reservation.club_id,
    v_reservation.id,
    v_amount,
    'pending',
    'manual',
    'transfer',
    case
      when v_scope = 'deposit'
        then 'Seña informada por el socio desde la app.'
      else
        'Pago total informado por el socio desde la app.'
    end,
    jsonb_build_object(
      'reported_by_member_app', true,
      'reported_at', now(),
      'payment_scope', v_scope
    ),
    v_user_id
  )
  returning *
    into v_payment;

  return jsonb_build_object(
    'id', v_payment.id,
    'reservation_id', v_payment.reservation_id,
    'amount', v_payment.amount,
    'status', v_payment.status,
    'payment_scope', v_scope,
    'already_reported', false
  );
end;
$function$;

revoke all on function public.report_reservation_payment(uuid, text) from public;
grant execute on function public.report_reservation_payment(uuid, text) to authenticated;
