-- Reconciles the commercial subscription schema over the historical baseline.
-- This migration is non-destructive and does not backfill or alter data.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Commercial subscription reconciliation requires public.organizations';
  end if;

  if to_regtype('public.organization_role') is null then
    raise exception 'Commercial subscription reconciliation requires public.organization_role';
  end if;

  if to_regprocedure('private.has_organization_role(uuid,public.organization_role[])') is null then
    raise exception 'Commercial subscription reconciliation requires private.has_organization_role(uuid, public.organization_role[])';
  end if;

  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Commercial subscription reconciliation requires public.set_updated_at()';
  end if;
end;
$$;

do $$
begin
  if to_regtype('public.subscription_plan') is null then
    create type public.subscription_plan as enum (
      'essential',
      'pro',
      'intelligence'
    );
  end if;

  if to_regtype('public.subscription_status') is null then
    create type public.subscription_status as enum (
      'trial',
      'active',
      'past_due',
      'paused',
      'cancelled'
    );
  end if;
end;
$$;

do $$
declare
  required_value text;
begin
  foreach required_value in array array[
    'essential',
    'pro',
    'intelligence'
  ] loop
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typname = 'subscription_plan'
        and e.enumlabel = required_value
    ) then
      raise exception 'public.subscription_plan is missing required value: %', required_value;
    end if;
  end loop;

  foreach required_value in array array[
    'trial',
    'active',
    'past_due',
    'paused',
    'cancelled'
  ] loop
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typname = 'subscription_status'
        and e.enumlabel = required_value
    ) then
      raise exception 'public.subscription_status is missing required value: %', required_value;
    end if;
  end loop;
end;
$$;

do $$
declare
  required_value text;
begin
  if to_regclass('public.subscriptions') is null then
    create table public.subscriptions (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null,
      plan public.subscription_plan not null default 'essential',
      status public.subscription_status not null default 'trial',
      trial_ends_at timestamp with time zone,
      current_period_starts_at timestamp with time zone,
      current_period_ends_at timestamp with time zone,
      created_at timestamp with time zone not null default now(),
      updated_at timestamp with time zone not null default now(),

      constraint subscriptions_one_per_organization
        unique (organization_id),

      constraint subscriptions_organization_id_fkey
        foreign key (organization_id)
        references public.organizations(id)
        on delete cascade
    );
  else
    alter table public.subscriptions
      add column if not exists trial_ends_at timestamp with time zone,
      add column if not exists current_period_starts_at timestamp with time zone,
      add column if not exists current_period_ends_at timestamp with time zone;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'subscriptions'
        and column_name = 'id'
        and udt_schema = 'pg_catalog'
        and udt_name = 'uuid'
        and is_nullable = 'NO'
    ) then
      raise exception 'public.subscriptions.id is missing or incompatible';
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'subscriptions'
        and column_name = 'organization_id'
        and udt_schema = 'pg_catalog'
        and udt_name = 'uuid'
        and is_nullable = 'NO'
    ) then
      raise exception 'public.subscriptions.organization_id is missing or incompatible';
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'subscriptions'
        and column_name = 'plan'
        and udt_schema = 'public'
        and udt_name = 'subscription_plan'
        and is_nullable = 'NO'
    ) then
      raise exception 'public.subscriptions.plan is missing or incompatible';
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'subscriptions'
        and column_name = 'status'
        and udt_schema = 'public'
        and udt_name = 'subscription_status'
        and is_nullable = 'NO'
    ) then
      raise exception 'public.subscriptions.status is missing or incompatible';
    end if;

    foreach required_value in array array[
      'trial_ends_at',
      'current_period_starts_at',
      'current_period_ends_at'
    ] loop
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'subscriptions'
          and column_name = required_value
          and data_type = 'timestamp with time zone'
      ) then
        raise exception 'public.subscriptions.% is missing or incompatible', required_value;
      end if;
    end loop;

    foreach required_value in array array[
      'created_at',
      'updated_at'
    ] loop
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'subscriptions'
          and column_name = required_value
          and data_type = 'timestamp with time zone'
          and is_nullable = 'NO'
      ) then
        raise exception 'public.subscriptions.% is missing or incompatible', required_value;
      end if;
    end loop;
  end if;
end;
$$;

do $$
declare
  column_default text;
  required_value text;
