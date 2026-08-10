-- Las pantallas cargan tareas por ventanas de semanas sin conocer de antemano
-- la temporada. El índice compuesto existente empieza por season_id y no puede
-- resolver bien esa consulta cuando se acumulan varias temporadas.
create index if not exists tasks_week_start_idx
  on public.tasks (week_start desc);

