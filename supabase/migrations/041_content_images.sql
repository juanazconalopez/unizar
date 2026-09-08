-- Imágenes pegadas dentro de avisos, tareas y planes de entrenamiento.
-- El texto conserva referencias [[imagen:uuid]] y los archivos permanecen en
-- un bucket privado. Las relaciones permiten aplicar la misma visibilidad que
-- el contenido que contiene cada imagen y reutilizarla sin duplicar archivos.

create table public.content_images (
  id uuid primary key,
  storage_path text not null unique,
  mime_type text not null default 'image/webp',
  size_bytes integer not null,
  width integer not null,
  height integer not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),

  constraint content_images_path_format check (
    storage_path = created_by::text || '/' || id::text || '.webp'
  ),
  constraint content_images_mime_type check (mime_type = 'image/webp'),
  constraint content_images_size check (size_bytes between 1 and 614400),
  constraint content_images_dimensions check (
    width between 1 and 1600 and height between 1 and 1600
  )
);

create table public.content_image_references (
  image_id uuid not null references public.content_images(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),

  constraint content_image_references_pkey primary key (image_id, entity_type, entity_id),
  constraint content_image_references_entity_type check (
    entity_type in ('task', 'announcement', 'training_plan', 'training_preset')
  )
);

create index content_image_references_entity_idx
on public.content_image_references (entity_type, entity_id);

alter table public.content_images enable row level security;
alter table public.content_image_references enable row level security;

