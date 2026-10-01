-- Asigna una función deportiva a cada entrenador de equipo.
alter table public.season_team_coaches
  add column role text not null default 'assistant_coach';

alter table public.season_team_coaches
  add constraint season_team_coaches_role_check
  check (role in (
    'head_coach',
    'assistant_coach',
    'defense_coach',
    'attack_coach',
    'skills_coach',
    'strength_and_conditioning_coach'
  ));

-- Conserva un entrenador principal por equipo al migrar las asignaciones existentes.
with ranked_coaches as (
  select season_team_id, coach_id,
    row_number() over (partition by season_team_id order by created_at, coach_id) as position
  from public.season_team_coaches
)
update public.season_team_coaches assignment
set role = 'head_coach'
from ranked_coaches ranked
where ranked.season_team_id = assignment.season_team_id
  and ranked.coach_id = assignment.coach_id
  and ranked.position = 1;

create unique index season_team_coaches_one_head_idx
  on public.season_team_coaches (season_team_id)
  where role = 'head_coach';

drop function public.set_season_team_coach(uuid, uuid, boolean);

create function public.save_season_team_coaches(
  checked_team_id uuid,
  checked_assignments jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare head_coach_count integer;
begin
  if not public.current_user_has_permission('seasons.teams') then
    raise exception 'Solo el owner puede asignar entrenadores a equipos';
  end if;
  if jsonb_typeof(checked_assignments) is distinct from 'array' then
    raise exception 'La lista de entrenadores no es válida';
  end if;
  if not exists (select 1 from public.season_teams where id = checked_team_id) then
    raise exception 'El equipo seleccionado no existe';
  end if;
  if exists (
    select assignment.value->>'coach_id'
    from jsonb_array_elements(checked_assignments) assignment(value)
    group by assignment.value->>'coach_id'
    having count(*) > 1
  ) then raise exception 'La lista contiene entrenadores duplicados'; end if;
  if exists (
    select 1 from jsonb_array_elements(checked_assignments) assignment(value)
    where assignment.value->>'coach_id' is null
      or assignment.value->>'assigned' is null
      or assignment.value->>'assigned' not in ('true', 'false')
      or assignment.value->>'role' is null
      or assignment.value->>'role' not in (
        'head_coach',
        'assistant_coach',
        'defense_coach',
        'attack_coach',
        'skills_coach',
        'strength_and_conditioning_coach'
      )
  ) then raise exception 'Uno de los roles de entrenador no es válido'; end if;
  if exists (
    select 1 from jsonb_array_elements(checked_assignments) assignment(value)
    where assignment.value->>'assigned' = 'true'
      and not exists (
        select 1 from public.profiles
        where id = (assignment.value->>'coach_id')::uuid
          and (is_coach or is_owner)
          and is_approved and is_active and not is_archived
      )
  ) then raise exception 'La persona seleccionada no es un entrenador u owner activo'; end if;

  select
    (select count(*) from public.season_team_coaches existing
     where existing.season_team_id = checked_team_id
       and existing.role = 'head_coach'
       and not exists (
         select 1 from jsonb_array_elements(checked_assignments) requested(value)
         where (requested.value->>'coach_id')::uuid = existing.coach_id
       ))
    +
    (select count(*) from jsonb_array_elements(checked_assignments) requested(value)
     where requested.value->>'assigned' = 'true'
       and requested.value->>'role' = 'head_coach')
  into head_coach_count;
  if head_coach_count > 1 then raise exception 'El equipo solo puede tener un head coach'; end if;

  delete from public.season_team_coaches existing
  where existing.season_team_id = checked_team_id
    and exists (
      select 1 from jsonb_array_elements(checked_assignments) requested(value)
      where (requested.value->>'coach_id')::uuid = existing.coach_id
    );

  insert into public.season_team_coaches (season_team_id, coach_id, role)
  select checked_team_id,
    (requested.value->>'coach_id')::uuid,
    requested.value->>'role'
  from jsonb_array_elements(checked_assignments) requested(value)
  where requested.value->>'assigned' = 'true';
end;
$$;

revoke all on function public.save_season_team_coaches(uuid, jsonb) from public;
grant execute on function public.save_season_team_coaches(uuid, jsonb) to authenticated;
