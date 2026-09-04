# Contexto permanente del proyecto Unizar

Este archivo contiene el contexto que debe revisarse antes de modificar esta aplicación. Su objetivo es conservar las decisiones funcionales, técnicas y de mantenimiento entre conversaciones.

## Idioma y forma de trabajo

- La aplicación, los textos visibles y la comunicación con el usuario están en español.
- Utilizar lenguaje claro y coherente con el vocabulario existente: jugadoras, entrenadores, Dirección, owner, temporada, tareas, convocatorias y asistencia.
- Antes de cambiar comportamiento existente, revisar las pruebas y los selectores de dominio relacionados.
- Mantener los cambios incrementales y evitar reescrituras amplias si una extracción o modificación localizada es suficiente.
- No modificar ni eliminar cambios locales ajenos a la tarea. Comprobar siempre `git status --short`.
- No añadir dependencias nuevas salvo que aporten una ventaja clara y se haya valorado su coste de mantenimiento y tamaño.

### Estrategia de uso de Codex y cuota

- Priorizar una configuración económica que mantenga la calidad mediante pruebas y validación, sin cambiar de modelo automáticamente sin indicárselo al usuario.
- Configuración recomendada para el trabajo habitual del proyecto: `gpt-5.6-luna` con `model_reasoning_effort = "high"` y `model_verbosity = "low"`. Es adecuada para cambios localizados de React, TypeScript, CSS, calendarios, formularios, exportaciones y pruebas.
- Cambiar puntualmente a `gpt-5.6-terra` con razonamiento `high` cuando la tarea abarque varias áreas, refactorizaciones amplias, permisos, autenticación, RLS o migraciones de Supabase.
- Reservar `gpt-5.6-sol` para problemas especialmente complejos de arquitectura, seguridad, depuración difícil o decisiones de alto impacto. No usar `xhigh` o Pro como valores predeterminados.
- No activar Fast mode para este proyecto: se prioriza consumir menos cuota aunque algunas tareas tarden más.
- Mantener las conversaciones acotadas por funcionalidad y enviar solo los archivos, capturas y contexto necesarios. Las conversaciones largas, los resultados de herramientas y los servidores MCP aumentan el contexto y el consumo.
- Mantener la validación obligatoria (`npm test -- --run`, `npm run lint`, `npm run build` y pruebas E2E cuando proceda); bajar el modelo no debe significar omitir comprobaciones.
- Para una configuración local orientativa de Codex:

  ```toml
  model = "gpt-5.6-luna"
  model_reasoning_effort = "high"
  model_verbosity = "low"
  approval_policy = "on-request"
  sandbox_mode = "workspace-write"
  web_search = "cached"

  [sandbox_workspace_write]
  network_access = false
  ```

- Si una tarea necesita información actual de Supabase, Cloudflare, normativa o dependencias, solicitar búsqueda web actualizada de forma puntual en vez de mantenerla siempre activa.

## Entorno de desarrollo

- Utilizar siempre Node.js 22 mediante:

  ```bash
  source /home/jazcona/.nvm/nvm.sh
  nvm use 22
  ```

- El proyecto utiliza npm y conserva `package-lock.json`.
- Comandos principales:

  ```bash
  npm test -- --run
  npm run lint
  npm run build
  npm run dev
  npm run test:e2e
  ```

- Después de cambios relevantes ejecutar, como mínimo, pruebas, ESLint, build y `git diff --check`.
- El build incluye TypeScript, Vite y generación de la PWA.
- TypeScript está configurado en modo estricto, con comprobación de variables y parámetros sin utilizar.
- No hay Docker ni una instancia local de Supabase en este entorno. No intentar ejecutar `supabase start`, `supabase test db`, `supabase db reset` ni otras comprobaciones que requieran PostgreSQL local.
- Las migraciones SQL se entregan como archivos numerados para que el usuario copie su contenido y lo ejecute manualmente en el editor SQL de la web de Supabase.
- Revisar estáticamente cada migración, mantener actualizados los tipos y las pruebas pgTAP, pero dejar claro que dichas pruebas SQL no se ejecutan localmente.

## Tecnologías

