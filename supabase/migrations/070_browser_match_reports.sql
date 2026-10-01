-- El PDF solo se lee en el navegador. Se persisten resultado y eventos
-- revisados; los minutos se derivan de sus tramos de juego.
alter table public.matches drop constraint matches_report_review_check;
alter table public.match_events
  add column return_minute smallint,
  add column sort_order integer not null default 0 check (sort_order >= 0),
  add constraint match_events_return_check check (
    return_minute is null or (event_type = 'yellow_card' and return_minute between event_minute and 240)
  );

-- Conservar la interpretación anterior de las amarillas ya guardadas,
-- corrigiendo la suspensión de seven. Los registros nuevos revisan el regreso.
update public.match_events event set return_minute = least(match.duration_minutes,
  event.event_minute + case when match.rugby_format = 'sevens' then 2 else 10 end)
from public.matches match where match.id = event.match_id and event.event_type = 'yellow_card';
with ordered as (
  select id, row_number() over (partition by match_id order by event_minute,
    case event_type when 'yellow_card' then 0 when 'substitution' then 1 else 2 end, created_at, id)::integer as position
  from public.match_events
)
update public.match_events event set sort_order = ordered.position from ordered where ordered.id = event.id;

-- No habilitar nuevas subidas. Los PDF históricos y sus rutas se conservan.
drop policy "Match managers can upload reports" on storage.objects;
drop policy "Scoped staff can read match events" on public.match_events;
create policy "Match managers can read events" on public.match_events for select to authenticated using (
  public.current_user_has_permission('matches.edit') and public.current_user_can_edit_match(match_id)
);

drop function public.save_match_report(uuid,text,integer,integer,integer,jsonb,boolean);

create or replace function public.guard_match_report_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.match_report_path is not null or new.team_score is not null
      or new.opponent_score is not null or new.report_events_reviewed then
      raise exception 'Gestiona el resultado desde Resultado y minutos';
    end if;
  elsif (new.match_report_path, new.team_score, new.opponent_score,
    new.duration_minutes, new.report_events_reviewed) is distinct from
    (old.match_report_path, old.team_score, old.opponent_score,
    old.duration_minutes, old.report_events_reviewed)
    and current_setting('app.match_report_write', true) is distinct from 'yes' then
    raise exception 'Gestiona el resultado desde Resultado y minutos';
  end if;
  return new;
end;
$$;

-- Función interna compartida por el guardado y el informe de temporada.
-- Valida la secuencia completa; no está expuesta a clientes ni usa tablas
-- auxiliares de totales que puedan quedar desactualizadas.
-- Mantenerla volátil: debe ver la duración actualizada dentro del guardado.
create or replace function public.calculate_match_player_minutes(checked_match_id uuid, checked_events jsonb)
returns table(player_id uuid, played_minutes integer)
language plpgsql set search_path = '' as $$
declare
  match_duration integer;
  suspension integer;
  states jsonb := '{}'::jsonb;
  entry record;
  item record;
  state_entry record;
  event jsonb;
  state jsonb;
  incoming jsonb;
  player_key text;
  incoming_key text;
  minute integer;
  entered integer;
  returns_at integer;
  total integer;
  kind text;