begin
  select pg_get_expr(ad.adbin, ad.adrelid)
  into column_default
  from pg_attribute a
  join pg_attrdef ad
    on ad.adrelid = a.attrelid
   and ad.adnum = a.attnum
  where a.attrelid = 'public.subscriptions'::regclass
    and a.attname = 'id';

  if column_default is null
    or regexp_replace(lower(column_default), '[[:space:]]+', '', 'g') not in (
      'gen_random_uuid()',
      'public.gen_random_uuid()'
    ) then
    raise exception 'public.subscriptions.id has an incompatible default: %', column_default;
  end if;

  select pg_get_expr(ad.adbin, ad.adrelid)
  into column_default
  from pg_attribute a
  join pg_attrdef ad
    on ad.adrelid = a.attrelid
   and ad.adnum = a.attnum
  where a.attrelid = 'public.subscriptions'::regclass
    and a.attname = 'plan';

  if column_default is null
    or regexp_replace(lower(column_default), '[[:space:]]+', '', 'g') not in (
      '''essential''::public.subscription_plan',
      '''essential''::subscription_plan'
    ) then
    raise exception 'public.subscriptions.plan has an incompatible default: %', column_default;
  end if;

  select pg_get_expr(ad.adbin, ad.adrelid)
  into column_default
  from pg_attribute a
  join pg_attrdef ad
    on ad.adrelid = a.attrelid
   and ad.adnum = a.attnum
  where a.attrelid = 'public.subscriptions'::regclass
    and a.attname = 'status';

  if column_default is null
    or regexp_replace(lower(column_default), '[[:space:]]+', '', 'g') not in (
      '''trial''::public.subscription_status',
      '''trial''::subscription_status'
    ) then
    raise exception 'public.subscriptions.status has an incompatible default: %', column_default;
  end if;

  foreach required_value in array array[
    'created_at',
    'updated_at'
  ] loop
    select pg_get_expr(ad.adbin, ad.adrelid)
    into column_default
    from pg_attribute a
    join pg_attrdef ad
      on ad.adrelid = a.attrelid
     and ad.adnum = a.attnum
    where a.attrelid = 'public.subscriptions'::regclass
      and a.attname = required_value;

    if column_default is null
      or regexp_replace(lower(column_default), '[[:space:]]+', '', 'g') not in (
        'now()',
        'current_timestamp'
      ) then
      raise exception 'public.subscriptions.% has an incompatible default: %', required_value, column_default;
    end if;
  end loop;
end;
$$;

do $$
declare
  id_attnum smallint;
  organization_id_attnum smallint;
  primary_key_columns smallint[];
  primary_key_exists boolean;
  organization_unique_exists boolean;
  organization_unique_incompatible boolean;
  organization_foreign_key_exists boolean;
  organization_foreign_key_incompatible boolean;
begin
  select a.attnum
  into id_attnum
  from pg_attribute a
  where a.attrelid = 'public.subscriptions'::regclass
    and a.attname = 'id'
    and not a.attisdropped;

  select a.attnum
  into organization_id_attnum
  from pg_attribute a
  where a.attrelid = 'public.subscriptions'::regclass
    and a.attname = 'organization_id'
    and not a.attisdropped;

  select c.conkey
  into primary_key_columns
  from pg_constraint c
  where c.conrelid = 'public.subscriptions'::regclass
    and c.contype = 'p';

  primary_key_exists := primary_key_columns is not null;

  if primary_key_exists
    and primary_key_columns <> array[id_attnum]::smallint[] then
    raise exception 'public.subscriptions has an incompatible primary key; expected exactly (id)';
  end if;

  if not primary_key_exists then
    alter table public.subscriptions
      add constraint subscriptions_pkey primary key (id);
  end if;

  select exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.subscriptions'::regclass
      and c.contype = 'u'
      and c.conkey = array[organization_id_attnum]::smallint[]
  )
  into organization_unique_exists;

  select exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.subscriptions'::regclass
      and c.contype = 'u'
      and c.conkey @> array[organization_id_attnum]::smallint[]
      and c.conkey <> array[organization_id_attnum]::smallint[]
  )
  into organization_unique_incompatible;

  if organization_unique_incompatible then
    raise exception 'public.subscriptions has an incompatible UNIQUE constraint involving organization_id; expected exactly (organization_id)';
  end if;

  if not organization_unique_exists then
    alter table public.subscriptions
      add constraint subscriptions_one_per_organization unique (organization_id);
  end if;

  select exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.subscriptions'::regclass
      and c.contype = 'f'
      and c.conkey = array[organization_id_attnum]::smallint[]
      and c.confrelid = 'public.organizations'::regclass
      and c.confkey = array[
        (select a.attnum
         from pg_attribute a
         where a.attrelid = 'public.organizations'::regclass
           and a.attname = 'id'
           and not a.attisdropped)
      ]::smallint[]
      and c.confdeltype = 'c'
  )
  into organization_foreign_key_exists;

  select exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.subscriptions'::regclass
      and c.contype = 'f'
      and c.conkey @> array[organization_id_attnum]::smallint[]
      and not (
        c.conkey = array[organization_id_attnum]::smallint[]
        and c.confrelid = 'public.organizations'::regclass
        and c.confkey = array[
          (select a.attnum
           from pg_attribute a
           where a.attrelid = 'public.organizations'::regclass
             and a.attname = 'id'
             and not a.attisdropped)
        ]::smallint[]
        and c.confdeltype = 'c'
      )
  )
  into organization_foreign_key_incompatible;

  if organization_foreign_key_incompatible then
    raise exception 'public.subscriptions has an incompatible foreign key involving organization_id; expected organizations(id) with ON DELETE CASCADE';
  end if;

  if not organization_foreign_key_exists then
    alter table public.subscriptions
      add constraint subscriptions_organization_id_fkey
      foreign key (organization_id)
      references public.organizations(id)
      on delete cascade;
  end if;