- React 19.
- TypeScript estricto.
- Vite.
- Supabase para autenticación, PostgreSQL, RLS y RPC.
- Vitest y Testing Library.
- Playwright para pruebas E2E.
- PWA mediante `vite-plugin-pwa` y Workbox.
- Konva y React Konva para pizarras tácticas.
- No hay Redux ni otro almacén global. El estado se mantiene mediante hooks y componentes.

## Supabase y límites del plan

- El proyecto utiliza el plan gratuito de Supabase.
- Supabase Free ofrece peticiones API ilimitadas, pero deben vigilarse principalmente transferencia, tamaño de base de datos, usuarios activos, ejecuciones de Edge Functions y uso de Realtime.
- Evitar Realtime, Edge Functions o tablas derivadas cuando una consulta pequeña y una caché sencilla sean suficientes.
- Reducir transferencias y consultas innecesarias, aunque no exista un límite mensual estricto de peticiones API.
- No almacenar datos calculables en tablas adicionales sin una razón clara. Preferir RPC o selectores derivados para evitar problemas de sincronización.
- Todas las modificaciones de esquema deben añadirse como una nueva migración numerada en `supabase/migrations`; nunca editar una migración ya aplicada.
- Actualizar `src/lib/database.types.ts` cuando cambien tablas o funciones RPC.
- Añadir o actualizar pruebas pgTAP en `supabase/tests/schema_test.sql` y ajustar su `plan(...)`.
- Mantener RLS y permisos mínimos. Las RPC con `security definer` deben usar `set search_path = ''`, validar al usuario y limitar explícitamente sus permisos con `revoke`/`grant`.
- No exponer datos privados mediante consultas generales de perfiles.

## Autenticación, perfiles y privacidad

- El acceso se realiza mediante Google.
- El correo procede de la cuenta de Google y se sincroniza desde `auth.users`.
- Los datos privados viven en `profile_private_details`, separados del perfil público:

  - email;
  - teléfono;
  - fecha de nacimiento.

- Cada usuario puede consultar y modificar sus propios datos mediante la RPC restringida `update_own_profile_details`.
- El owner activo puede consultar los datos privados necesarios para administrar el equipo y exportar jugadoras.
- El resto de usuarios no debe recibir fechas de nacimiento, teléfonos o correos de otras personas.
- La modal se denomina “Datos de perfil”, no “Editar mi nombre”.
- La campana muestra un aviso cuando faltan teléfono o fecha de nacimiento. Al abrirlo debe mostrarse la modal de perfil y señalar los campos incompletos.
- La edad siempre se calcula desde la fecha de nacimiento; no se almacena.
- Las fotografías de jugadoras viven en el bucket privado `player-avatars`; `profiles.avatar_path` conserva únicamente la ruta.
- Las fotografías se comprimen en cliente, no usan transformaciones de Supabase y solo se solicitan al abrir Datos de perfil. Los avatares habituales continúan mostrando iniciales para reducir transferencia.

## Roles y permisos

Los roles son acumulables:

- `is_player`: participa como jugadora.
- `is_coach`: entrenador o entrenadora.
- `is_viewer`: Dirección con acceso de consulta.
- `is_owner`: administración general.

Además existen los estados:

- `is_approved`;
- `is_active`;
- `is_archived`.

Reglas importantes:

- Una persona puede ser jugadora y entrenadora simultáneamente.
- Ser staff no elimina automáticamente la condición de jugadora.
- Solo los perfiles aprobados, activos, no archivados y con `is_player` cuentan como jugadoras activas.
- Owner y entrenador gestionan el ámbito deportivo.
- Dirección consulta información del equipo, pero no debe adquirir permisos de escritura deportiva.
- Solo el owner administra temporadas, permisos, vinculaciones y datos privados del equipo.
- En Ajustes → Equipo, el listado es informativo y no contiene controles de permisos. Cada tarjeta abre Datos de perfil y el lápiz activa la edición de nombre, teléfono, fecha de nacimiento, fotografía, estado y roles; el email de Google es siempre de solo lectura.
- Los cambios de estado o roles requieren confirmación. Desautorizar y restaurar se realizan dentro de la ficha, nunca desde el listado.
- El owner no puede desactivarse, quitarse su propio rol ni dejar la aplicación sin otro owner activo; estas reglas se validan también en las RPC.
- Las reglas comunes están en `src/lib/permissions.ts`, `src/lib/selectors.ts` y `src/app/appAccess.ts`. No duplicarlas en componentes.

## Temporadas y vinculaciones

