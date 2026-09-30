insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'member-photos',
  'member-photos',
  false,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id)
do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists member_photos_select_linked
on storage.objects;

create policy member_photos_select_linked
on storage.objects
for select
to authenticated
using (
  bucket_id = 'member-photos'
  and exists (
    select 1
    from public.members m
    where m.id::text =
      (storage.foldername(name))[1]
      and (
        exists (
          select 1
          from public.member_accounts ma
          where ma.member_id = m.id
            and ma.user_id = auth.uid()
            and ma.active = true
        )
        or exists (
          select 1
          from public.organization_users ou
          where ou.organization_id = m.organization_id
            and ou.user_id = auth.uid()
            and ou.active = true
            and ou.role::text in ('owner', 'admin')
        )
      )
  )
);

drop policy if exists member_photos_insert_linked
on storage.objects;

create policy member_photos_insert_linked
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'member-photos'
  and exists (
    select 1
    from public.members m
    where m.id::text =
      (storage.foldername(name))[1]
      and (
        exists (
          select 1
          from public.member_accounts ma
          where ma.member_id = m.id
            and ma.user_id = auth.uid()
            and ma.active = true
            and ma.relation_type::text in (
              'self',
              'guardian'
            )
        )
        or exists (
          select 1
          from public.organization_users ou
          where ou.organization_id = m.organization_id
            and ou.user_id = auth.uid()
            and ou.active = true
            and ou.role::text in ('owner', 'admin')
        )
      )
  )
);

drop policy if exists member_photos_update_linked
on storage.objects;

create policy member_photos_update_linked
on storage.objects
for update
to authenticated
using (
  bucket_id = 'member-photos'
  and exists (
    select 1
    from public.members m
    where m.id::text =
      (storage.foldername(name))[1]
      and (
        exists (
          select 1
          from public.member_accounts ma
          where ma.member_id = m.id
            and ma.user_id = auth.uid()
            and ma.active = true
            and ma.relation_type::text in (
              'self',
              'guardian'
            )
        )
        or exists (
          select 1
          from public.organization_users ou
          where ou.organization_id = m.organization_id
            and ou.user_id = auth.uid()
            and ou.active = true
            and ou.role::text in ('owner', 'admin')
        )
      )
  )
)
with check (
  bucket_id = 'member-photos'
  and exists (
    select 1
    from public.members m
    where m.id::text =
      (storage.foldername(name))[1]
      and (
        exists (
          select 1
          from public.member_accounts ma
          where ma.member_id = m.id
            and ma.user_id = auth.uid()
            and ma.active = true
            and ma.relation_type::text in (
              'self',
              'guardian'
            )
        )
        or exists (
          select 1
          from public.organization_users ou
          where ou.organization_id = m.organization_id
            and ou.user_id = auth.uid()
            and ou.active = true
            and ou.role::text in ('owner', 'admin')
        )
      )
  )
);

drop policy if exists member_photos_delete_linked
on storage.objects;

create policy member_photos_delete_linked
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'member-photos'
  and exists (
    select 1
    from public.members m
    where m.id::text =
      (storage.foldername(name))[1]
      and (
        exists (
          select 1
          from public.member_accounts ma
          where ma.member_id = m.id
            and ma.user_id = auth.uid()
            and ma.active = true
            and ma.relation_type::text in (
              'self',
              'guardian'
            )
        )
        or exists (
          select 1
          from public.organization_users ou
          where ou.organization_id = m.organization_id
            and ou.user_id = auth.uid()
            and ou.active = true
            and ou.role::text in ('owner', 'admin')
        )
      )
  )
);
