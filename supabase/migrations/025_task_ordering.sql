-- El staff define el orden de realización de las tareas dentro de cada semana.
alter table public.tasks add column sort_order integer;

with ordered_tasks as (
  select id, row_number() over (
    partition by week_start
    order by created_at, id
  )::integer as position
  from public.tasks
)
update public.tasks
set sort_order = ordered_tasks.position
from ordered_tasks
where tasks.id = ordered_tasks.id;

alter table public.tasks
  alter column sort_order set default 0,
  alter column sort_order set not null,
  add constraint tasks_sort_order_non_negative check (sort_order >= 0);

create or replace function public.assign_task_sort_order()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.sort_order = 0 then
    select coalesce(max(sort_order), 0) + 1
    into new.sort_order
    from public.tasks
    where week_start = new.week_start;
  end if;
  return new;
end;
$$;

create trigger tasks_assign_sort_order
before insert on public.tasks
for each row execute function public.assign_task_sort_order();

create index tasks_week_order_idx on public.tasks (week_start, sort_order);

create or replace function public.reorder_tasks(ordered_task_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  checked_count integer;
  checked_week_count integer;
begin
  if not exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and (is_owner or is_coach)
      and is_approved
      and is_active
      and not is_archived
  ) then
    raise exception 'Solo un owner o entrenador activo puede ordenar las tareas';
  end if;

  if coalesce(cardinality(ordered_task_ids), 0) = 0 then
    return;
  end if;

  if cardinality(ordered_task_ids) <> (
    select count(distinct task_id) from unnest(ordered_task_ids) as listed(task_id)
  ) then
    raise exception 'La lista de tareas contiene duplicados';
  end if;

  select count(*), count(distinct week_start)
  into checked_count, checked_week_count
  from public.tasks
  where id = any(ordered_task_ids);

  if checked_count <> cardinality(ordered_task_ids) then
    raise exception 'No se han encontrado todas las tareas';
  end if;
  if checked_week_count <> 1 then
    raise exception 'Solo se pueden ordenar tareas de la misma semana';
  end if;

  update public.tasks as task
  set sort_order = ordered.position::integer
  from unnest(ordered_task_ids) with ordinality as ordered(id, position)
  where task.id = ordered.id;
end;
$$;

revoke all on function public.reorder_tasks(uuid[]) from public;
grant execute on function public.reorder_tasks(uuid[]) to authenticated;