- Solo puede existir una temporada que cubra una fecha determinada; las temporadas no deben solaparse.
- `season_players` registra periodos de pertenencia mediante `active_from` y `active_until`.
- Todas las estadísticas, tareas, convocatorias, asistencia y cumpleaños deben respetar el periodo real de vinculación.
- Una vinculación abierta de una temporada terminada no convierte a la jugadora en activa en una temporada posterior.
- Al aprobar y activar una jugadora puede asignarse automáticamente a la temporada vigente.
- Antes de reducir las fechas de una temporada se comprueba que tareas, partidos, entrenamientos y avisos sigan dentro de ella.

## Secciones visibles

### Inicio

- Panel personal para jugadoras y panel de equipo para staff.
- Resume tareas semanales, asistencia, próximos partidos y avisos.
- Las jugadoras pueden consultar su resumen de temporada.
- Muestra una línea ligera si hoy cumple años una o varias jugadoras activas.

### Resumen

- Visible para owner, entrenadores y Dirección con permiso de consulta.
- Estadísticas mensuales de asistencia y tareas.
- Calendario mensual y detalle diario.
- En Resumen solo el owner ve el calendario de cumpleaños; los entrenadores reciben la misma información únicamente dentro del Calendario de gestión.
- La marca de cumpleaños es `🎂` y el detalle aparece encima del cumplimiento semanal.

### Calendario

- Vista unificada de gestión para owner y entrenadores.
- Reúne tareas, avisos, partidos y entrenamientos publicados.
- Owner y entrenadores ven además la marca de cumpleaños `🎂` y, al seleccionar el día, el nombre y la edad que cumple cada jugadora activa.
- Las jugadoras también usan Calendario como su única vista de planificación: reúne tareas y avisos publicados, partidos, disponibilidad, convocatorias y cumpleaños. No reciben planes de entrenamiento privados.
- Dirección conserva la vista independiente de Partidos porque no tiene acceso a tareas.
- Permite editar estados, convocatorias, disponibilidad y planificación.
- Las tarjetas de entrenamientos publicados enlazan con el detalle completo, incluidos entrenamientos de fechas pasadas.
- Evitar leyendas inferiores redundantes cuando las marcas ya son conocidas por los usuarios de gestión.

### Entrenamientos

- Planificación privada para owner y entrenadores.
- Incluye sesiones, ejercicios reutilizables y pizarras tácticas.
- Componentes principales en `src/features/trainingPlans`:

  - `TrainingPlansView` como controlador/listado;
  - `TrainingPlanEditor`;
  - `TrainingPlanDetail`;
  - `TrainingExerciseLibrary`;
  - `TrainingPresetEditor`;
  - `TacticsBoard`;
  - `trainingPlanMappers` para transformaciones puras y modo demo.
- En el editor, la única acción “Añadir ejercicio” aparece debajo del último ejercicio. Los ejercicios nuevos se incorporan al final y se reordenan con los controles existentes.
- `demo.local` monta esta sección con datos en memoria mediante la propiedad `demo`; no debe consultar Supabase.
- El detalle ofrece “Guardar PDF” mediante el diálogo de impresión nativo y una hoja de estilos de impresión, sin añadir una dependencia de generación de PDF.

### Tareas

- Las jugadoras ven y completan desde Calendario las tareas publicadas que les corresponden; la ruta histórica de Tareas redirige a Calendario.
- El staff gestiona publicación, edición, orden, avisos y resultados.
- Las tareas se asignan por semana y deben respetar temporada y vinculación.

### Partidos

- Incluye partidos oficiales y amistosos, disponibilidad y convocatorias.
- Las jugadoras consultan y responden los partidos desde Calendario; Dirección mantiene la sección independiente de Partidos.
- Las alineaciones publicadas tienen restricciones de edición y desbloqueo.
- Las convocatorias y resúmenes deben respetar la jugadora, el partido, la temporada y el periodo de vinculación.

### Competición

- Clasificación, calendario y estadísticas procedentes de la fuente de competición.
- La sincronización queda reservada al owner.

### Asistencia

