-- Catálogo manual de competiciones en las que participa el equipo durante
-- cada temporada. No sustituye al histórico sincronizado desde MatchReady.

insert into public.permission_definitions (
  key, section_key, section_label, label, description, action,
  parent_key, sort_order, configurable, owner_only
) values (
  'seasons.competitions', 'seasons', 'Temporadas', 'Gestionar competiciones',
  'Crear, editar y eliminar las competiciones de cada temporada.', 'manage',
  'seasons.view', 1550, false, true
);

create table public.season_competitions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  name text not null check (length(trim(name)) > 0 and length(trim(name)) <= 80),
  color text not null check (color in ('purple', 'blue', 'orange', 'red', 'teal', 'pink', 'slate', 'gold')),
  is_default boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, season_id),
  unique (season_id, color)
);

create unique index season_competitions_name_idx
  on public.season_competitions (season_id, lower(trim(name)));
create unique index season_competitions_default_idx
  on public.season_competitions (season_id)
  where is_default;
create index season_competitions_season_idx
  on public.season_competitions (season_id, created_at, id);

alter table public.matches add column competition_id uuid;

create trigger season_competitions_set_updated_at
before update on public.season_competitions
for each row execute function public.set_updated_at();

alter table public.season_competitions enable row level security;

create policy "Match viewers can read season competitions"
on public.season_competitions for select to authenticated
using (
  (select public.current_user_has_permission('matches.view'))
  or (select public.current_user_has_permission('seasons.competitions'))
);

grant select on table public.season_competitions to authenticated;
revoke insert, update, delete on table public.season_competitions from authenticated;

create or replace function public.create_season_competition(
  checked_season_id uuid,
  checked_name text,
  checked_color text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  created_id uuid;
  make_default boolean;
begin
  if not public.current_user_has_permission('seasons.competitions') then
    raise exception 'Solo el owner puede gestionar las competiciones de una temporada';
  end if;
  if nullif(trim(coalesce(checked_name, '')), '') is null then
    raise exception 'Escribe un nombre para la competición';
  end if;
  if checked_color not in ('purple', 'blue', 'orange', 'red', 'teal', 'pink', 'slate', 'gold') then
    raise exception 'El color seleccionado no es válido';
  end if;

  perform 1 from public.seasons where id = checked_season_id for update;
  if not found then raise exception 'La temporada no existe'; end if;

  select not exists (
    select 1 from public.season_competitions where season_id = checked_season_id
  ) into make_default;

  insert into public.season_competitions (season_id, name, color, is_default, created_by)
  values (checked_season_id, trim(checked_name), checked_color, make_default, (select auth.uid()))
  returning id into created_id;
  return created_id;
end;
$$;

create or replace function public.update_season_competition(
  checked_competition_id uuid,
  checked_name text,
  checked_color text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_user_has_permission('seasons.competitions') then
    raise exception 'Solo el owner puede gestionar las competiciones de una temporada';
  end if;
  if nullif(trim(coalesce(checked_name, '')), '') is null then
    raise exception 'Escribe un nombre para la competición';
  end if;
  if checked_color not in ('purple', 'blue', 'orange', 'red', 'teal', 'pink', 'slate', 'gold') then
    raise exception 'El color seleccionado no es válido';
  end if;

  update public.season_competitions
  set name = trim(checked_name), color = checked_color
  where id = checked_competition_id;
  if not found then raise exception 'La competición no existe'; end if;
end;
$$;

create or replace function public.set_default_season_competition(checked_competition_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare checked_season_id uuid;
begin
  if not public.current_user_has_permission('seasons.competitions') then
    raise exception 'Solo el owner puede gestionar las competiciones de una temporada';
  end if;

  select season_id into checked_season_id
  from public.season_competitions where id = checked_competition_id;
  if not found then raise exception 'La competición no existe'; end if;
  perform 1 from public.seasons where id = checked_season_id for update;

  update public.season_competitions
  set is_default = false
  where season_id = checked_season_id and is_default;
  update public.season_competitions
  set is_default = true
  where id = checked_competition_id;
end;
$$;

create or replace function public.delete_season_competition(checked_competition_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  checked_season_id uuid;
  deleted_match_count integer;
  was_default boolean;
begin
  if not public.current_user_has_permission('seasons.competitions') then
    raise exception 'Solo el owner puede gestionar las competiciones de una temporada';
  end if;

  select season_id, is_default into checked_season_id, was_default
  from public.season_competitions where id = checked_competition_id;
  if not found then raise exception 'La competición no existe'; end if;
  perform 1 from public.seasons where id = checked_season_id for update;

  select count(*)::integer into deleted_match_count
  from public.matches where competition_id = checked_competition_id;

  -- Una convocatoria publicada protege sus filas. Se desbloquea dentro de esta
  -- operación owner antes de ejecutar el borrado en cascada solicitado.
  update public.matches
  set lineup_published = false
  where competition_id = checked_competition_id and lineup_published;

  delete from public.season_competitions where id = checked_competition_id;

  if was_default then
    update public.season_competitions
    set is_default = true
    where id = (
      select id from public.season_competitions
      where season_id = checked_season_id
      order by created_at, id
      limit 1
    );
  end if;

  return deleted_match_count;
end;
$$;

revoke all on function public.create_season_competition(uuid,text,text) from public;
revoke all on function public.update_season_competition(uuid,text,text) from public;
revoke all on function public.set_default_season_competition(uuid) from public;
revoke all on function public.delete_season_competition(uuid) from public;
grant execute on function public.create_season_competition(uuid,text,text) to authenticated;
grant execute on function public.update_season_competition(uuid,text,text) to authenticated;
grant execute on function public.set_default_season_competition(uuid) to authenticated;
grant execute on function public.delete_season_competition(uuid) to authenticated;

-- Todas las temporadas ya creadas parten de la competición histórica actual.
insert into public.season_competitions (season_id, name, color, is_default, created_by)
select id, 'Liga Aragonesa', 'purple', true, created_by
from public.seasons;

update public.matches match
set competition_id = competition.id
from public.season_competitions competition
where competition.season_id = match.season_id
  and competition.is_default
  and match.match_kind = 'official'::public.match_kind;

alter table public.matches
  add constraint matches_competition_season_fkey
    foreign key (competition_id, season_id)
    references public.season_competitions(id, season_id)
    on delete cascade,
  add constraint matches_kind_competition_check check (
    (match_kind = 'official'::public.match_kind and competition_id is not null)
    or (match_kind = 'friendly'::public.match_kind and competition_id is null)
  );

create index matches_competition_idx on public.matches (competition_id, match_date);

create or replace function public.guard_published_match_structure()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.lineup_published and (
    new.season_id is distinct from old.season_id
    or new.match_date is distinct from old.match_date
    or new.match_kind is distinct from old.match_kind
    or new.rugby_format is distinct from old.rugby_format
    or new.competition_id is distinct from old.competition_id
  ) then
    raise exception 'No se puede cambiar la fecha, temporada, competición o formato de un partido con convocatoria publicada';
  end if;
  return new;
end;
$$;
