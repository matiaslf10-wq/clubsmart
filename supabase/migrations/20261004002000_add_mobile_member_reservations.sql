create or replace function public.get_bookable_space_slots(
  p_space_id uuid,
  p_selected_date date
)
returns table (
  start_date date,
  end_date date,
  start_time time without time zone,
  end_time time without time zone,
  label text,
  slot_key text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_space public.club_spaces%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Debes iniciar sesión para consultar turnos.'
      using errcode = '42501';
  end if;

  select cs.*
    into v_space
  from public.club_spaces cs
  where cs.id = p_space_id
    and cs.active = true
    and cs.publicly_bookable = true;

  if not found then
    raise exception 'El espacio no está disponible para reservas.';
  end if;

  if not exists (
    select 1
    from public.member_accounts ma
    join public.members m
      on m.id = ma.member_id
    where ma.user_id = v_user_id
      and ma.active = true
      and m.active = true
      and m.organization_id = v_space.organization_id
      and m.club_id = v_space.club_id
  ) then
    raise exception 'No tienes un vínculo activo con este club.'
      using errcode = '42501';
  end if;

  return query
  with windows as (
    /*
     * Disponibilidad que comienza en la fecha seleccionada.
     */
    select
      p_selected_date::timestamp + sa.start_time as window_start,
      p_selected_date::timestamp + sa.end_time
        + case
            when sa.ends_next_day then interval '1 day'
            else interval '0 day'
          end as window_end
    from public.space_availability sa
    where sa.organization_id = v_space.organization_id
      and sa.club_id = v_space.club_id
      and sa.space_id = v_space.id
      and sa.active = true
      and sa.day_of_week = extract(isodow from p_selected_date)::integer

    union all

    /*
     * Tramo posterior a medianoche de una disponibilidad
     * iniciada el día anterior.
     */
    select
      (p_selected_date - 1)::timestamp + sa.start_time as window_start,
      (p_selected_date - 1)::timestamp + sa.end_time + interval '1 day'
        as window_end
    from public.space_availability sa
    where sa.organization_id = v_space.organization_id
      and sa.club_id = v_space.club_id
      and sa.space_id = v_space.id
      and sa.active = true
      and sa.ends_next_day = true
      and sa.day_of_week =
        extract(isodow from (p_selected_date - 1))::integer
  ),
  candidates as (
    select
      generated.starts_at,
      generated.starts_at
        + make_interval(mins => v_space.minimum_reservation_minutes)
        as ends_at
    from windows w
    cross join lateral (
      select gs as starts_at
      from generate_series(
        w.window_start,
        w.window_end
          - make_interval(mins => v_space.minimum_reservation_minutes),
        make_interval(mins => v_space.slot_interval_minutes)
      ) gs
    ) generated
    where generated.starts_at >= p_selected_date::timestamp
      and generated.starts_at < p_selected_date::timestamp + interval '1 day'
  ),
  available as (
    select distinct
      c.starts_at,
      c.ends_at
    from candidates c
    where not exists (
      select 1
      from public.space_reservations sr
      where sr.organization_id = v_space.organization_id
        and sr.club_id = v_space.club_id
        and sr.space_id = v_space.id
        and sr.status in ('pending', 'confirmed')
        and tsrange(
          sr.reservation_date + sr.start_time,
          sr.reservation_end_date + sr.end_time,
          '[)'
        ) && tsrange(
          c.starts_at,
          c.ends_at,
          '[)'
        )
    )
  )
  select
    a.starts_at::date,
    a.ends_at::date,
    a.starts_at::time,
    a.ends_at::time,
    to_char(a.starts_at, 'HH24:MI')
      || '–'
      || to_char(a.ends_at, 'HH24:MI')
      || case
           when a.starts_at::date <> a.ends_at::date
             then ' · termina al día siguiente'
           else ''
         end,
    to_char(a.starts_at, 'YYYY-MM-DD')
      || '|'
      || to_char(a.starts_at, 'HH24:MI')
      || '|'
      || to_char(a.ends_at, 'YYYY-MM-DD')
      || '|'
      || to_char(a.ends_at, 'HH24:MI')
  from available a
  order by a.starts_at;
end;
$$;

revoke execute on function public.get_bookable_space_slots(uuid, date)
  from public, anon;

grant execute on function public.get_bookable_space_slots(uuid, date)
  to authenticated;


create or replace function public.create_linked_member_reservation(
  p_member_id uuid,
  p_space_id uuid,
  p_slot_key text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_member public.members%rowtype;
  v_relation public.member_account_relation_type;
  v_space public.club_spaces%rowtype;

  v_start_date date;
  v_end_date date;
  v_start_time time without time zone;
  v_end_time time without time zone;

  v_amount numeric;
  v_deposit_amount numeric := 0;
  v_automatic_confirmation boolean;
  v_reservation_code text;
  v_reservation public.space_reservations%rowtype;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Debes iniciar sesión para realizar una reserva.'
      using errcode = '42501';
  end if;

  select ma.relation_type
    into v_relation
  from public.member_accounts ma
  where ma.user_id = v_user_id
    and ma.member_id = p_member_id
    and ma.active = true
  limit 1;

  if not found then
    raise exception 'No tienes acceso a esta persona.'
      using errcode = '42501';
  end if;

  select m.*
    into v_member
  from public.members m
  where m.id = p_member_id
    and m.active = true;

  if not found then
    raise exception 'La persona no está activa.'
      using errcode = '42501';
  end if;

  if v_relation not in ('self', 'guardian') then
    raise exception 'Este vínculo no permite realizar reservas.'
      using errcode = '42501';
  end if;

  select cs.*
    into v_space
  from public.club_spaces cs
  where cs.id = p_space_id
    and cs.organization_id = v_member.organization_id
    and cs.club_id = v_member.club_id
    and cs.active = true
    and cs.publicly_bookable = true;

  if not found then
    raise exception 'El espacio no está disponible para reservas.';
  end if;

  if p_slot_key is null
     or p_slot_key !~
       '^\d{4}-\d{2}-\d{2}\|\d{2}:\d{2}\|\d{4}-\d{2}-\d{2}\|\d{2}:\d{2}$'
  then
    raise exception 'El turno seleccionado no es válido.';
  end if;

  begin
    v_start_date := split_part(p_slot_key, '|', 1)::date;
    v_start_time := split_part(p_slot_key, '|', 2)::time;
    v_end_date := split_part(p_slot_key, '|', 3)::date;
    v_end_time := split_part(p_slot_key, '|', 4)::time;
  exception
    when others then
      raise exception 'El turno seleccionado no es válido.';
  end;

  /*
   * Se vuelve a generar la disponibilidad en servidor.
   * El cliente nunca decide por sí mismo si el turno sigue libre.
   */
  if not exists (
    select 1
    from public.get_bookable_space_slots(
      p_space_id,
      v_start_date
    ) slot
    where slot.slot_key = p_slot_key
  ) then
    raise exception
      'Ese turno acaba de dejar de estar disponible. Elegí otro horario.';
  end if;

  v_amount := coalesce(v_space.price, 0);

  if v_space.requires_deposit then
    if v_space.deposit_type = 'fixed' then
      v_deposit_amount := coalesce(v_space.deposit_value, 0);
    elsif v_space.deposit_type = 'percentage' then
      v_deposit_amount :=
        v_amount * coalesce(v_space.deposit_value, 0) / 100;
    end if;

    v_deposit_amount :=
      least(v_deposit_amount, v_amount);
  end if;

  v_automatic_confirmation :=
    v_space.confirmation_mode = 'automatic'
    and not v_space.requires_deposit;

  v_reservation_code :=
    'CS-' ||
    upper(
      substr(
        replace(gen_random_uuid()::text, '-', ''),
        1,
        10
      )
    );

  begin
    insert into public.space_reservations (
      organization_id,
      club_id,
      space_id,
      member_id,
      reservation_code,
      customer_name,
      customer_email,
      customer_phone,
      reservation_date,
      reservation_end_date,
      start_time,
      end_time,
      status,
      amount,
      deposit_amount,
      paid_amount,
      payment_status,
      source,
      notes,
      created_by_user_id,
      confirmed_by_user_id,
      confirmed_at
    )
    values (
      v_member.organization_id,
      v_member.club_id,
      v_space.id,
      v_member.id,
      v_reservation_code,
      trim(v_member.first_name || ' ' || v_member.last_name),
      v_member.email,
      v_member.phone,
      v_start_date,
      v_end_date,
      v_start_time,
      v_end_time,
      case
        when v_automatic_confirmation then 'confirmed'
        else 'pending'
      end,
      v_amount,
      v_deposit_amount,
      0,
      'unpaid',
      'public',
      nullif(trim(coalesce(p_notes, '')), ''),
      v_user_id,
      case
        when v_automatic_confirmation then v_user_id
        else null
      end,
      case
        when v_automatic_confirmation then now()
        else null
      end
    )
    returning *
      into v_reservation;

  exception
    when exclusion_violation then
      raise exception
        'Ese turno acaba de ser reservado por otra persona. Elegí otro horario.';
    when unique_violation then
      raise exception
        'No pudimos generar el código de reserva. Intentá nuevamente.';
  end;

  return jsonb_build_object(
    'id', v_reservation.id,
    'reservation_code', v_reservation.reservation_code,
    'space_id', v_reservation.space_id,
    'member_id', v_reservation.member_id,
    'reservation_date', v_reservation.reservation_date,
    'reservation_end_date', v_reservation.reservation_end_date,
    'start_time', v_reservation.start_time,
    'end_time', v_reservation.end_time,
    'status', v_reservation.status,
    'amount', v_reservation.amount,
    'deposit_amount', v_reservation.deposit_amount,
    'paid_amount', v_reservation.paid_amount,
    'payment_status', v_reservation.payment_status
  );
end;
$$;

revoke execute on function public.create_linked_member_reservation(
  uuid,
  uuid,
  text,
  text
) from public, anon;

grant execute on function public.create_linked_member_reservation(
  uuid,
  uuid,
  text,
  text
) to authenticated;