- Owner y entrenadores registran asistencia de campo.
- El guardado se realiza de forma atómica mediante RPC.
- Los informes de temporada están disponibles según los permisos de consulta del equipo.
- Las personas que entrenan antes de crear su cuenta se guardan como invitadas en `provisional_players`, nunca como perfiles falsos ligados a `auth.users`.
- Una invitada solo genera presencias en `provisional_training_attendance`; no cuenta como ausencia ni modifica el porcentaje de asistencia de la plantilla mientras siga siendo provisional.
- El detalle diario sí suma invitadas al total real de asistentes y las identifica expresamente.
- Solo el owner vincula manualmente una invitada con un perfil real. `link_provisional_player` migra su histórico sin duplicados y ajusta la pertenencia a la temporada desde la primera asistencia.
- No vincular automáticamente por similitud de nombre; la coincidencia sirve únicamente como sugerencia que el owner debe confirmar.

### Ajustes

- Exclusivo del owner.
- Gestión de equipo, permisos, datos de contacto, temporadas y vinculaciones.
- La exportación de jugadoras de la temporada incluye:

  - nombre;
  - email;
  - teléfono;
  - edad;
  - fecha de nacimiento.

## Cumpleaños

- Solo cuentan jugadoras de la temporada activa que estén aprobadas, activas, no archivadas y vinculadas en la fecha del cumpleaños.
- Entrenadores, Dirección y owner no cuentan salvo que además tengan `is_player`.
- No existe tabla de cumpleaños; son datos derivados.
- `get_today_active_player_birthdays()` devuelve únicamente identificador y nombre a usuarios aprobados y activos.
- `get_active_season_birthdays()` devuelve a owner y entrenadores las ocurrencias de toda la temporada, con fecha y edad que cumplirá la jugadora.
- `get_player_season_birthday_calendar()` devuelve a jugadoras activas únicamente nombre y día del cumpleaños dentro de la temporada. Nunca expone edad, año de nacimiento ni la fecha privada original.
- El año de nacimiento y la fecha privada no deben exponerse al resto del equipo.
- El 29 de febrero se celebra el 28 de febrero en años no bisiestos.
- La consulta diaria se cachea por usuario y día.
- El calendario completo del owner se cachea por temporada y día.
- El calendario seguro de jugadoras se cachea por usuario, temporada y día.
- La caché se invalida localmente tras cambios de perfil, permisos, temporada o vinculación. Los cambios realizados desde otro dispositivo se actualizan como máximo al día siguiente.
- No utilizar Realtime para cumpleaños.

## Arquitectura actual

### Composición de la aplicación

- `src/App.tsx` debe mantenerse como raíz de composición, autenticación y montaje del layout.
- `src/app/AppViewRouter.tsx` conecta cada vista con sus datos y acciones.
- `src/app/viewModules.ts` centraliza lazy loading y precarga de vistas.
- `src/hooks/useAppNavigation.ts` gestiona historial y navegación.
- `src/hooks/useOperationFeedback.ts` gestiona mensajes, errores y comprobación de conexión.
- `src/app/actions` separa operaciones por dominio:

  - tareas;
  - avisos;
  - partidos;
  - administración del club.

- No volver a introducir todos los handlers y vistas dentro de `App.tsx`.

### Datos de entrenamiento

- `useTrainingData` coordina carga, actualización automática y rangos visibles.
- Los algoritmos puros de combinación y restauración están en `hooks/trainingDataCache.ts`.
- Mantener los identificadores de petición que evitan que una respuesta antigua sobrescriba otra nueva.
- No dividir `useTrainingData` en hooks independientes que muten el mismo estado sin diseñar antes la coordinación de concurrencia.
- Servicios actuales:

  - `trainingDataService.ts`: agregación de datos por vista;
  - `trainingQueriesService.ts`: ventanas de tareas, partidos y asistencia;
  - `trainingAttendanceService.ts`: escritura de asistencia;
  - `trainingMembershipService.ts`: vinculaciones;
  - `seasonsService.ts`: temporadas;
  - `profilesService.ts`: permisos y perfil privado;
  - `birthdayService.ts`: consultas y caché de cumpleaños;
  - servicios específicos de tareas, partidos, avisos, competición y planificación.

- No recrear un `trainingService.ts` monolítico.

### Componentes y lógica pura

- Extraer componentes cuando un archivo contenga varias pantallas o editores completos.
- Extraer transformaciones y cálculos de dominio a módulos puros para probarlos sin React.
- No crear hooks únicamente para ocultar código; utilizar hooks para estado, efectos o comportamiento reutilizable.
- Evitar contextos globales para dependencias que pueden pasarse explícitamente por el router de vistas.
- Agrupar acciones relacionadas en objetos por dominio cuando una vista necesite muchas callbacks.

