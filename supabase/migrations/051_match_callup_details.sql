-- Datos logísticos independientes para la concentración previa al partido.
alter table public.matches
  add column callup_time time,
  add column callup_venue text check (callup_venue is null or length(trim(callup_venue)) > 0);
