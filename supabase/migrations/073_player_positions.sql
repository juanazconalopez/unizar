-- Posiciones habituales del perfil, independientes de la temporada y del dorsal del partido.
begin;

insert into public.permission_definitions
  (key, section_key, section_label, label, description, action, parent_key, sort_order, configurable, owner_only)
values ('team.positions', 'team', 'Equipo', 'Modificar posiciones de jugadoras',
  'Asigna posiciones habituales y una principal para distribuir delanteras y línea.',
  'edit', null, 855, true, false);
insert into public.role_permission_defaults (role, permission_key) values ('coach', 'team.positions');
insert into public.role_permissions (role, permission_key) values ('coach', 'team.positions');

alter table public.profiles
  add column playing_positions text[] not null default '{}',
  add column primary_position text;

create function public.valid_player_positions(positions text[], principal text)
returns boolean language sql immutable set search_path = '' as $$
  select positions is not null
    and coalesce(pg_catalog.array_ndims(positions), 1) = 1
    and coalesce(pg_catalog.array_lower(positions, 1), 1) = 1
    and pg_catalog.cardinality(positions) <= 9
    and positions <@ array['prop','hooker','second_row','back_row','scrum_half','fly_half','centre','wing','fullback']::text[]
    and pg_catalog.array_position(positions, null) is null
    and pg_catalog.cardinality(positions) = (select count(distinct value) from pg_catalog.unnest(positions) value)
    and ((pg_catalog.cardinality(positions) = 0 and principal is null)
      or (principal is not null and principal = any(positions)));
$$;
revoke all on function public.valid_player_positions(text[],text) from public,anon;
grant execute on function public.valid_player_positions(text[],text) to authenticated;

alter table public.profiles add constraint profiles_playing_positions_check
  check (public.valid_player_positions(playing_positions, primary_position));

-- También protege las columnas frente a escrituras directas sobre el propio perfil.
create function public.guard_player_position_changes()
returns trigger language plpgsql set search_path = '' as $$
declare changed boolean;
begin
  if tg_op = 'INSERT' then
    changed := pg_catalog.cardinality(new.playing_positions) > 0 or new.primary_position is not null;
  else
    changed := (new.playing_positions, new.primary_position) is distinct from (old.playing_positions, old.primary_position);
  end if;
  if changed then
    if not (select public.current_user_has_permission('team.positions'))
      or not exists (select 1 from public.profiles actor where actor.id = (select auth.uid()) and (actor.is_owner or actor.is_coach)) then
      raise exception 'No tienes permiso para modificar posiciones de jugadoras';
    end if;
    if not new.is_player or not new.is_approved or new.is_archived then
      raise exception 'Solo se pueden asignar posiciones a jugadoras autorizadas';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_player_position_changes() from public,anon,authenticated;
create trigger profiles_guard_playing_positions before insert or update on public.profiles
for each row execute function public.guard_player_position_changes();

create function public.set_player_positions(checked_player_id uuid, checked_positions text[], checked_primary_position text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.current_user_has_permission('team.positions'))
      or not exists (select 1 from public.profiles actor where actor.id = (select auth.uid()) and (actor.is_owner or actor.is_coach)) then
    raise exception 'No tienes permiso para modificar posiciones de jugadoras';
  end if;
  if not public.valid_player_positions(checked_positions, checked_primary_position) then
    raise exception 'Selecciona posiciones válidas y una principal entre ellas';
  end if;
  update public.profiles set playing_positions = checked_positions, primary_position = checked_primary_position
  where id = checked_player_id and is_player and is_approved and not is_archived;
  if not found then raise exception 'Solo se pueden modificar posiciones de jugadoras autorizadas'; end if;
end;
$$;
revoke all on function public.set_player_positions(uuid,text[],text) from public,anon;
grant execute on function public.set_player_positions(uuid,text[],text) to authenticated;

commit;
