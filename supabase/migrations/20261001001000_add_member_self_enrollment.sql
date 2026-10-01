create or replace function public.enroll_linked_member_in_activity(
  p_member_id uuid,
  p_activity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();

  v_organization_id uuid;
  v_club_id uuid;
  v_member_active boolean;
  v_relation_type text;

  v_activity_name text;
  v_enrollment_open boolean;
  v_activity_active boolean;
  v_is_published boolean;
  v_capacity integer;

  v_active_enrollments integer;
  v_enrollment_id uuid;
  v_enrollment_created boolean := false;

  v_fee_rate_id uuid;
  v_fee_amount numeric;
  v_fee_id uuid;
  v_fee_created boolean := false;

  v_year integer := extract(year from current_date)::integer;
  v_month integer := extract(month from current_date)::integer;
begin
  if v_user_id is null then
    raise exception 'Tenés que iniciar sesión para inscribirte.';
  end if;

  select
    m.organization_id,
    m.club_id,
    m.active,
    ma.relation_type::text
  into
    v_organization_id,
    v_club_id,
    v_member_active,
    v_relation_type
  from public.members m
  join public.member_accounts ma
    on ma.member_id = m.id
   and ma.user_id = v_user_id
   and ma.active = true
  where m.id = p_member_id
  limit 1;

  if v_organization_id is null then
    raise exception 'No tenés acceso a esta persona.';
  end if;

  if not v_member_active then
    raise exception 'La persona seleccionada no está activa en el club.';
  end if;

  if v_relation_type not in ('self', 'guardian') then
    raise exception 'Este vínculo no permite realizar inscripciones.';
  end if;

  select
    a.name,
    a.enrollment_open,
    a.active,
    a.is_published,
    a.capacity
  into
    v_activity_name,
    v_enrollment_open,
    v_activity_active,
    v_is_published,
    v_capacity
  from public.activities a
  where a.id = p_activity_id
    and a.organization_id = v_organization_id
    and a.club_id = v_club_id
  for update;

  if v_activity_name is null then
    raise exception 'La actividad no pertenece al club de la persona seleccionada.';
  end if;

  if not v_activity_active or not v_is_published then
    raise exception 'La actividad ya no está disponible.';
  end if;

  if not v_enrollment_open then
    raise exception 'La inscripción a esta actividad está cerrada.';
  end if;

  select ma.id
  into v_enrollment_id
  from public.member_activities ma
  where ma.member_id = p_member_id
    and ma.activity_id = p_activity_id
    and ma.active = true
    and ma.start_date <= current_date
    and (ma.end_date is null or ma.end_date >= current_date)
  limit 1;

  if v_enrollment_id is null then
    if v_capacity is not null then
      select count(*)
      into v_active_enrollments
      from public.member_activities ma
      where ma.activity_id = p_activity_id
        and ma.active = true
        and ma.start_date <= current_date
        and (ma.end_date is null or ma.end_date >= current_date);

      if v_active_enrollments >= v_capacity then
        raise exception 'La actividad alcanzó su cupo máximo.';
      end if;
    end if;

    insert into public.member_activities (
      organization_id,
      club_id,
      member_id,
      activity_id,
      active,
      start_date
    )
    values (
      v_organization_id,
      v_club_id,
      p_member_id,
      p_activity_id,
      true,
      current_date
    )
    returning id into v_enrollment_id;

    v_enrollment_created := true;
  end if;

  select
    afr.id,
    afr.amount
  into
    v_fee_rate_id,
    v_fee_amount
  from public.activity_fee_rates afr
  where afr.organization_id = v_organization_id
    and afr.club_id = v_club_id
    and afr.activity_id = p_activity_id
    and afr.valid_from <= current_date
    and (afr.valid_to is null or afr.valid_to >= current_date)
  order by afr.valid_from desc, afr.created_at desc
  limit 1;

  if v_fee_rate_id is not null then
    insert into public.monthly_fees (
      organization_id,
      club_id,
      member_id,
      activity_id,
      year,
      month,
      amount,
      paid_amount,
      status,
      fee_rate_id
    )
    values (
      v_organization_id,
      v_club_id,
      p_member_id,
      p_activity_id,
      v_year,
      v_month,
      v_fee_amount,
      0,
      'pending',
      v_fee_rate_id
    )
    on conflict (member_id, activity_id, year, month)
    do nothing
    returning id into v_fee_id;

    if v_fee_id is not null then
      v_fee_created := true;
    else
      select mf.id
      into v_fee_id
      from public.monthly_fees mf
      where mf.member_id = p_member_id
        and mf.activity_id = p_activity_id
        and mf.year = v_year
        and mf.month = v_month;
    end if;
  end if;

  return jsonb_build_object(
    'activity_id', p_activity_id,
    'activity_name', v_activity_name,
    'enrollment_id', v_enrollment_id,
    'enrollment_created', v_enrollment_created,
    'fee_id', v_fee_id,
    'fee_created', v_fee_created,
    'fee_amount', v_fee_amount,
    'year', v_year,
    'month', v_month
  );
end;
$function$;

revoke all on function public.enroll_linked_member_in_activity(uuid, uuid) from public;
revoke all on function public.enroll_linked_member_in_activity(uuid, uuid) from anon;
grant execute on function public.enroll_linked_member_in_activity(uuid, uuid) to authenticated;