begin
  select match.duration_minutes, case when match.rugby_format = 'sevens' then 2 else 10 end
    into match_duration, suspension from public.matches match where match.id = checked_match_id;
  if not found then raise exception 'El partido no existe'; end if;
  if checked_events is null or jsonb_typeof(checked_events) <> 'array' then
    raise exception 'Revisa los eventos del partido';
  end if;
  if jsonb_array_length(checked_events) > 300 then raise exception 'Revisa el número de eventos del partido'; end if;
  for entry in select lineup.player_id, lineup.role from public.match_lineup lineup where lineup.match_id = checked_match_id loop
    states := states || jsonb_build_object(entry.player_id::text, jsonb_build_object(
      'entered', case when entry.role = 'starter' then 0 else null end,
      'minutes', 0, 'suspended', false, 'returns', null, 'sent_off', false));
  end loop;

  -- Primero validar la forma para poder ordenar sin conversiones inseguras.
  for item in select value from jsonb_array_elements(checked_events) loop
    event := item.value;
    if jsonb_typeof(event) <> 'object' or coalesce(event->>'event_minute', '') !~ '^[0-9]{1,3}$'
      or coalesce(event->>'event_type', '') not in ('substitution', 'yellow_card', 'red_card')
      or not (states ? coalesce(event->>'player_id', '')) then
      raise exception 'El evento contiene un minuto, un tipo o una jugadora no válidos';
    end if;
    if (event->>'event_minute')::integer > match_duration then raise exception 'El minuto supera la duración del partido'; end if;
    if event->>'return_minute' is not null then
      if event->>'event_type' <> 'yellow_card' or (event->>'return_minute') !~ '^[0-9]{1,3}$' then
        raise exception 'Solo las amarillas tienen minuto de regreso';
      end if;
      if (event->>'return_minute')::integer not between least(match_duration, (event->>'event_minute')::integer + suspension) and match_duration then
        raise exception 'Revisa el regreso tras la amarilla';
      end if;
    end if;
    if event->>'event_type' = 'substitution' then
      if not (states ? coalesce(event->>'replacement_player_id', '')) or event->>'replacement_player_id' = event->>'player_id' then
        raise exception 'Selecciona dos jugadoras distintas de la convocatoria';
      end if;
    elsif event->>'replacement_player_id' is not null then
      raise exception 'Las tarjetas no incluyen una jugadora que entra';
    end if;
  end loop;

  for item in select value, ordinality from jsonb_array_elements(checked_events) with ordinality
    order by (value->>'event_minute')::integer, ordinality loop
    event := item.value;
    minute := (event->>'event_minute')::integer;
    -- Los regresos al mismo minuto preceden a los eventos de ese minuto.
    for state_entry in select key, value from jsonb_each(states) loop
      state := state_entry.value;
      returns_at := (state->>'returns')::integer;
      if (state->>'suspended')::boolean and returns_at is not null and returns_at <= minute and not (state->>'sent_off')::boolean then
        states := jsonb_set(states, array[state_entry.key], state || jsonb_build_object('entered', returns_at, 'suspended', false, 'returns', null));
      end if;
    end loop;
    player_key := event->>'player_id';
    state := states->player_key;
    entered := (state->>'entered')::integer;
    total := (state->>'minutes')::integer;
    kind := event->>'event_type';
    if kind = 'substitution' then
      incoming_key := event->>'replacement_player_id';
      incoming := states->incoming_key;
      if entered is null then raise exception 'Evento %: la jugadora que sale no está en el campo', item.ordinality; end if;
      if incoming->>'entered' is not null or (incoming->>'suspended')::boolean or (incoming->>'sent_off')::boolean then
        raise exception 'Evento %: la jugadora que entra ya está jugando, está suspendida o ha sido expulsada', item.ordinality;
      end if;
      states := jsonb_set(states, array[player_key], state || jsonb_build_object('entered', null, 'minutes', total + minute - entered));
      states := jsonb_set(states, array[incoming_key], incoming || jsonb_build_object('entered', minute));
    else
      if (state->>'sent_off')::boolean then raise exception 'Evento %: la jugadora ya ha sido expulsada', item.ordinality; end if;
      if kind = 'yellow_card' then
        if entered is null then raise exception 'Evento %: la jugadora que recibe la amarilla no está en el campo', item.ordinality; end if;
        state := state || jsonb_build_object('entered', null, 'minutes', total + minute - entered,
          'suspended', true, 'returns', (event->>'return_minute')::integer);
      else
        state := state || jsonb_build_object('entered', null, 'minutes', total + case when entered is null then 0 else minute - entered end,
          'sent_off', true, 'suspended', false, 'returns', null);
      end if;
      states := jsonb_set(states, array[player_key], state);
    end if;
  end loop;
  for state_entry in select key, value from jsonb_each(states) loop
    state := state_entry.value;
    entered := (state->>'entered')::integer;
    if (state->>'suspended')::boolean and state->>'returns' is not null and not (state->>'sent_off')::boolean then
      entered := (state->>'returns')::integer;
    end if;
    player_id := state_entry.key::uuid;
    played_minutes := (state->>'minutes')::integer + case when entered is null then 0 else match_duration - entered end;
    return next;
  end loop;