### Estilos

- Actualmente los estilos globales principales están en `src/App.css` y `src/index.css`.
- Conservar nombres de clase existentes al extraer componentes para evitar cambios visuales involuntarios.
- Si `App.css` sigue creciendo, dividir por funcionalidad manteniendo el orden de importación y la cascada. No migrar toda la aplicación a CSS Modules dentro de una modificación funcional pequeña.
- Verificar siempre escritorio y móvil después de cambios en calendarios, modales, navegación o formularios.

## Fechas y zona horaria

- La zona funcional del equipo es `Europe/Madrid`.
- En cliente utilizar los helpers de `src/lib/dates.ts`; evitar conversiones UTC improvisadas.
- En SQL sensible al día actual utilizar la fecha de Madrid.
- Las semanas comienzan en lunes.
- Las pruebas que dependen del día de la semana deben fijar el reloj con `vi.setSystemTime`; no deben depender de la fecha real de ejecución.

## Rendimiento y caché

- La aplicación recarga datos al recuperar foco o conexión si están obsoletos.
- Las vistas cargan ventanas de fechas y conservan rangos adicionales ya consultados.
- No eliminar la protección frente a respuestas fuera de orden.
- Las listas habituales tienen decenas de personas; priorizar consultas claras y payloads mínimos antes que tablas precalculadas.
- Al añadir una consulta a Inicio, evitar cargar datos privados o colecciones completas si basta con un resumen RPC.
- No invalidar toda la caché del navegador salvo que el cambio afecte realmente a esos datos.

## Notificaciones

- La campana combina avisos funcionales y recordatorios del perfil.
- Los cumpleaños no generan elementos persistentes en la campana; se muestran como una línea en Inicio y, para el owner, en el calendario de Resumen.
- Los mensajes de éxito compartidos utilizan `useOperationFeedback`.
- Si llega un mensaje nuevo antes de ocultar el anterior, debe reiniciarse el temporizador para que el nuevo mensaje permanezca visible el tiempo completo.

## Pruebas y definición de terminado

- Mantener o ampliar pruebas para cualquier regla de negocio modificada.
- Las pruebas se encuentran junto a componentes, hooks y servicios.
- Utilizar fixtures de `src/test/fixtures.ts` cuando sea posible.
- Para funciones SQL, comprobar existencia, permisos y restricciones en pgTAP.
- Una modificación no se considera terminada hasta que pasen:

  ```bash
  npm test -- --run
  npm run lint
  npm run build
  git diff --check
  ```

- Para cambios visuales relevantes añadir o actualizar pruebas de Testing Library y, cuando proceda, Playwright móvil.
- Mantener `demo.local` sincronizada con las funcionalidades que deban poder probarse sin Supabase. Cuando se modifique una funcionalidad representada en la demo, comprobar también:

  ```bash
  npx tsc -p demo.local/tsconfig.json
  npx vite build --config demo.local/vite.config.ts
  npm run test:e2e
  ```

- No presentar la ausencia de pruebas locales de base de datos como un fallo pendiente: es el flujo de trabajo previsto. Informar únicamente de que la migración debe ejecutarse y validarse en Supabase web.

## Archivos generados y sensibles

- `src/lib/database.types.ts` refleja el esquema de Supabase; actualizarlo de forma coherente con las migraciones.
- `dist` es generado por el build y no es fuente de verdad.
- No incluir claves, tokens, URLs privadas ni credenciales en documentación, pruebas o commits.
- No modificar assets o datos de demostración salvo que formen parte explícita de la tarea.

## Criterio para futuras mejoras

Antes de implementar una nueva funcionalidad, comprobar:

1. Qué roles pueden verla y modificarla.
2. Si debe respetar temporada y periodo de vinculación.
3. Si contiene información privada.
4. Si puede derivarse en lugar de almacenarse.
5. Qué consulta mínima necesita cada rol.
6. Cómo se invalida o actualiza su caché.
7. Qué sucede sin conexión.
8. Cómo se comporta en móvil.
9. Qué pruebas protegen la regla.
10. Si requiere migración y actualización de tipos de Supabase.
