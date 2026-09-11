-- Festivos simples por temporada: una fecha marcada es suficiente para todos los calendarios.
create table public.season_holidays (
  season_id uuid not null references public.seasons(id) on delete cascade,
  holiday_date date not null,
  created_at timestamptz not null default now(),
  primary key (season_id, holiday_date)
);

create index season_holidays_date_idx on public.season_holidays (holiday_date);

create or replace function public.guard_season_holiday_date()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.seasons season
    where season.id = new.season_id and new.holiday_date between season.start_date and season.end_date
  ) then
    raise exception 'El festivo debe pertenecer al periodo de la temporada';
  end if;
  return new;
end;
$$;
create trigger season_holidays_guard_date before insert or update on public.season_holidays for each row execute function public.guard_season_holiday_date();

alter table public.season_holidays enable row level security;
create policy "Active members can read season holidays" on public.season_holidays for select to authenticated using (
  exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.is_approved and profile.is_active and not profile.is_archived)
);

create or replace function public.set_season_holidays(checked_season_id uuid, checked_dates date[])
returns void language plpgsql security definer set search_path = '' as $$
declare checked_date date;
begin
  if not exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.is_owner and profile.is_approved and profile.is_active and not profile.is_archived) then
    raise exception 'Solo el owner puede modificar festivos';
  end if;
  if not exists (select 1 from public.seasons where id = checked_season_id) then raise exception 'La temporada no existe'; end if;
  if cardinality(checked_dates) > 370 then raise exception 'Demasiados festivos'; end if;
  foreach checked_date in array coalesce(checked_dates, '{}'::date[]) loop
    if not exists (select 1 from public.seasons season where season.id = checked_season_id and checked_date between season.start_date and season.end_date) then
      raise exception 'El festivo % no pertenece al periodo de la temporada', checked_date;
    end if;
  end loop;
  delete from public.season_holidays where season_id = checked_season_id;
  insert into public.season_holidays (season_id, holiday_date)
  select distinct checked_season_id, checked_date from unnest(coalesce(checked_dates, '{}'::date[])) checked_date;
end;
$$;

revoke all on function public.set_season_holidays(uuid,date[]), public.guard_season_holiday_date() from public;
grant execute on function public.set_season_holidays(uuid,date[]) to authenticated;