end;
$$;

alter table public.subscriptions enable row level security;

grant select on table public.subscriptions to authenticated;

do $$
declare
  policy_command "char";
  policy_roles oid[];
  policy_qual text;
  normalized_policy_qual text;
begin
  select
    p.polcmd,
    p.polroles,
    pg_get_expr(p.polqual, p.polrelid)
  into
    policy_command,
    policy_roles,
    policy_qual
  from pg_policy p
  where p.polrelid = 'public.subscriptions'::regclass
    and p.polname = 'Owners and admins can read subscriptions';

  if found then
    normalized_policy_qual := regexp_replace(
      lower(coalesce(policy_qual, '')),
      '[[:space:]]+',
      '',
      'g'
    );

    if policy_command <> 'r'
      or policy_roles <> array[
        (select oid from pg_roles where rolname = 'authenticated')
      ]::oid[]
      or normalized_policy_qual not in (
        'private.has_organization_role(organization_id,array[''owner''::public.organization_role,''admin''::public.organization_role])',
        'private.has_organization_role(organization_id,array[''owner''::organization_role,''admin''::organization_role])'
      ) then
      raise exception 'Policy "Owners and admins can read subscriptions" is incompatible';
    end if;
  else
    create policy "Owners and admins can read subscriptions"
      on public.subscriptions
      for select
      to authenticated
      using (
        private.has_organization_role(
          organization_id,
          array[
            'owner'::public.organization_role,
            'admin'::public.organization_role
          ]
        )
      );
  end if;
end;
$$;

do $$
declare
  updated_at_function oid;
  trigger_exists boolean;
  trigger_incompatible boolean;
begin
  updated_at_function := to_regprocedure('public.set_updated_at()')::oid;

  select exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.subscriptions'::regclass
      and t.tgname = 'subscriptions_set_updated_at'
      and not t.tgisinternal
      and (t.tgtype & 2) <> 0
      and (t.tgtype & 1) <> 0
      and (t.tgtype & 16) <> 0
      and (t.tgtype & (4 | 8 | 32)) = 0
      and t.tgfoid = updated_at_function
  )
  into trigger_exists;

  select exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.subscriptions'::regclass
      and t.tgname = 'subscriptions_set_updated_at'
      and not t.tgisinternal
      and not (
        (t.tgtype & 2) <> 0
        and (t.tgtype & 1) <> 0
        and (t.tgtype & 16) <> 0
        and (t.tgtype & (4 | 8 | 32)) = 0
        and t.tgfoid = updated_at_function
      )
  )
  into trigger_incompatible;

  if trigger_incompatible then
    raise exception 'Trigger subscriptions_set_updated_at is incompatible';
  end if;

  if not trigger_exists then
    create trigger subscriptions_set_updated_at
      before update on public.subscriptions
      for each row
      execute function public.set_updated_at();
  end if;
end;
$$;