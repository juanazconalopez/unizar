-- Actas de partidos en almacenamiento privado y resultado revisado por equipo.
alter table public.matches
  add column team_score smallint,
  add column opponent_score smallint,
  add column report_events_reviewed boolean not null default false,
  add constraint matches_report_score_check check (
    (team_score is null and opponent_score is null)
    or (team_score between 0 and 250 and opponent_score between 0 and 250)
  ),
  add constraint matches_report_requires_score check (match_report_path is null or team_score is not null);

alter table public.matches
  add constraint matches_report_path_format check (
    match_report_path is null or match_report_path ~ ('^' || id::text || '/[0-9a-f-]{36}[.]pdf$')
  ),
  add constraint matches_report_review_check check (not report_events_reviewed or match_report_path is not null);

create or replace function public.guard_match_report_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.match_report_path is not null or new.team_score is not null
      or new.opponent_score is not null or new.report_events_reviewed then
      raise exception 'Gestiona el acta desde su acción de subida';
    end if;
  elsif (new.match_report_path, new.team_score, new.opponent_score,
    new.duration_minutes, new.report_events_reviewed) is distinct from
    (old.match_report_path, old.team_score, old.opponent_score,
    old.duration_minutes, old.report_events_reviewed)
    and current_setting('app.match_report_write', true) is distinct from 'yes' then
    raise exception 'Gestiona el acta desde su acción de subida';
  end if;
  return new;
end;
$$;
create trigger matches_guard_report_fields before insert or update on public.matches
for each row execute function public.guard_match_report_fields();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('match-reports', 'match-reports', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Match viewers can read reports" on storage.objects for select to authenticated using (
  bucket_id = 'match-reports' and public.current_user_has_permission('matches.report') and exists (
    select 1 from public.matches match where match.match_report_path = name
  )
);
create policy "Match managers can upload reports" on storage.objects for insert to authenticated with check (
  bucket_id = 'match-reports' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]pdf$'
  and public.current_user_has_permission('matches.edit')
  and exists (
    select 1 from public.matches match where match.id::text = split_part(name, '/', 1)
      and match.match_date < (pg_catalog.now() at time zone 'Europe/Madrid')::date
      and match.status not in ('draft'::public.match_status, 'cancelled'::public.match_status)
      and public.current_user_can_edit_match(match.id)
  )
);
create policy "Match managers can delete reports" on storage.objects for delete to authenticated using (
  bucket_id = 'match-reports' and public.current_user_has_permission('matches.edit')
  and exists (
    select 1 from public.matches match where match.id::text = split_part(name, '/', 1)
      and public.current_user_can_edit_match(match.id)
  )
);

create or replace function public.save_match_report(
  checked_match_id uuid, checked_path text, checked_team_score integer,
  checked_opponent_score integer, checked_duration integer,
  checked_events jsonb, checked_events_reviewed boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare checked_match public.matches%rowtype;
begin
  if not public.current_user_can_edit_match(checked_match_id)
    or not public.current_user_has_permission('matches.edit') then
    raise exception 'No tienes permiso para subir el acta de este partido';
  end if;
  select * into checked_match from public.matches where id = checked_match_id for update;
  if not found then raise exception 'El partido no existe'; end if;
  if checked_match.match_date >= (pg_catalog.now() at time zone 'Europe/Madrid')::date
    or checked_match.status in ('draft'::public.match_status, 'cancelled'::public.match_status) then
    raise exception 'El acta solo se puede subir después de un partido publicado';
  end if;
  if checked_path !~ ('^' || checked_match_id::text || '/[0-9a-f-]{36}[.]pdf$')
    or not exists (select 1 from storage.objects where bucket_id = 'match-reports' and name = checked_path) then
    raise exception 'El PDF no está almacenado en la ruta esperada';
  end if;
  if checked_team_score is null or checked_opponent_score is null
    or checked_team_score not between 0 and 250 or checked_opponent_score not between 0 and 250 then
    raise exception 'Revisa el resultado del partido';
  end if;
  if checked_duration not between 1 and 240 then raise exception 'Revisa la duración del partido'; end if;
  if checked_events_reviewed and checked_match.match_kind <> 'official'::public.match_kind then
    raise exception 'Solo los partidos oficiales registran minutos de acta';
  end if;
  if checked_events_reviewed and not exists (
    select 1 from public.match_lineup where match_id = checked_match_id
  ) then raise exception 'Prepara la convocatoria antes de confirmar cambios y tarjetas'; end if;

  perform set_config('app.match_report_write', 'yes', true);
  update public.matches set match_report_path = checked_path,
    team_score = checked_team_score, opponent_score = checked_opponent_score,
    duration_minutes = checked_duration, report_events_reviewed = checked_events_reviewed,
    status = 'completed'::public.match_status
  where id = checked_match_id;
  if checked_events_reviewed then
    perform public.save_match_events(checked_match_id, checked_events);
  else
    delete from public.match_events where match_id = checked_match_id;
  end if;
end;
$$;
revoke all on function public.save_match_report(uuid,text,integer,integer,integer,jsonb,boolean) from public;
grant execute on function public.save_match_report(uuid,text,integer,integer,integer,jsonb,boolean) to authenticated;
revoke execute on function public.save_match_events(uuid,jsonb) from authenticated;

-- Los minutos solo cuentan cuando se revisaron los eventos del acta.
create or replace function public.get_season_player_minutes(checked_season_id uuid)
returns table(player_id uuid, played_minutes integer)
language sql stable security definer set search_path = '' as $$
  with official_lineups as (
    select match.id as match_id, match.duration_minutes, lineup.player_id, lineup.role
    from public.matches match join public.match_lineup lineup on lineup.match_id = match.id
    where match.season_id = checked_season_id
      and match.match_kind = 'official'::public.match_kind
      and match.status = 'completed'::public.match_status
      and match.report_events_reviewed
      and public.current_user_has_permission('matches.lineup_edit')
      and public.current_user_can_view_season_team(match.team_id)
  ), intervals as (
    select lineup.*, case when lineup.role = 'starter'::public.lineup_role then 0 else coalesce((
      select min(event.event_minute) from public.match_events event
      where event.match_id = lineup.match_id and event.event_type = 'substitution'::public.match_event_type
        and event.replacement_player_id = lineup.player_id
    ), lineup.duration_minutes) end as starts_at,
    coalesce((select min(event.event_minute) from public.match_events event
      where event.match_id = lineup.match_id and event.player_id = lineup.player_id
        and event.event_type in ('substitution'::public.match_event_type, 'red_card'::public.match_event_type)
    ), lineup.duration_minutes) as ends_at
    from official_lineups lineup
  ), totals as (
    select interval.player_id, greatest(interval.ends_at - interval.starts_at - coalesce((
      select sum(greatest(0, least(interval.ends_at, event.event_minute + 10) - greatest(interval.starts_at, event.event_minute)))
      from public.match_events event where event.match_id = interval.match_id and event.player_id = interval.player_id
        and event.event_type = 'yellow_card'::public.match_event_type
    ), 0), 0)::integer as minutes
    from intervals interval
  ) select player_id, sum(minutes)::integer from totals group by player_id;
$$;