end;
$$;
revoke all on function public.calculate_match_player_minutes(uuid,jsonb) from public, anon, authenticated;

-- Cambiar las jugadoras o sus roles de salida exige revisar de nuevo los
-- eventos guardados. Conservarlos para que el entrenador pueda corregirlos.
create or replace function public.invalidate_match_result_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  affected_ids uuid[];
  previous_write_setting text := current_setting('app.match_report_write', true);
begin
  if tg_op = 'UPDATE' and new.match_id = old.match_id and new.player_id = old.player_id and new.role = old.role then return new; end if;
  if tg_op = 'INSERT' then affected_ids := array[new.match_id];
  elsif tg_op = 'DELETE' then affected_ids := array[old.match_id];
  else affected_ids := array[old.match_id, new.match_id]; end if;
  perform set_config('app.match_report_write', 'yes', true);
  update public.matches set report_events_reviewed = false where id = any(affected_ids) and report_events_reviewed;
  perform set_config('app.match_report_write', coalesce(previous_write_setting, ''), true);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.invalidate_match_result_review() from public, anon, authenticated;
create trigger match_lineup_invalidate_result after insert or update or delete on public.match_lineup
for each row execute function public.invalidate_match_result_review();

create or replace function public.save_match_events(checked_match_id uuid, checked_events jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.match_report_write', true) is distinct from 'yes'
    or not public.current_user_can_edit_match(checked_match_id) then
    raise exception 'Guarda los eventos desde Resultado y minutos';
  end if;
  perform public.calculate_match_player_minutes(checked_match_id, checked_events);
  delete from public.match_events where match_id = checked_match_id;
  insert into public.match_events (match_id, event_minute, event_type, player_id, replacement_player_id, return_minute, sort_order, created_by)
  select checked_match_id, (value->>'event_minute')::smallint, (value->>'event_type')::public.match_event_type,
    (value->>'player_id')::uuid, (value->>'replacement_player_id')::uuid, (value->>'return_minute')::smallint,
    ordinality::integer, (select auth.uid())
  from jsonb_array_elements(checked_events) with ordinality;
end;
$$;
revoke all on function public.save_match_events(uuid,jsonb) from public, anon, authenticated;

create or replace function public.save_match_report(
  checked_match_id uuid, checked_team_score integer, checked_opponent_score integer,
  checked_duration integer, checked_events jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare checked_match public.matches%rowtype;
begin
  if not public.current_user_can_edit_match(checked_match_id)
    or not public.current_user_has_permission('matches.edit') then
    raise exception 'No tienes permiso para registrar el resultado de este partido';
  end if;
  select * into checked_match from public.matches where id = checked_match_id for update;
  if not found then raise exception 'El partido no existe'; end if;
  if checked_match.match_date > (pg_catalog.now() at time zone 'Europe/Madrid')::date
    or checked_match.status in ('draft'::public.match_status, 'cancelled'::public.match_status) then
    raise exception 'Solo puedes registrar un partido publicado que ya haya terminado';
  end if;
  if checked_team_score is null or checked_opponent_score is null
    or checked_team_score not between 0 and 250 or checked_opponent_score not between 0 and 250 then
    raise exception 'Revisa el resultado del partido';
  end if;
  if checked_duration is null or checked_duration not between 1 and 240 then raise exception 'Revisa la duración del partido'; end if;
  if checked_events is null or jsonb_typeof(checked_events) <> 'array' then raise exception 'Revisa los eventos del partido'; end if;
  if checked_match.match_kind = 'official' then
    if not checked_match.lineup_published or not exists (select 1 from public.match_lineup where match_id = checked_match_id) then
      raise exception 'Publica primero la convocatoria para registrar los minutos del partido';
    end if;
    if exists (
      select 1 from public.match_lineup lineup where lineup.match_id = checked_match_id and not exists (
        select 1 from public.season_players membership
        where membership.player_id = lineup.player_id and membership.season_id = checked_match.season_id
          and membership.active_from <= checked_match.match_date
          and (membership.active_until is null or membership.active_until >= checked_match.match_date)
      )
    ) then raise exception 'Revisa la vinculación de las jugadoras en la fecha del partido'; end if;
  elsif jsonb_array_length(checked_events) > 0 then
    raise exception 'Solo los partidos oficiales registran minutos';
  end if;

  perform set_config('app.match_report_write', 'yes', true);
  update public.matches set team_score = checked_team_score, opponent_score = checked_opponent_score,
    duration_minutes = checked_duration, report_events_reviewed = checked_match.match_kind = 'official',
    status = 'completed'::public.match_status where id = checked_match_id;
  if checked_match.match_kind = 'official' then
    perform public.save_match_events(checked_match_id, checked_events);
  end if;
  perform set_config('app.match_report_write', '', true);
end;
$$;
revoke all on function public.save_match_report(uuid,integer,integer,integer,jsonb) from public, anon;
grant execute on function public.save_match_report(uuid,integer,integer,integer,jsonb) to authenticated;

-- Si un registro histórico incoherente no permite reconstruir los tramos,
-- conservar todos sus eventos y dejarlo pendiente de revisión, sin inventar
-- minutos ni bloquear los informes del resto del equipo.
do $$
declare match_entry record;
begin
  perform set_config('app.match_report_write', 'yes', true);
  for match_entry in select match.id, coalesce(jsonb_agg(jsonb_build_object(
    'event_type', event.event_type, 'event_minute', event.event_minute, 'player_id', event.player_id,
    'replacement_player_id', event.replacement_player_id, 'return_minute', event.return_minute)
    order by event.event_minute, event.sort_order) filter (where event.id is not null), '[]'::jsonb) as events
    from public.matches match left join public.match_events event on event.match_id = match.id
    where match.report_events_reviewed group by match.id loop
    begin
      perform public.calculate_match_player_minutes(match_entry.id, match_entry.events);
    exception when raise_exception then
      update public.matches set report_events_reviewed = false where id = match_entry.id;
      raise notice 'El partido % conserva sus eventos y requiere revisión: %', match_entry.id, sqlerrm;
    end;
  end loop;
  perform set_config('app.match_report_write', '', true);
end;
$$;

create or replace function public.get_season_player_minutes(checked_season_id uuid)
returns table(player_id uuid, played_minutes integer)
language sql stable security definer set search_path = '' as $$
  select totals.player_id, sum(totals.played_minutes)::integer
  from public.matches match
  cross join lateral public.calculate_match_player_minutes(match.id, (
    select coalesce(jsonb_agg(jsonb_build_object('event_type', event.event_type,
      'event_minute', event.event_minute, 'player_id', event.player_id,
      'replacement_player_id', event.replacement_player_id, 'return_minute', event.return_minute)
      order by event.event_minute, event.sort_order), '[]'::jsonb)
    from public.match_events event where event.match_id = match.id
  )) totals
  where match.season_id = checked_season_id and match.match_kind = 'official'
    and match.status = 'completed' and match.report_events_reviewed
    and public.current_user_has_permission('matches.lineup_edit')
    and public.current_user_can_view_season_team(match.team_id)
    and exists (
      select 1 from public.season_players membership
      where membership.player_id = totals.player_id and membership.season_id = match.season_id
        and membership.active_from <= match.match_date
        and (membership.active_until is null or membership.active_until >= match.match_date)
    )
  group by totals.player_id;
$$;
revoke all on function public.get_season_player_minutes(uuid) from public, anon;
grant execute on function public.get_season_player_minutes(uuid) to authenticated;
