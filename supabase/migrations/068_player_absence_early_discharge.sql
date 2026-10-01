-- Conserva la fecha prevista de fin y registra desde cuándo la jugadora vuelve
-- a estar disponible si recibe el alta antes.
alter table public.player_absences
  add column discharged_on date,
  add constraint player_absences_discharge_dates_check check (
    discharged_on is null
    or (
      discharged_on >= starts_on
      and (ends_on is null or discharged_on <= ends_on)
    )
  );

create or replace function public.player_has_absence_on(checked_player_id uuid, checked_date date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.player_absences absence
    where absence.player_id = checked_player_id
      and absence.starts_on <= checked_date
      and (absence.ends_on is null or absence.ends_on >= checked_date)
      and (absence.discharged_on is null or checked_date < absence.discharged_on)
  );
$$;

create or replace function public.guard_player_absence_overlap()
returns trigger language plpgsql security definer set search_path = '' as $$
declare new_end_exclusive date;
begin
  new_end_exclusive := case
    when new.discharged_on is not null and (new.ends_on is null or new.discharged_on <= new.ends_on) then new.discharged_on
    when new.ends_on is not null then new.ends_on + 1
    else null
  end;

  if exists (
    select 1 from public.player_absences absence
    where absence.player_id = new.player_id and absence.id <> coalesce(new.id, gen_random_uuid())
      and daterange(
        absence.starts_on,
        case
          when absence.discharged_on is not null and (absence.ends_on is null or absence.discharged_on <= absence.ends_on) then absence.discharged_on
          when absence.ends_on is not null then absence.ends_on + 1
          else null
        end,
        '[)'
      ) && daterange(new.starts_on, new_end_exclusive, '[)')
  ) then raise exception 'La baja se solapa con otra baja ya registrada para esta jugadora'; end if;
  return new;
end;
$$;

drop trigger if exists player_absences_guard_overlap on public.player_absences;
create trigger player_absences_guard_overlap before insert or update of player_id, starts_on, ends_on, discharged_on
on public.player_absences for each row execute function public.guard_player_absence_overlap();

create or replace function public.discharge_player_absence(checked_absence_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare today_in_madrid date := (now() at time zone 'Europe/Madrid')::date;
begin
  if not public.current_user_is_owner() then raise exception 'Solo el owner puede dar de alta una baja deportiva'; end if;

  update public.player_absences
  set discharged_on = today_in_madrid
  where id = checked_absence_id
    and starts_on <= today_in_madrid
    and (ends_on is null or ends_on >= today_in_madrid)
    and (discharged_on is null or discharged_on > today_in_madrid);

  if not found then raise exception 'La baja no está vigente o ya tiene el alta registrada'; end if;
end;
$$;

revoke all on function public.discharge_player_absence(uuid) from public;
grant execute on function public.discharge_player_absence(uuid) to authenticated;
