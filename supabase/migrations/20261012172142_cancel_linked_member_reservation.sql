create or replace function public.cancel_linked_member_reservation(
  p_reservation_id uuid
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
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Debes iniciar sesión para cancelar una reserva.'
      using errcode = '42501';
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
    raise exception 'Este vínculo no permite cancelar reservas.'
      using errcode = '42501';
  end if;

  if v_reservation.status in ('cancelled', 'rejected', 'completed') then
    return jsonb_build_object(
      'id', v_reservation.id,
      'status', v_reservation.status,
      'already_final', true
    );
  end if;

  update public.space_reservations
  set
    status = 'cancelled',
    updated_at = now()
  where id = p_reservation_id
    and organization_id = v_reservation.organization_id
    and club_id = v_reservation.club_id
    and status not in ('cancelled', 'rejected', 'completed');

  return jsonb_build_object(
    'id', v_reservation.id,
    'status', 'cancelled',
    'already_final', false
  );
end;
$function$;

revoke all on function public.cancel_linked_member_reservation(uuid) from public;
grant execute on function public.cancel_linked_member_reservation(uuid) to authenticated;
