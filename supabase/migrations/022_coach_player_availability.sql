-- Los entrenadores pueden registrar una respuesta comunicada por una jugadora.
-- El historial separado permite auditar estos cambios sin alterar su comentario.
create table public.match_availability_coach_changes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  changed_by uuid not null references public.profiles(id),
  status public.availability_status not null,
  comment text,
  changed_at timestamptz not null default now()
);

create index match_availability_coach_changes_match_idx
  on public.match_availability_coach_changes (match_id, changed_at desc);

alter table public.match_availability_coach_changes enable row level security;

create policy "Team staff can read coach availability changes"
on public.match_availability_coach_changes for select to authenticated
using ((select public.current_user_can_view_team_data()));

create or replace function public.set_player_match_availability(
  checked_match_id uuid,
  checked_player_id uuid,
  checked_status public.availability_status,
  checked_comment text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  normalized_comment text := nullif(trim(coalesce(checked_comment, '')), '');
  is_lineup_published boolean;
begin
  if not exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_coach
      and is_approved
      and is_active
      and not is_archived
  ) then
    raise exception 'Solo un entrenador activo puede modificar la disponibilidad de otra jugadora';
  end if;

  if length(coalesce(normalized_comment, '')) > 500 then
    raise exception 'El comentario no puede superar los 500 caracteres';
  end if;

  select lineup_published into is_lineup_published
  from public.matches
  where id = checked_match_id and status = 'published'::public.match_status;

  if not found then
    raise exception 'El partido no está disponible para registrar respuestas';
  end if;

  if is_lineup_published then
    raise exception 'Desbloquea la convocatoria antes de modificar disponibilidades';
  end if;

  if not public.player_can_access_match(checked_match_id, checked_player_id) then
    raise exception 'La jugadora no pertenece a la temporada de este partido';
  end if;

  insert into public.match_availability (match_id, player_id, status, comment)
  values (checked_match_id, checked_player_id, checked_status, normalized_comment)
  on conflict (match_id, player_id) do update
    set status = excluded.status, comment = excluded.comment;

  insert into public.match_availability_coach_changes (
    match_id, player_id, changed_by, status, comment
  ) values (
    checked_match_id, checked_player_id, (select auth.uid()), checked_status, normalized_comment
  );
end;
$$;

revoke all on function public.set_player_match_availability(uuid,uuid,public.availability_status,text) from public;
grant execute on function public.set_player_match_availability(uuid,uuid,public.availability_status,text) to authenticated;
