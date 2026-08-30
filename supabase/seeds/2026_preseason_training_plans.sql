-- Cuatro borradores de pretemporada para las dos primeras semanas de
-- septiembre de 2026. Requiere la migración 029_training_plans.sql.
-- Es reejecutable: no duplica planes ni ejercicios existentes.
do $$
declare
  selected_season_id uuid;
  selected_owner_id uuid;
begin
  select id into selected_season_id from public.seasons
  where start_date <= date '2026-09-01' and end_date >= date '2026-09-10'
  order by start_date desc limit 1;
  if selected_season_id is null then
    raise exception 'No existe una temporada que cubra del 1 al 10 de septiembre de 2026';
  end if;

  select id into selected_owner_id from public.profiles
  where is_owner and is_approved and is_active and not is_archived
  order by created_at limit 1;
  if selected_owner_id is null then
    raise exception 'No existe ningún owner activo y aprobado';
  end if;

  insert into public.training_plans (season_id, session_date, title, objectives, material, status, created_by)
  select selected_season_id, planned.session_date, planned.title, planned.objectives, planned.notes,
    'draft'::public.task_status, selected_owner_id
  from (values
    (date '2026-09-01', 'Pretemporada 01 · Volver a correr jugando',
      'Recuperar ritmo de carrera, comunicación y manejo de balón mediante juegos competitivos sin contacto.',
      '20 conos, petos y balones suficientes para trabajar en grupos pequeños.'),
    (date '2026-09-03', 'Pretemporada 02 · Velocidad, persecución y apoyo',
      'Acumular carreras rápidas cortas y mantener apoyos útiles sin contacto intenso.',
      'Conos para puertas y carriles, petos y un balón por pareja.'),
    (date '2026-09-08', 'Pretemporada 03 · Defender corriendo y contraatacar',
      'Trabajar conexión defensiva, reacción y transición a ataque mediante juegos de alta movilidad.',
      'Conos, petos o cintas y balones para las transiciones.'),
    (date '2026-09-10', 'Pretemporada 04 · Festival de juegos con balón',
      'Cerrar las dos primeras semanas con una sesión divertida, competitiva y de gran volumen de carrera.',
      'Conos de colores, petos y al menos cuatro balones.')
  ) as planned(session_date, title, objectives, notes)
  where not exists (
    select 1 from public.training_plans existing where existing.session_date = planned.session_date
  );

  with exercise_data(session_date, sort_order, title, description, duration_minutes, template, elements) as (values
    (date '2026-09-01', 0, 'Pilla-pilla por colores',
      'Dos cazadoras intentan tocar a una corredora dentro del cuadrado. Al ser tocada, recoge un cono del color indicado y vuelve corriendo. Cambiar cazadoras cada 60 segundos.',
      15, 'half',
      '[{"id":"z1","type":"zone","x":250,"y":145},{"id":"c1","type":"cone","x":250,"y":145},{"id":"c2","type":"cone","x":410,"y":145},{"id":"p1","type":"player","x":300,"y":185,"label":"1"},{"id":"p2","type":"player","x":365,"y":190,"label":"2"},{"id":"o1","type":"opponent","x":330,"y":245,"label":"C"},{"id":"r1","type":"run","x":335,"y":245,"rotation":-65}]'::jsonb),
    (date '2026-09-01', 1, 'Relevos de pase y apoyo',
      'La portadora corre 15 m, pasa antes de la puerta y continúa por detrás para volver a apoyar. Gana el primer equipo que completa seis idas sin caída.',
      20, 'full',
      '[{"id":"c1","type":"cone","x":220,"y":145},{"id":"c2","type":"cone","x":220,"y":355},{"id":"p1","type":"player","x":280,"y":210,"label":"1"},{"id":"p2","type":"player","x":390,"y":260,"label":"2"},{"id":"p3","type":"player","x":500,"y":310,"label":"3"},{"id":"pa1","type":"pass","x":300,"y":220,"rotation":22},{"id":"pa2","type":"pass","x":410,"y":270,"rotation":22}]'::jsonb),
    (date '2026-09-01', 2, 'Laberinto de evasión',
      'Cada atacante elige puertas distintas y llega a la zona final sin que una defensora le toque con dos manos. Cambiar roles tras cada carrera.',
      25, 'half',
      '[{"id":"c1","type":"cone","x":300,"y":130},{"id":"c2","type":"cone","x":300,"y":200},{"id":"c3","type":"cone","x":430,"y":210},{"id":"c4","type":"cone","x":430,"y":280},{"id":"p1","type":"player","x":220,"y":255,"label":"A"},{"id":"o1","type":"opponent","x":380,"y":245,"label":"D"},{"id":"r1","type":"run","x":240,"y":250,"rotation":-18},{"id":"z1","type":"zone","x":650,"y":200}]'::jsonb),
    (date '2026-09-01', 3, 'Touch a las cuatro esquinas',
      'Partido 6 contra 6. Se marca en cualquiera de las cuatro esquinas. Tras toque a dos manos hay pase inmediato y repliegue de tres metros. Últimos 5 minutos suaves.',
      30, 'full',
      '[{"id":"z1","type":"zone","x":45,"y":45},{"id":"z2","type":"zone","x":695,"y":45},{"id":"z3","type":"zone","x":45,"y":375},{"id":"z4","type":"zone","x":695,"y":375},{"id":"p1","type":"player","x":330,"y":200,"label":"1"},{"id":"p2","type":"player","x":270,"y":300,"label":"2"},{"id":"o1","type":"opponent","x":500,"y":190,"label":"1"},{"id":"pa1","type":"pass","x":350,"y":210,"rotation":36}]'::jsonb),

    (date '2026-09-03', 0, 'Semáforo rugby',
      'Todas se desplazan con balón: verde acelera, amarillo cambia dirección y rojo deja el balón y busca otro. Añadir señales de pase y persecución.',
      15, 'half',
      '[{"id":"p1","type":"player","x":270,"y":180,"label":"1"},{"id":"p2","type":"player","x":370,"y":260,"label":"2"},{"id":"p3","type":"player","x":500,"y":180,"label":"3"},{"id":"b1","type":"ball","x":305,"y":180},{"id":"r1","type":"run","x":290,"y":180,"rotation":5},{"id":"t1","type":"text","x":360,"y":100,"label":"VERDE = CORRER"}]'::jsonb),
    (date '2026-09-03', 1, 'Cazadoras por parejas',
      'Parejas separadas dos metros. La primera elige una puerta y la perseguidora intenta tocarla antes de cruzarla. Alternar cinco salidas por lado.',
      20, 'half',
      '[{"id":"p1","type":"player","x":250,"y":260,"label":"A"},{"id":"o1","type":"opponent","x":210,"y":260,"label":"C"},{"id":"c1","type":"cone","x":600,"y":120},{"id":"c2","type":"cone","x":600,"y":190},{"id":"c3","type":"cone","x":600,"y":330},{"id":"c4","type":"cone","x":600,"y":400},{"id":"r1","type":"run","x":275,"y":250,"rotation":-20}]'::jsonb),
    (date '2026-09-03', 2, 'Olas de apoyo 3 contra 1',
      'Tres atacantes salen en oleadas contra una defensora que solo puede interceptar o tocar. Al terminar vuelven trotando por fuera.',
      25, 'half',
      '[{"id":"p1","type":"player","x":220,"y":170,"label":"1"},{"id":"p2","type":"player","x":220,"y":260,"label":"2"},{"id":"p3","type":"player","x":220,"y":350,"label":"3"},{"id":"o1","type":"opponent","x":470,"y":260,"label":"D"},{"id":"r1","type":"run","x":245,"y":170},{"id":"pa1","type":"pass","x":250,"y":245,"rotation":-18},{"id":"z1","type":"zone","x":650,"y":205}]'::jsonb),
    (date '2026-09-03', 3, 'Ultimate rugby continuo',
      'No se puede correr con el balón más de tres pasos. Se avanza pasando y se marca recibiendo en zona. Cambio inmediato tras pérdida. Últimos 5 minutos suaves.',
      30, 'full',
      '[{"id":"z1","type":"zone","x":30,"y":150},{"id":"z2","type":"zone","x":710,"y":150},{"id":"p1","type":"player","x":300,"y":180,"label":"1"},{"id":"p2","type":"player","x":360,"y":320,"label":"2"},{"id":"o1","type":"opponent","x":500,"y":160,"label":"1"},{"id":"pa1","type":"pass","x":330,"y":185,"rotation":35},{"id":"r1","type":"run","x":380,"y":325,"rotation":-25}]'::jsonb),

    (date '2026-09-08', 0, 'Espejos por calles',
      'Una jugadora lidera desplazamientos laterales y aceleraciones de cinco metros; la pareja imita. Bloques de 25 segundos con 20 de recuperación.',
      15, 'half',
      '[{"id":"c1","type":"cone","x":250,"y":160},{"id":"c2","type":"cone","x":250,"y":350},{"id":"c3","type":"cone","x":600,"y":160},{"id":"c4","type":"cone","x":600,"y":350},{"id":"p1","type":"player","x":370,"y":220,"label":"A"},{"id":"o1","type":"opponent","x":460,"y":220,"label":"D"},{"id":"d1","type":"defense","x":450,"y":250,"rotation":90}]'::jsonb),
    (date '2026-09-08', 1, 'Cerrar puertas',
      'Cuatro defensoras protegen tres puertas. La entrenadora señala una y el ataque intenta cruzarla; la defensa puntúa si llega conectada antes.',
      20, 'half',
      '[{"id":"c1","type":"cone","x":610,"y":130},{"id":"c2","type":"cone","x":610,"y":190},{"id":"c3","type":"cone","x":610,"y":300},{"id":"p1","type":"player","x":250,"y":160,"label":"1"},{"id":"p2","type":"player","x":250,"y":260,"label":"2"},{"id":"o1","type":"opponent","x":430,"y":150,"label":"1"},{"id":"o2","type":"opponent","x":430,"y":250,"label":"2"},{"id":"d1","type":"defense","x":455,"y":150}]'::jsonb),
    (date '2026-09-08', 2, 'Transición 4 contra 3',
      'Cuatro atacan contra tres. Ante toque, caída o interceptación se lanza un segundo balón en sentido contrario y todas cambian de rol corriendo.',
      25, 'full',
      '[{"id":"p1","type":"player","x":300,"y":150,"label":"1"},{"id":"p2","type":"player","x":300,"y":230,"label":"2"},{"id":"p3","type":"player","x":300,"y":310,"label":"3"},{"id":"p4","type":"player","x":300,"y":390,"label":"4"},{"id":"o1","type":"opponent","x":470,"y":190,"label":"1"},{"id":"o2","type":"opponent","x":470,"y":270,"label":"2"},{"id":"b1","type":"ball","x":550,"y":90},{"id":"r1","type":"run","x":490,"y":190,"rotation":-145}]'::jsonb),
    (date '2026-09-08', 3, 'Conquista de territorios',
      'Campo en tres franjas. Punto por tres pases en una franja y otro por avanzar. Touch a dos manos y repliegue inmediato de cinco metros. Últimos 5 minutos suaves.',
      30, 'full',
      '[{"id":"z1","type":"zone","x":55,"y":90},{"id":"z2","type":"zone","x":360,"y":90},{"id":"z3","type":"zone","x":665,"y":90},{"id":"p1","type":"player","x":250,"y":210,"label":"1"},{"id":"p2","type":"player","x":310,"y":330,"label":"2"},{"id":"o1","type":"opponent","x":480,"y":210,"label":"1"},{"id":"r1","type":"run","x":330,"y":325,"rotation":-15}]'::jsonb),

    (date '2026-09-10', 0, 'Roba-conos',
      'Cuatro equipos en las esquinas. Sale una jugadora por equipo, roba un cono del centro o de otra base y vuelve. Solo uno cada vez.',
      15, 'half',
      '[{"id":"z1","type":"zone","x":80,"y":55},{"id":"z2","type":"zone","x":650,"y":55},{"id":"z3","type":"zone","x":80,"y":350},{"id":"z4","type":"zone","x":650,"y":350},{"id":"c1","type":"cone","x":410,"y":220},{"id":"c2","type":"cone","x":440,"y":250},{"id":"p1","type":"player","x":180,"y":130,"label":"1"},{"id":"r1","type":"run","x":200,"y":135,"rotation":20}]'::jsonb),
    (date '2026-09-10', 1, 'Caos de balones',
      'Tres equipos y cuatro balones. Para puntuar hay que recibir en una zona exterior. Al marcar, el balón queda allí y se busca inmediatamente otro.',
      20, 'full',
      '[{"id":"z1","type":"zone","x":40,"y":70},{"id":"z2","type":"zone","x":700,"y":70},{"id":"b1","type":"ball","x":410,"y":150},{"id":"b2","type":"ball","x":510,"y":260},{"id":"p1","type":"player","x":280,"y":180,"label":"1"},{"id":"p2","type":"player","x":300,"y":320,"label":"2"},{"id":"o1","type":"opponent","x":580,"y":180,"label":"1"},{"id":"pa1","type":"pass","x":320,"y":180,"rotation":25}]'::jsonb),
    (date '2026-09-10', 2, 'Touch continuo con dos balones',
      'Dos balones activos. Tras touch a dos manos se pasa en menos de dos segundos. Si coinciden en la misma mitad, uno debe cambiar de lado.',
      25, 'full',
      '[{"id":"z1","type":"zone","x":25,"y":120},{"id":"z2","type":"zone","x":715,"y":120},{"id":"b1","type":"ball","x":390,"y":160},{"id":"b2","type":"ball","x":500,"y":350},{"id":"p1","type":"player","x":300,"y":140,"label":"1"},{"id":"p2","type":"player","x":300,"y":360,"label":"2"},{"id":"o1","type":"opponent","x":550,"y":150,"label":"1"},{"id":"pa1","type":"pass","x":320,"y":150,"rotation":10}]'::jsonb),
    (date '2026-09-10', 3, 'Mini torneo: marcar y salir',
      'Partidos de cuatro minutos. Quien marca sale y entra el equipo que espera. Touch a dos manos y cinco posesiones máximas. Últimos 5 minutos de vuelta a la calma.',
      30, 'half',
      '[{"id":"z1","type":"zone","x":40,"y":145},{"id":"z2","type":"zone","x":705,"y":145},{"id":"p1","type":"player","x":290,"y":180,"label":"1"},{"id":"p2","type":"player","x":290,"y":320,"label":"2"},{"id":"o1","type":"opponent","x":520,"y":180,"label":"1"},{"id":"o2","type":"opponent","x":520,"y":320,"label":"2"},{"id":"r1","type":"run","x":310,"y":175,"rotation":8},{"id":"t1","type":"text","x":365,"y":70,"label":"4 MIN · CAMBIO RÁPIDO"}]'::jsonb)
  )
  insert into public.training_exercises (
    training_plan_id, sort_order, title, description, duration_minutes, diagram_data
  )
  select plan.id, data.sort_order, data.title, data.description, data.duration_minutes,
    jsonb_build_object('version', 1, 'template', data.template, 'elements', data.elements)
  from exercise_data data
  join public.training_plans plan on plan.session_date = data.session_date
  where plan.title like 'Pretemporada 0%'
    and not exists (
      select 1 from public.training_exercises existing
      where existing.training_plan_id = plan.id and existing.title = data.title
    );

  insert into public.training_exercise_presets (
    title, description, duration_minutes, diagram_data, created_by
  )
  select exercise.title, exercise.description, exercise.duration_minutes, exercise.diagram_data, selected_owner_id
  from public.training_exercises exercise
  join public.training_plans plan on plan.id = exercise.training_plan_id
  where plan.session_date between date '2026-09-01' and date '2026-09-10'
    and plan.title like 'Pretemporada 0%'
    and exercise.sort_order = 0
    and not exists (
      select 1 from public.training_exercise_presets preset where preset.title = exercise.title
    );
end;
$$;

select session_date, title, status,
  (select sum(duration_minutes) from public.training_exercises where training_plan_id = plan.id) as total_minutes
from public.training_plans plan
where session_date between date '2026-09-01' and date '2026-09-10'
order by session_date;