create or replace function public.current_user_can_read_content_image(checked_image_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    public.current_user_can_manage_sport()
    or (
      public.current_user_can_manage_tasks()
      and exists (
        select 1 from public.content_image_references reference
        where reference.image_id = checked_image_id
          and reference.entity_type = 'task'
      )
    )
    or (
      public.current_user_is_active_player()
      and (
        exists (
          select 1
          from public.content_image_references reference
          join public.tasks task
            on reference.entity_type = 'task' and task.id = reference.entity_id
          join public.season_players membership
            on membership.season_id = task.season_id
           and membership.player_id = (select auth.uid())
          where reference.image_id = checked_image_id
            and task.status = 'published'
            and task.week_start + 6 >= membership.active_from
            and (membership.active_until is null or task.week_start <= membership.active_until)
        )
        or exists (
          select 1
          from public.content_image_references reference
          join public.team_announcements announcement
            on reference.entity_type = 'announcement' and announcement.id = reference.entity_id
          join public.season_players membership
            on membership.season_id = announcement.season_id
           and membership.player_id = (select auth.uid())
          where reference.image_id = checked_image_id
            and announcement.status = 'published'
            and announcement.announcement_date >= membership.active_from
            and (
              membership.active_until is null
              or announcement.announcement_date <= membership.active_until
            )
        )
      )
    );
$$;

revoke all on function public.current_user_can_read_content_image(uuid) from public;
grant execute on function public.current_user_can_read_content_image(uuid) to authenticated;

create policy "Eligible users can read content image metadata"
on public.content_images for select to authenticated
using ((select public.current_user_can_read_content_image(id)));

create policy "Sport managers can create content image metadata"
on public.content_images for insert to authenticated
with check (
  (select public.current_user_can_manage_sport())
  and created_by = (select auth.uid())
  and storage_path = created_by::text || '/' || id::text || '.webp'
);

create policy "Sport managers can read content image references"
on public.content_image_references for select to authenticated
using ((select public.current_user_can_manage_sport()));

create or replace function public.cleanup_content_images(checked_image_ids uuid[])
returns table (storage_path text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_can_manage_sport() then
    raise exception 'No tienes permiso para eliminar imágenes';
  end if;

  return query
  delete from public.content_images image
  where image.id = any(coalesce(checked_image_ids, '{}'::uuid[]))
    and not exists (
      select 1 from public.content_image_references reference
      where reference.image_id = image.id
    )
  returning image.storage_path;
end;
$$;

create or replace function public.cleanup_my_abandoned_content_images()
returns table (storage_path text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_can_manage_sport() then
    raise exception 'No tienes permiso para eliminar imágenes';
  end if;

  return query
  delete from public.content_images image
  where image.created_by = (select auth.uid())
    and image.created_at < now() - interval '24 hours'
    and not exists (
      select 1 from public.content_image_references reference
      where reference.image_id = image.id
    )
  returning image.storage_path;
end;
$$;

revoke all on function public.cleanup_content_images(uuid[]) from public;
revoke all on function public.cleanup_my_abandoned_content_images() from public;
grant execute on function public.cleanup_content_images(uuid[]) to authenticated;
grant execute on function public.cleanup_my_abandoned_content_images() to authenticated;

-- Los disparadores derivan las relaciones desde las referencias del texto. Así
-- el contenido y sus permisos quedan guardados en la misma transacción incluso
-- si se crea desde otro cliente o desde el editor SQL.
create or replace function public.content_image_ids_from_text(checked_text text)
returns setof uuid language sql immutable set search_path = '' as $$
  select parts[1]::uuid
  from regexp_matches(
    coalesce(checked_text, ''),
    '\[\[imagen:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})\]\]',
    'g'
  ) as matched(parts);
$$;

create or replace function public.sync_derived_content_image_references(
  checked_entity_type text,
  checked_entity_id uuid,
  checked_image_ids uuid[]
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  normalized_image_ids uuid[];
begin
  select coalesce(array_agg(distinct image_id), '{}'::uuid[])
  into normalized_image_ids
  from unnest(coalesce(checked_image_ids, '{}'::uuid[])) as selected(image_id);

  if cardinality(normalized_image_ids) > 24 then
    raise exception 'Un contenido no puede contener más de 24 imágenes';
  end if;

  delete from public.content_image_references reference
  where reference.entity_type = checked_entity_type
    and reference.entity_id = checked_entity_id
    and not (reference.image_id = any(normalized_image_ids));

  insert into public.content_image_references (image_id, entity_type, entity_id)
  select image_id, checked_entity_type, checked_entity_id
  from unnest(normalized_image_ids) selected(image_id)
  on conflict do nothing;
end;
$$;

create or replace function public.sync_task_content_image_references()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_derived_content_image_references(
    'task', new.id,
    array(select public.content_image_ids_from_text(new.description))
  );
  return new;
end;
$$;

create or replace function public.sync_announcement_content_image_references()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_derived_content_image_references(
    'announcement', new.id,
    array(select public.content_image_ids_from_text(new.description))
  );
  return new;
end;
$$;

create or replace function public.sync_training_plan_content_image_references(checked_plan_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.training_plans where id = checked_plan_id) then
    return;
  end if;

  perform public.sync_derived_content_image_references(
    'training_plan', checked_plan_id,
    array(
      select public.content_image_ids_from_text(plan.objectives)
      from public.training_plans plan where plan.id = checked_plan_id
      union
      select public.content_image_ids_from_text(plan.material)
      from public.training_plans plan where plan.id = checked_plan_id
      union
      select public.content_image_ids_from_text(exercise.description)
      from public.training_exercises exercise where exercise.training_plan_id = checked_plan_id
    )
  );
end;
$$;

create or replace function public.sync_training_plan_row_content_image_references()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_training_plan_content_image_references(new.id);
  return new;
end;
$$;

create or replace function public.sync_training_exercise_content_image_references()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_training_plan_content_image_references(old.training_plan_id);
    return old;
  end if;

  perform public.sync_training_plan_content_image_references(new.training_plan_id);
  return new;
end;
$$;

create or replace function public.sync_training_preset_content_image_references()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_derived_content_image_references(
    'training_preset', new.id,
    array(select public.content_image_ids_from_text(new.description))
  );
  return new;
end;
$$;

create trigger tasks_sync_content_image_references
after insert or update of description on public.tasks for each row
execute function public.sync_task_content_image_references();

create trigger announcements_sync_content_image_references
after insert or update of description on public.team_announcements for each row
execute function public.sync_announcement_content_image_references();

create trigger training_plans_sync_content_image_references
after insert or update of objectives, material on public.training_plans for each row
execute function public.sync_training_plan_row_content_image_references();

create trigger training_exercises_sync_content_image_references
after insert or update of description on public.training_exercises for each row
execute function public.sync_training_exercise_content_image_references();

create trigger training_exercises_delete_content_image_references
after delete on public.training_exercises for each row
execute function public.sync_training_exercise_content_image_references();

create trigger training_presets_sync_content_image_references
after insert or update of description on public.training_exercise_presets for each row
execute function public.sync_training_preset_content_image_references();

revoke all on function public.content_image_ids_from_text(text) from public;
revoke all on function public.sync_derived_content_image_references(text, uuid, uuid[]) from public;
revoke all on function public.sync_task_content_image_references() from public;
revoke all on function public.sync_announcement_content_image_references() from public;
revoke all on function public.sync_training_plan_content_image_references(uuid) from public;
revoke all on function public.sync_training_plan_row_content_image_references() from public;
revoke all on function public.sync_training_exercise_content_image_references() from public;
revoke all on function public.sync_training_preset_content_image_references() from public;

create or replace function public.remove_deleted_content_image_references()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.content_image_references
  where entity_type = tg_argv[0] and entity_id = old.id;
  return old;
end;
$$;

revoke all on function public.remove_deleted_content_image_references() from public;

create trigger tasks_remove_content_image_references
after delete on public.tasks for each row
execute function public.remove_deleted_content_image_references('task');

create trigger announcements_remove_content_image_references
after delete on public.team_announcements for each row
execute function public.remove_deleted_content_image_references('announcement');

create trigger training_plans_remove_content_image_references
after delete on public.training_plans for each row
execute function public.remove_deleted_content_image_references('training_plan');

create trigger training_presets_remove_content_image_references
after delete on public.training_exercise_presets for each row
execute function public.remove_deleted_content_image_references('training_preset');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-images', 'content-images', false, 614400, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Eligible users can read private content images"
on storage.objects for select to authenticated
using (
  bucket_id = 'content-images'
  and exists (
    select 1 from public.content_images image
    where image.storage_path = name
      and public.current_user_can_read_content_image(image.id)
  )
);

create policy "Sport managers can upload private content images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'content-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.current_user_can_manage_sport())
);

create policy "Sport managers can delete private content images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'content-images'
  and (select public.current_user_can_manage_sport())
);

revoke insert, update, delete on public.content_image_references from authenticated;
revoke update, delete on public.content_images from authenticated;
grant select, insert on public.content_images to authenticated;
grant select on public.content_image_references to authenticated;
