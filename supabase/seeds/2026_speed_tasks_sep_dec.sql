-- Plan de velocidad para jugadoras de rugby de nivel medio (septiembre-diciembre de 2026).
-- Crea dos tareas de 30 minutos por semana como borradores y puede ejecutarse
-- varias veces sin duplicarlas. Selecciona la temporada que cubre todo el bloque
-- y el owner activo más antiguo como creador.
do $$
declare
  selected_season_id uuid;
  selected_owner_id uuid;
  inserted_count integer;
begin
  select id into selected_season_id
  from public.seasons
  where start_date <= date '2026-09-07'
    and end_date >= date '2026-12-27'
  order by start_date desc
  limit 1;

  if selected_season_id is null then
    raise exception 'No existe una temporada que cubra del 7 de septiembre al 27 de diciembre de 2026';
  end if;

  select id into selected_owner_id
  from public.profiles
  where is_owner
    and is_approved
    and is_active
    and not is_archived
  order by created_at
  limit 1;

  if selected_owner_id is null then
    raise exception 'No existe ningún owner activo y aprobado para crear las tareas';
  end if;

  with planned_tasks (week_start, title, description, training_type) as (
    values
      (
        date '2026-09-07',
        'Velocidad 01 · Técnica de salida y 10 metros',
        E'Objetivo: aprender una salida estable y acelerar sin tensión.\n\n0–8 min · Calentamiento: trote suave, movilidad de tobillo y cadera, 2 progresivos de 20 m.\n8–13 min · Técnica: 2 rondas de skipping, marcha de aceleración y caída hacia delante (10 m cada ejercicio).\n13–26 min · Principal: 6 × 10 m desde posición cómoda y 4 × 15 m al 80–85 %. Descansa caminando 45–60 s.\n26–30 min · Vuelta a la calma: caminar y movilidad suave.\n\nClave: empuja el suelo hacia atrás y aumenta la zancada poco a poco.',
        'Físico'
      ),
      (
        date '2026-09-07',
        'Potencia 01 · Aterrizajes y fuerza básica',
        E'Objetivo: preparar tobillos, rodillas y cadera para saltar con seguridad.\n\n0–8 min · Calentamiento: movilidad, 2 × 10 sentadillas y 2 × 15 rebotes suaves de tobillo.\n8–14 min · Técnica: 3 × 5 caídas desde puntillas a media sentadilla; mantén la recepción 2 s.\n14–26 min · Circuito, 3 rondas: 8 sentadillas lentas, 6 zancadas atrás por lado, 10 puentes de glúteo y 12 pogos bajos. Descansa 45 s.\n26–30 min · Vuelta a la calma.\n\nClave: recepción silenciosa, rodillas alineadas con los pies.',
        'Gimnasio'
      ),
      (
        date '2026-09-14',
        'Velocidad 02 · Salidas variadas y 15 metros',
        E'Objetivo: reaccionar y acelerar desde posiciones habituales en rugby.\n\n0–8 min · Calentamiento y 2 progresivos de 20 m.\n8–13 min · Técnica: 3 × 10 m de skipping y 3 salidas por caída.\n13–26 min · Principal: 2 rondas de 4 × 15 m desde tumbada, de rodillas, lateral y de pie. Descansa 45 s entre repeticiones y 2 min entre rondas. Intensidad 85 %.\n26–30 min · Vuelta a la calma.\n\nClave: primero empuja fuerte; levanta el tronco de forma gradual.',
        'Físico'
      ),
      (
        date '2026-09-14',
        'Potencia 02 · Saltos bajos y fuerza unilateral',
        E'Objetivo: mejorar estabilidad y producir fuerza con una pierna.\n\n0–8 min · Calentamiento dinámico.\n8–14 min · Técnica: 3 × 5 saltos verticales bajos con recepción estable.\n14–26 min · Circuito, 3 rondas: 6 split squats por lado, 8 step-ups por lado en escalón bajo, 10 pogos y plancha 25 s. Descansa 45 s.\n26–30 min · Vuelta a la calma.\n\nSin material: sustituye el step-up por zancada adelante.',
        'Gimnasio'
      ),
      (
        date '2026-09-21',
        'Velocidad 03 · Aceleración progresiva hasta 20 metros',
        E'Objetivo: mantener una aceleración eficaz durante más metros.\n\n0–8 min · Calentamiento y movilidad.\n8–13 min · Técnica: 2 × 15 m de ankling, skipping y carrera progresiva.\n13–26 min · Principal: 4 × 10 m al 85 %, 4 × 20 m al 85–90 % y 2 × 20 m empezando suave y terminando rápido. Descansa 60–75 s.\n26–30 min · Vuelta a la calma.\n\nDelanteras: prioriza los 10 m. Línea: conserva las 6 repeticiones de 20 m.',
        'Físico'
      ),
      (
        date '2026-09-21',
        'Potencia 03 · Impulso horizontal y control lateral',
        E'Objetivo: orientar la fuerza hacia delante y estabilizar cambios laterales.\n\n0–8 min · Calentamiento dinámico.\n8–14 min · Técnica: 3 × 4 saltos horizontales cortos con recepción de 2 s.\n14–26 min · Circuito, 3 rondas: 5 saltos horizontales, 5 saltos laterales por lado, 8 peso muerto a una pierna sin carga por lado y 12 elevaciones de gemelo. Descansa 45 s.\n26–30 min · Vuelta a la calma.\n\nBusca distancia controlada, no máxima.',
        'Gimnasio'
      ),
      (
        date '2026-09-28',
        'Velocidad 04 · Consolidación y control de 20 metros',
        E'Objetivo: terminar el primer bloque con carreras rápidas de buena calidad.\n\n0–8 min · Calentamiento y 2 progresivos.\n8–12 min · Técnica de salida: 4 × 10 m al 80 %.\n12–26 min · Principal: 6 × 20 m al 90 %, con 75–90 s de descanso. Anota el tiempo de las repeticiones 2 y 6 si puedes.\n26–30 min · Vuelta a la calma.\n\nLa última repetición debe conservar la misma técnica que la primera.',
        'Físico'
      ),
      (
        date '2026-09-28',
        'Potencia 04 · Semana de control y descarga',
        E'Objetivo: consolidar la técnica reduciendo el volumen.\n\n0–8 min · Calentamiento.\n8–14 min · Técnica: 3 × 4 salto vertical con recepción y 3 × 4 salto horizontal.\n14–25 min · Circuito, 2 rondas: 8 sentadillas, 6 zancadas por lado, 8 pogos y plancha lateral 20 s por lado.\n25–30 min · Movilidad de tobillo, cadera y aductores.\n\nTermina con sensación de poder hacer una ronda más.',
        'Gimnasio'
      ),
      (
        date '2026-10-05',
        'Velocidad 05 · Primeros pasos potentes',
        E'Objetivo: aplicar más fuerza en los primeros cinco apoyos.\n\n0–8 min · Calentamiento y progresivos.\n8–13 min · Técnica: 4 salidas con tres apoyos fuertes y frenada suave.\n13–26 min · Principal: 3 rondas de 3 × 10 m al 90–92 %. Descansa 45–60 s y 2 min entre rondas.\n26–30 min · Vuelta a la calma.\n\nDelanteras: sal desde posición baja o de placaje sin contacto. Línea: añade 10 m lanzados al final de cada ronda.',
        'Físico'
      ),
      (
        date '2026-10-05',
        'Potencia 05 · Saltos horizontales y split squat',
        E'Objetivo: reforzar el impulso horizontal para la aceleración.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica: 3 × 4 saltos horizontales, recuperando la posición.\n13–26 min · 3 rondas: 5 saltos horizontales, 8 split squats por lado, 8 hip thrust a una pierna por lado y 12 pogos. Descansa 60 s.\n26–30 min · Vuelta a la calma.\n\nUsa mochila ligera solo si dominas el movimiento sin carga.',
        'Gimnasio'
      ),
      (
        date '2026-10-12',
        'Velocidad 06 · Aceleración con ligera resistencia',
        E'Objetivo: mejorar el empuje sin alterar la postura.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica: 4 × 10 m en cuesta muy suave o con banda ligera.\n13–26 min · Principal: 6 × 15 m con resistencia ligera y 4 × 15 m libres al 90 %. Descansa 60–75 s.\n26–30 min · Vuelta a la calma.\n\nSin cuesta o banda: realiza todas las repeticiones libres. No uses cargas que te hagan correr despacio.',
        'Físico'
      ),
      (
        date '2026-10-12',
        'Potencia 06 · Unilateral y tobillo reactivo',
        E'Objetivo: ganar rigidez de tobillo y estabilidad a una pierna.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica: 3 × 12 pogos y 2 × 5 recepciones a una pierna por lado.\n13–26 min · 3 rondas: 6 step-ups potentes por lado, 6 zancadas laterales por lado, 8 peso muerto a una pierna por lado y 15 s de pogos. Descansa 60 s.\n26–30 min · Vuelta a la calma.\n\nMantén los contactos de los pogos cortos y pequeños.',
        'Gimnasio'
      ),
      (
        date '2026-10-19',
        'Velocidad 07 · Frenada y cambio de dirección',
        E'Objetivo: desacelerar con control y volver a acelerar.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica: 4 × 10 m con frenada progresiva en 4 apoyos.\n13–26 min · Principal: 4 × recorrido 5+5 m con giro de 180° y 4 × recorrido 5+5+5 m en zigzag. Descansa 60–75 s; intensidad 85–90 %.\n26–30 min · Vuelta a la calma.\n\nDelanteras: giros más cerrados y salida baja. Línea: separa los conos 7 m.',
        'Físico'
      ),
      (
        date '2026-10-19',
        'Potencia 07 · Fuerza lateral y multisaltos cortos',
        E'Objetivo: producir y absorber fuerza en desplazamientos laterales.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica: 3 × 5 saltos laterales por lado con pausa.\n13–26 min · 3 rondas: 6 saltos de patinador por lado, 8 zancadas laterales por lado, 6 saltos verticales y plancha lateral 25 s por lado. Descansa 60 s.\n26–30 min · Vuelta a la calma.\n\nControla la recepción antes de buscar más amplitud.',
        'Gimnasio'
      ),
      (
        date '2026-10-26',
        'Velocidad 08 · Control de aceleración y descarga',
        E'Objetivo: comprobar la mejora sin acumular fatiga.\n\n0–8 min · Calentamiento completo.\n8–12 min · Técnica: 3 salidas de 10 m.\n12–25 min · Principal: 4 × 20 m al 90–95 %, con 2 min de descanso. Cronometra dos intentos si es posible y compáralos con septiembre.\n25–30 min · Vuelta a la calma.\n\nDetén la serie si el tiempo empeora más de un 5 %.',
        'Físico'
      ),
      (
        date '2026-10-26',
        'Potencia 08 · Descarga de fuerza y movilidad',
        E'Objetivo: asimilar el bloque manteniendo fuerza y elasticidad.\n\n0–8 min · Calentamiento.\n8–13 min · 2 × 5 saltos verticales y 2 × 8 pogos.\n13–24 min · 2 rondas: 8 split squats por lado, 10 puentes de glúteo, 10 elevaciones de gemelo por lado y plancha 30 s.\n24–30 min · Movilidad de tobillo, flexor de cadera y aductores.\n\nTrabajo cómodo, con dos repeticiones en reserva.',
        'Gimnasio'
      ),
      (
        date '2026-11-02',
        'Velocidad 09 · Carrera lanzada y velocidad máxima',
        E'Objetivo: correr rápido con postura alta y relajada.\n\n0–9 min · Calentamiento y 3 progresivos de 30 m.\n9–14 min · Técnica: dribbles y skipping, 2 × 15 m cada uno.\n14–26 min · Principal: 6 × 30 m con 20 m de aceleración y 10 m rápidos al 92–95 %. Descansa 90 s.\n26–30 min · Vuelta a la calma.\n\nLínea: añade 5 m rápidos si hay espacio. Delanteras: mantén los 10 m rápidos.',
        'Físico'
      ),
      (
        date '2026-11-02',
        'Potencia 09 · Reactividad vertical',
        E'Objetivo: reducir el tiempo de contacto manteniendo buena alineación.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica: 3 × 10 pogos y 3 × 4 saltos verticales.\n13–26 min · 3 rondas: 5 saltos verticales rápidos, 6 split squat con impulso por lado, 8 hip thrust a una pierna por lado y 20 s de plancha. Descansa 60–75 s.\n26–30 min · Vuelta a la calma.\n\nSalta bajo y rápido; si pierdes control, vuelve a la versión sin impulso.',
        'Gimnasio'
      ),
      (
        date '2026-11-09',
        'Velocidad 10 · Sprints repetidos de 20 metros',
        E'Objetivo: repetir esfuerzos rápidos sin perder demasiada velocidad.\n\n0–9 min · Calentamiento.\n9–13 min · 3 progresivos de 20 m.\n13–26 min · Principal: 2 bloques de 5 × 20 m al 90–95 %, saliendo cada 40 s. Descansa 3 min entre bloques.\n26–30 min · Vuelta a la calma.\n\nMantén margen: no es una prueba de resistencia. Para si la técnica se deteriora.',
        'Físico'
      ),
      (
        date '2026-11-09',
        'Potencia 10 · Fuerza unilateral con impulso',
        E'Objetivo: aplicar fuerza rápida desde una pierna.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica: 3 × 4 step-up con impulso por lado.\n13–26 min · 3 rondas: 5 step-up con impulso por lado, 6 zancadas atrás por lado, 5 saltos horizontales y 12 elevaciones rápidas de gemelo. Descansa 75 s.\n26–30 min · Vuelta a la calma.\n\nEl escalón debe permitir subir sin inclinar el tronco.',
        'Gimnasio'
      ),
      (
        date '2026-11-16',
        'Velocidad 11 · Persecución y carrera en curva',
        E'Objetivo: acelerar siguiendo trayectorias propias del juego.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica: 4 curvas progresivas de 20 m, dos por lado.\n13–26 min · Principal: 6 × 20 m en curva y 4 × 15 m reaccionando a una señal o persiguiendo a una compañera con 2 m de ventaja. Descansa 60–90 s.\n26–30 min · Vuelta a la calma.\n\nSi entrenas sola, usa una alarma aleatoria como señal.',
        'Físico'
      ),
      (
        date '2026-11-16',
        'Potencia 11 · Saltos encadenados con control',
        E'Objetivo: enlazar apoyos potentes sin perder estabilidad.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica: 3 × 4 secuencias de dos saltos horizontales y recepción.\n13–26 min · 3 rondas: 4 dobles saltos horizontales, 5 saltos de patinador por lado, 8 sentadillas a una pierna asistidas por lado y plancha 30 s. Descansa 75 s.\n26–30 min · Vuelta a la calma.\n\nPausa entre secuencias; cada apoyo debe quedar alineado.',
        'Gimnasio'
      ),
      (
        date '2026-11-23',
        'Velocidad 12 · Aceleración específica por posiciones',
        E'Objetivo: acercar la velocidad a las demandas de cada posición.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica: 4 salidas reactivas de 10 m.\n13–26 min · Delanteras: 3 rondas de 3 × 10 m desde posición baja, 45 s de pausa. Línea: 2 rondas de 4 × 25 m, 60 s de pausa. Descansa 2 min entre rondas.\n26–30 min · Vuelta a la calma.\n\nTodas: máxima intención, sin contacto y con frenada progresiva.',
        'Físico'
      ),
      (
        date '2026-11-23',
        'Potencia 12 · Potencia específica por posiciones',
        E'Objetivo: enfatizar la fuerza útil para cada grupo.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica: 3 × 4 saltos horizontales.\n13–26 min · Delanteras, 3 rondas: 8 sentadillas con mochila moderada, 6 saltos verticales y empuje isométrico contra pared 20 s. Línea, 3 rondas: 6 split jumps por lado, 6 saltos horizontales y 10 pogos. Descansa 75 s.\n26–30 min · Vuelta a la calma.\n\nElige la versión general sin carga si entrenas sin supervisión.',
        'Gimnasio'
      ),
      (
        date '2026-11-30',
        'Velocidad 13 · Calidad rápida con poco volumen',
        E'Objetivo: asimilar noviembre conservando velocidad.\n\n0–9 min · Calentamiento completo.\n9–13 min · Técnica: 3 × 10 m de aceleración.\n13–25 min · Principal: 3 × 15 m y 3 × 25 m al 92–95 %, descansando 90 s.\n25–30 min · Vuelta a la calma.\n\nSesión de descarga: termina fresca y no añadas repeticiones.',
        'Físico'
      ),
      (
        date '2026-11-30',
        'Potencia 13 · Descarga reactiva',
        E'Objetivo: mantener la potencia reduciendo impactos.\n\n0–8 min · Calentamiento.\n8–13 min · 2 × 10 pogos y 2 × 4 saltos verticales.\n13–24 min · 2 rondas: 6 step-ups por lado, 6 peso muerto a una pierna por lado, 5 saltos horizontales y plancha lateral 20 s por lado.\n24–30 min · Movilidad y respiración suave.\n\nDeja dos o tres repeticiones en reserva.',
        'Gimnasio'
      ),
      (
        date '2026-12-07',
        'Velocidad 14 · Velocidad mantenida de 30 metros',
        E'Objetivo: sostener una carrera rápida después de acelerar.\n\n0–9 min · Calentamiento y 3 progresivos.\n9–13 min · Técnica: 3 × 15 m relajados.\n13–26 min · Principal: 6 × 30 m al 92–95 %, descansando 90–120 s.\n26–30 min · Vuelta a la calma.\n\nDelanteras: 6 × 20 m. Línea: 6 × 30 m. Mantén hombros y cara relajados.',
        'Físico'
      ),
      (
        date '2026-12-07',
        'Potencia 14 · Contraste fuerza y salto',
        E'Objetivo: combinar un gesto de fuerza controlado con uno rápido.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica de sentadilla y salto.\n13–26 min · 3 rondas: 6 sentadillas con mochila moderada + 4 saltos verticales; 6 split squats por lado + 4 saltos horizontales. Descansa 75–90 s entre rondas.\n26–30 min · Vuelta a la calma.\n\nSin experiencia con carga, realiza las sentadillas lentas solo con peso corporal.',
        'Gimnasio'
      ),
      (
        date '2026-12-14',
        'Velocidad 15 · Reacción y evasión',
        E'Objetivo: acelerar y cambiar de dirección ante una señal.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica: 4 frenadas y salidas de 10 m.\n13–26 min · Principal: 3 rondas de 4 repeticiones de 5 m + cambio indicado + 10 m de sprint. Descansa 45–60 s y 2 min entre rondas.\n26–30 min · Vuelta a la calma.\n\nCon compañera: que señale izquierda o derecha. Sola: alterna patrones preparados sin anticipar durante la carrera.',
        'Físico'
      ),
      (
        date '2026-12-14',
        'Potencia 15 · Reactividad multidireccional',
        E'Objetivo: responder rápido en vertical, horizontal y lateral.\n\n0–8 min · Calentamiento.\n8–13 min · Técnica: 2 × 5 recepciones en cada dirección.\n13–26 min · 3 rondas: 5 saltos verticales, 5 horizontales, 5 de patinador por lado y 6 zancadas atrás por lado. Descansa 75 s.\n26–30 min · Vuelta a la calma.\n\nCalidad antes que distancia; estabiliza cada último salto.',
        'Gimnasio'
      ),
      (
        date '2026-12-21',
        'Velocidad 16 · Control final y sesión rápida',
        E'Objetivo: cerrar el bloque comprobando la aceleración sin fatiga excesiva.\n\n0–9 min · Calentamiento completo.\n9–13 min · Técnica: 3 salidas de 10 m.\n13–25 min · Principal: 3 × 10 m y 3 × 20 m al 95 %, con 2 min de descanso. Cronometra los 20 m y compáralos con septiembre y octubre.\n25–30 min · Vuelta a la calma.\n\nBusca tu mejor ejecución, no agotarte.',
        'Físico'
      ),
      (
        date '2026-12-21',
        'Potencia 16 · Repaso final y descarga',
        E'Objetivo: cerrar el ciclo con movimientos conocidos y poco volumen.\n\n0–8 min · Calentamiento.\n8–13 min · 2 × 8 pogos y 2 × 4 saltos horizontales.\n13–24 min · 2 rondas: 8 sentadillas, 6 split squats por lado, 5 saltos verticales y 10 puentes de glúteo.\n24–30 min · Movilidad general y respiración.\n\nTodo debe sentirse rápido y cómodo; termina con energía.',
        'Gimnasio'
      )
  )
  insert into public.tasks (
    season_id,
    week_start,
    title,
    description,
    training_type,
    status,
    created_by
  )
  select
    selected_season_id,
    planned.week_start,
    planned.title,
    planned.description || E'\n\nSeguridad: realiza la sesión en una superficie estable, deja recuperación suficiente y detente ante dolor o molestias anormales.',
    planned.training_type,
    'draft'::public.task_status,
    selected_owner_id
  from planned_tasks planned
  where not exists (
    select 1
    from public.tasks existing
    where existing.season_id = selected_season_id
      and existing.week_start = planned.week_start
      and existing.title = planned.title
  );

  get diagnostics inserted_count = row_count;
  raise notice 'Se han creado % tareas en borrador', inserted_count;
end;
$$;

-- Resumen para comprobar la carga antes de revisar cada borrador en la aplicación.
select week_start, title, training_type, status
from public.tasks
where week_start between date '2026-09-07' and date '2026-12-21'
  and (title like 'Velocidad %' or title like 'Potencia %')
order by week_start, training_type desc;
