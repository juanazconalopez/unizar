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
- Configuración recomendada para el trabajo habitual del proyecto: `gpt-6-sol` con `model_reasoning_effort = "medium"` y `model_verbosity = "low"`. Es el mejor equilibrio para cambios de React, TypeScript, CSS, calendarios, formularios, exportaciones, pruebas y flujos que requieren inspección, implementación y validación.
- Usar `gpt-6-luna` con razonamiento `high` solo para trabajo claramente acotado y repetible: búsquedas y lecturas de código, cambios mecánicos pequeños, extracción de utilidades y comprobaciones de bajo riesgo. Si el alcance deja de estar claro o afecta a varias capas, volver a `gpt-6-sol`.
- Reservar `gpt-6-astra` con razonamiento `medium` o `high` para arquitectura, seguridad, RLS, autenticación, migraciones complejas de Supabase, depuración difícil o decisiones de alto impacto. No usar `xhigh`, `max` ni Ultra como valores predeterminados.
- No activar Fast mode para este proyecto: se prioriza consumir menos cuota aunque algunas tareas tarden más.
- Mantener las conversaciones acotadas por funcionalidad y enviar solo los archivos, capturas y contexto necesarios. Las conversaciones largas, los resultados de herramientas y los servidores MCP aumentan el contexto y el consumo.
- Mantener la cobertura y las comprobaciones de CI: lint y build en los pipelines de cambios; tests y Playwright en la ejecución nocturna. Bajar el modelo no debe significar omitir estas comprobaciones. En local aplicar la política de «Pruebas y definición de terminado»: no ejecutar tests ni Playwright por defecto.
- Para una configuración local orientativa de Codex:

  ```toml
  model = "gpt-6-sol"
  model_reasoning_effort = "medium"
  model_verbosity = "low"
  approval_policy = "on-request"
  sandbox_mode = "workspace-write"
  web_search = "cached"

  [sandbox_workspace_write]
  network_access = false
  ```

- Si una tarea necesita información actual de Supabase, Cloudflare, normativa o dependencias, solicitar búsqueda web actualizada de forma puntual en vez de mantenerla siempre activa.

## Entorno de desarrollo

- Utilizar siempre la versión de Node.js 24 LTS fijada en `.nvmrc` y `.node-version` mediante:

  ```bash
  source /home/jazcona/.nvm/nvm.sh
  nvm use
  ```

- El proyecto utiliza npm y conserva `package-lock.json`; instalar con `npm ci`. `.npmrc` comprueba la rama de Node. Al actualizar Node, sincronizar `.nvmrc`, `.node-version`, `engines` y cualquier variable `NODE_VERSION` del build remoto.
- Comandos principales:

  ```bash
  npm test -- --run
  npm run lint
  npm run build
  npm run dev
  npm run test:e2e
  ```

- Al terminar una tarea con cambios de código relevantes, ejecutar en local ESLint, build y `git diff --check`, sin repetirlos tras cada edición. Los tests y Playwright se ejecutan por defecto en el workflow nocturno, según «Pruebas y definición de terminado».
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
- SVG para consultar esquemas históricos de entrenamientos, sin Konva.
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
- Las fotografías de perfiles viven en el bucket privado `player-avatars`; `profiles.avatar_path` conserva únicamente la ruta.
- Solo el owner puede subir, cambiar o eliminar fotografías desde una acción independiente en Datos de perfil de cualquier usuario aprobado y activo. Cada persona puede ver su fotografía, pero no modificarla. Las fotografías se comprimen en cliente, no usan transformaciones de Supabase y solo se solicitan al abrir Datos de perfil o una convocatoria gráfica. Las fotos se reutilizan desde una caché privada y acotada del navegador, que se limpia al cerrar sesión o cambiar de cuenta. Los avatares habituales continúan mostrando iniciales para reducir transferencia.

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
- En Ajustes → Equipo, el listado es informativo y no contiene controles de permisos. Cada tarjeta abre Datos de perfil; el menú ofrece por separado la edición de nombre, teléfono, fecha de nacimiento, estado y roles, y la gestión de la fotografía de cualquier usuario activo; el email de Google es siempre de solo lectura.
- En el menú de Datos de perfil, «Alta deportiva» sustituye a «Baja deportiva» mientras exista una baja vigente. El alta requiere confirmación, tiene efecto desde hoy y conserva el histórico; después vuelve a mostrarse «Baja deportiva». El lápiz del historial permite editar la baja vigente y también dar el alta.
- Los cambios de estado o roles requieren confirmación. Desautorizar y restaurar se realizan dentro de la ficha, nunca desde el listado.
- El owner no puede desactivarse, quitarse su propio rol ni dejar la aplicación sin otro owner activo; estas reglas se validan también en las RPC.
- Las posiciones habituales se guardan en el perfil y se conservan entre temporadas: pilar, talonadora, segunda línea, tercera línea, medio de melé, apertura, centro, ala y zaguera. Puede haber varias posiciones y una principal incluida entre ellas; si no hay ninguna, la principal es nula. La principal determina un único grupo Delanteras/Línea; las pendientes aparecen en Sin posición. No se deriva del dorsal del partido.
- Owner y entrenadores con `team.positions` modifican posiciones mediante una RPC independiente; jugadoras y Dirección no escriben este dato. El owner abre Modificar posiciones desde Datos de perfil. En convocatorias, el staff autorizado abre ese perfil pulsando el nombre; esa vista deportiva no recibe ni muestra datos privados ni fotografías y conserva el borrador al volver. Ajustes → Temporadas → Equipos, las disponibles al preparar convocatorias y el PDF de equipos agrupan y cuentan por posición principal. Ajustes → Equipo mantiene sus grupos por estado y rol, sin agrupar por posiciones. La migración `073_player_positions.sql` se ejecuta manualmente en Supabase web.
- Las reglas comunes están en `src/lib/permissions.ts`, `src/lib/selectors.ts` y `src/app/appAccess.ts`. No duplicarlas en componentes.
- El catálogo configurable vive en `permission_definitions`; `role_permissions` guarda la matriz vigente, `role_permission_defaults` permite restaurarla y `permission_audit_log` conserva los cambios.
- Las claves se declaran también de forma tipada en `src/lib/permissions.ts`. Toda funcionalidad protegida nueva debe añadirse mediante una migración, asociarse a su ruta o acción en React y comprobarse en RLS/RPC. La pantalla de Ajustes → Permisos se genera desde el catálogo y no contiene una lista manual.
- `current_user_has_permission(text)` es la autoridad SQL. Los permisos hijos requieren su permiso padre; al retirar un padre se retiran sus descendientes. El owner mantiene siempre acceso completo y no forma parte de la matriz editable.
- El helper histórico `current_user_is_owner()` también exige `is_active`. `player_has_absence_on` es interno de SQL y no tiene EXECUTE para clientes; las RPC deportivas lo utilizan con sus propios controles. Aplicar `081_private_helpers_and_active_owners.sql` manualmente en Supabase web y volver a desplegar `sync-competition`, que también exige un owner activo.

## Temporadas y vinculaciones

- Solo puede existir una temporada que cubra una fecha determinada; las temporadas no deben solaparse.
- `season_players` registra periodos de pertenencia mediante `active_from` y `active_until`.
- Todas las estadísticas, tareas, convocatorias, asistencia y cumpleaños deben respetar el periodo real de vinculación.
- Una vinculación abierta de una temporada terminada no convierte a la jugadora en activa en una temporada posterior.
- Al aprobar y activar una jugadora se vincula a las temporadas vigentes/futuras que correspondan, inicialmente sin ficha y sin equipo. Las jugadoras existentes al aplicar `071_player_licenses.sql` se inicializan como Regional.
- La ficha es por temporada: Sin ficha, Solo entrenamientos, Regional o Nacional. Solo el owner puede asignarla o corregirla en cualquier sentido desde Ajustes → Equipo → Datos de perfil → menú → Modificar ficha; los cambios se auditan y tienen efecto al guardar.
- Al crear una temporada, las jugadoras aprobadas, activas y no archivadas comienzan con una nueva ficha Regional y vinculadas al equipo predeterminado Unizar Femenino. No se reinician fichas de temporadas ya existentes.
- Gestión de equipos muestra la cruz médica junto a cada jugadora de baja vigente hoy y su recuento junto al total de la cabecera, incluido Sin equipo. El icono y el recuento de la cabecera se ocultan cuando no hay ninguna jugadora de baja. El recuento no cambia al buscar y respeta la temporada y la vinculación en la fecha actual; no muestra bajas presentes en temporadas pasadas/futuras.
- Datos de perfil muestra Ficha y Equipo de la temporada activa debajo de Email y Fecha de nacimiento. Modificar ficha es una modal independiente, con temporada informativa y sin selector de equipo; Cancelar y Guardar vuelven al perfil. El equipo solo se asigna o cambia en Ajustes → Temporadas → Gestionar equipos. Regional/Nacional conserva el equipo al guardar; Sin ficha/Solo entrenamientos retira el equipo de periodos abiertos.
- Sin ficha y Solo entrenamientos no pertenecen a equipos, pero siguen vinculadas a la temporada y cuentan presencias y ausencias en Asistencia. Pueden consultar todos los partidos y sus convocatorias publicadas, pero no responder disponibilidad en ningún partido, incluidos amistosos. La disponibilidad requiere ficha Regional o Nacional y mantiene las restricciones del nivel de competición.
- Como excepción, owner y entrenadores autorizados con `matches.training_exceptions` incorporan jugadoras con ficha Solo entrenamientos desde Disponibilidad → Añadir de solo entrenamientos. La autorización es individual y exclusiva de esa ficha de partido, también en derbis; no cambia la ficha ni el equipo de temporada. Exige perfil activo, vinculación en la fecha, ausencia de baja y respeto de reservas. No habilita Sin ficha. Una vez autorizada puede responder y ser convocada para ese partido; los entrenadores no necesitan tramitarlo como un préstamo.
- En un partido ya disputado con convocatoria publicada, esa incorporación exige confirmar participación y un dorsal libre del acta; añade a la jugadora sin retirar las existentes e invalida la revisión de minutos conservando resultado y eventos. En partidos futuros publicados se desbloquea primero. Aplicar `087_match_training_exceptions.sql` después de `086` en Supabase web. Resultado y minutos conserva siempre el listado de convocadas y muestra los minutos pendientes mientras haya eventos inválidos.
- Las competiciones manuales tienen nivel Regional/Nacional y un indicador de liga. La ficha Regional solo permite oficiales regionales; Nacional permite ambos niveles hasta seis titularidades confirmadas en liga nacional dentro de la temporada. Desde seis no puede jugar regional aunque el owner cambie el tipo de ficha. Copas, amistosos, suplencias y convocatorias futuras no cuentan.
- Las titularidades se derivan de partidos finalizados y revisados, no de un contador almacenado. Las correcciones de resultados/convocatorias recalculan el límite. Las restricciones se comprueban en cliente y en SQL para disponibilidad, propuestas y publicación, incluidos derbis; las convocatorias futuras incompatibles requieren revisión sin borrar el histórico.
- `season_player_licenses` conserva la ficha vigente de cada temporada; `player_license_history` conserva cambios, fecha y responsable. La pertenencia a temporada y el equipo se mantienen en `season_players`, cuyo equipo puede ser nulo.
- Antes de reducir las fechas de una temporada se comprueba que tareas, partidos, entrenamientos y avisos sigan dentro de ella.
- `season_competitions` contiene las competiciones manuales de cada temporada (ligas y copas); no sustituye a las instantáneas sincronizadas de MatchReady.
- Cada temporada puede tener varias competiciones, con nombre y color únicos dentro de ella, y exactamente una predeterminada mientras exista alguna. La primera creada es la predeterminada.
- Los partidos oficiales deben pertenecer a una competición de su misma temporada. Los amistosos no pertenecen a ninguna competición.
- El owner gestiona las competiciones dentro de Ajustes → Temporadas. Eliminar una competición elimina en cascada sus partidos, disponibilidades, convocatorias e historial de cambios de disponibilidad.
- El owner configura el color de cada equipo en Ajustes → Temporadas → Gestionar equipos. Las tarjetas y las `P` del calendario usan el color del equipo asignado, también en amistosos y borradores; al reasignar un partido cambia su color. Sin equipo o sin color se conserva el color de competición para oficiales y el verde para amistosos o borradores. El nombre de la competición sigue visible y la predeterminada tiene prioridad en el orden diario.

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
- Reúne tareas, avisos, partidos y la agenda de entrenamientos, también con los ejercicios en borrador.
- Owner y entrenadores ven además la marca de cumpleaños `🎂` y, al seleccionar el día, el nombre y la edad que cumple cada jugadora activa.
- Las jugadoras también usan Calendario como su única vista de planificación: reúne tareas y avisos publicados, partidos, disponibilidad, convocatorias, agenda básica de entrenamientos y cumpleaños. No reciben planes de entrenamiento privados.
- Dirección conserva la vista independiente de Partidos porque no tiene acceso a tareas.
- Permite editar estados, convocatorias, disponibilidad y planificación.
- En la vista de gestión, las tarjetas de entrenamientos publicados enlazan con el detalle completo, incluidos entrenamientos de fechas pasadas.
- Evitar leyendas inferiores redundantes cuando las marcas ya son conocidas por los usuarios de gestión.

### Entrenamientos

- Planificación privada para owner y entrenadores.
- «Generar entrenamientos» crea los martes, jueves y viernes pendientes de la temporada activa desde hoy, de 19:30 a 21:30, con vista previa y borradores vacíos llamados «Entrenamiento martes X nov». Respeta todas las fechas de `season_holidays`, sesiones existentes/canceladas y asistencia ya guardada; no crea `training_sessions` ni altera estadísticas. Es repetible y exige owner/entrenador con `training.generate`.
- Las jugadoras vinculadas ven la E y únicamente nombre, fecha, horario, total de respuestas «Asistiré» y su respuesta propia mediante `get_training_calendar`, incluso en borrador. Los objetivos, material y ejercicios conservan su RLS privada. La ficha Sin ficha/Solo entrenamientos no impide responder a entrenamientos.
- Las tarjetas del Calendario muestran el total previsto «12 asistirán», también a las jugadoras y en borradores. Solo cuenta respuestas afirmativas de la fecha/versión vigente y jugadoras activas vinculadas; cancelados y festivos muestran cero. Después del cierre se presenta como confirmadas, conservando su significado de respuesta prevista aunque el staff corrija la asistencia real. Solo se expone el número agregado, sin nombres ni comentarios ajenos. Aplicar `089_training_attending_count.sql` después de `088` en Supabase web.
- En Calendario, owner y entrenadores con `training.view` pueden pulsar el contador para ver en una modal los nombres que respondieron «Asistiré». Una RPC protegida expone únicamente nombres de respuestas vigentes de jugadoras elegibles; jugadoras y Dirección solo ven el total. Aplicar `094_training_attendees_for_staff.sql` después de `093` en Supabase web.
- En las tarjetas de entrenamiento, móvil conserva el contador bajo el horario y ofrece los dos botones compactos en una fila. Desde 681 px, el contador aparece arriba a la derecha (icono y número, texto debajo), el botón de gestión queda centrado inmediatamente a su izquierda y la respuesta/acciones se sitúan antes. Respuesta guardada y botón empiezan alineados; comparten fila si caben y, si no, se apilan desde el mismo borde. En móvil, la respuesta guardada y «Modificar respuesta» comparten fila; los comentarios ocupan el ancho inferior. El formulario de modificación y los mensajes de cierre conservan el ancho completo.
- La primera respuesta ofrece «Asistiré» y «Rechazar», con comentario opcional. Después muestra la respuesta y «Modificar respuesta». SQL cierra al finalizar la sesión en Europe/Madrid o al registrar asistencia real; después permanece visible. Mover fecha/horario exige reconfirmar; cambiar título o ejercicios conserva las respuestas.
- El registro de asistencia parte de respuestas afirmativas solo si no existe asistencia real para esa fecha; distingue rechazos y pendientes y permite correcciones e invitadas. Una sesión real guardada sin asistentes sigue teniendo prioridad sobre las respuestas. Si falla la carga de la base, se bloquea guardar para evitar sobrescribir datos.
- Aplicar `088_training_schedule_and_responses.sql` manualmente después de `087` en Supabase web. Permite guardar borradores sin ejercicios; publicar sigue exigiendo al menos uno. La generación y las respuestas no usan Realtime. El cierre automático de los viernes utiliza el trabajo interno descrito a continuación. La agenda se consulta por mes y su caché vive únicamente en la sesión.

- Los viernes nuevos o pendientes sin registro histórico son autogestionados (`self_managed`). Al terminar (21:30 Europe/Madrid), un trabajo privado de Supabase Cron crea una única sesión real y sus asistencias: Asistiré = presencia, Rechazar/sin respuesta/respuesta invalidada por cambio de horario = ausencia. Respeta perfil activo, vinculación, festivos y cancelaciones; nunca reemplaza asistencia ya guardada. Los registros anteriores se conservan como manuales. Las jugadoras responden hasta el final. Una vez creado el registro automático, owner y entrenadores con `attendance.record` pueden corregirlo y guardar de nuevo, también añadir/retirar invitadas con `attendance.guests`. Se conserva la sesión y su origen automático; Cron no sobrescribe las correcciones ni se reabren las respuestas. Antes del registro automático solo se consultan previsiones. Aplicar `095_correct_self_managed_attendance.sql` después de `094` en Supabase web. Martes/jueves mantienen las correcciones y el guardado manual.
- Aplicar `090_self_managed_friday_attendance.sql` después de `089` en Supabase web con postgres. Instala `pg_cron` y programa `unizar-self-managed-training-attendance` cada cinco minutos de 19:00 a 23:59 UTC (cubre el cierre de Madrid en verano/invierno y recupera pendientes). Funciona sin navegador abierto, con hasta cinco minutos de demora habitual. La función y su contexto de escritura no tienen EXECUTE para clientes; solo el trabajo interno inserta registros automáticos. Consultar ejecución/errores en Supabase → Cron. Los borradores también se cierran automáticamente, sin publicar ejercicios privados.
- Las respuestas futuras son solo previsiones. El proceso nunca crea asistencia real antes de finalizar la sesión. Las consultas y selectores estadísticos excluyen además fechas futuras, incluso al recibir datos antiguos de caché o de la demo.

- Incluye sesiones y ejercicios reutilizables con imágenes pegadas en la descripción. La pizarra táctica se ha retirado; los esquemas históricos se conservan y se muestran como SVG de solo lectura, también en impresión. Editar o duplicar un ejercicio no debe borrar su `diagram_data` existente.
- Componentes principales en `src/features/trainingPlans`:

  - `TrainingPlansView` como controlador/listado;
  - `TrainingPlanEditor`;
  - `TrainingPlanDetail`;
  - `TrainingExerciseLibrary`;
  - `TrainingPresetEditor`;
  - `TrainingDiagramPreview` para esquemas históricos;
  - `trainingPlanMappers` para transformaciones puras y modo demo.
- Las imágenes pegadas en el editor con formato se preparan en cliente y se insertan como referencias internas, conservando el punto de pegado aunque el editor esté bloqueado durante la compresión. No usar `execCommand` para insertar esas referencias mientras `contentEditable` esté desactivado. Las pruebas de navegador deben cubrir pegar, guardar y volver a abrir el entrenamiento con su imagen y formato.
- El lápiz del listado y del detalle abre una ruta de edición con `training` y `trainingAction=edit`, conservando el identificador incluso al recargar. El editor distingue explícitamente crear, editar y duplicar, y se reinicia al cambiar de entrenamiento. Una edición guarda sobre el identificador original y muestra «Guardar cambios»; una duplicación muestra «Crear copia». Un fallo al cargar un entrenamiento existente no debe ofrecer una creación en su lugar. Guardar o cancelar la edición vuelve al listado y limpia la ruta de edición.
- En el editor, la única acción “Añadir ejercicio” aparece debajo del último ejercicio. Los ejercicios nuevos se incorporan al final y se reordenan con los controles existentes.
- `demo.local` monta esta sección con datos en memoria mediante la propiedad `demo`; no debe consultar Supabase.
- El detalle ofrece “Guardar PDF” mediante el diálogo de impresión nativo y una hoja de estilos de impresión, sin añadir una dependencia de generación de PDF.

### Grupos de entrenamiento

- Gestión → Grupos → Grupos de entrenamiento permite al owner y a entrenadores con `training_groups.manage` generar, ajustar y guardar un reparto Rojo/Blanco. Publicar requiere además `training_groups.publish`; jugadoras y Dirección solo consultan con `training_groups.view`.
- Solo entran jugadoras aprobadas, activas, no archivadas y vinculadas en la fecha del reparto. Regional/Nacional requiere equipo asignado; Solo entrenamientos se incluye sin equipo; Sin ficha queda excluida. Las bajas deportivas se incluyen al generar, pero el staff puede retirarlas individualmente del reparto.
- El reparto usa el equipo real de temporada y la posición principal: Delanteras, Línea o Sin posición. Cada categoría y el total difieren como máximo en una jugadora al generar; la revisión manual muestra los desequilibrios. Los nuevos repartos intentan reducir compañeras repetidas.
- Cada columna Rojo/Blanco muestra un único listado alfabético de nombres, sin secciones por posición ni etiquetas de equipo. La jugadora conserva su fila resaltada y la marca «Tú». Encima de los listados aparece un aviso personal blanco o rojo con su grupo y recordatorio de camiseta; si el último reparto publicado empieza en una fecha futura, se aclara cuándo comienza. El borrador nunca sustituye el grupo publicado en ese aviso. El equipo y la posición se conservan para el cálculo y el resumen de equilibrio del borrador.
- Se selecciona automáticamente la temporada que cubre hoy o, si ninguna está vigente, la más reciente. Dentro de ella se muestra un único reparto: el último publicado por fecha de inicio, aunque ya supere las tres semanas. No hay selectores de temporada o reparto ni datos de creación/publicación; la fecha de inicio ocupa una sola línea. El staff puede consultar un borrador guardado, que no sustituye la vista publicada para las jugadoras.
- Los grupos son independientes de la pertenencia al A, B o mixto. Un borrador nunca cambia el reparto visible para las jugadoras. Se puede revisar el publicado, guardar su borrador y publicarlo después; cada publicación renueva el aviso de todas las jugadoras.
- La renovación es manual cada 21 días desde el inicio, con aviso en la tercera semana. El último publicado sigue vigente si la renovación se retrasa; un reparto futuro no lo sustituye antes de su fecha. Los bloques anteriores conservan su histórico.
- Las jugadoras consultan su grupo en Grupos de entrenamiento y reciben un aviso en la campana cada vez que se publica un reparto. No se muestra el grupo personal en Inicio ni en las tarjetas del Calendario. La gestión y el recordatorio de renovación están dentro de Grupos de entrenamiento, accesible desde Gestión → Grupos. El Calendario no muestra la tarjeta de gestión de grupos.
- Al entrar en gestión, las jugadoras elegibles sin asignación aparecen en Jugadoras sin grupo, justo debajo del aviso de renovación, sin abrir Revisar reparto. El listado solo se muestra si hay pendientes y permite añadirlas directamente a Rojo/Blanco, iniciando un borrador que conserva las demás asignaciones; después se guarda y publica. Revisar reparto permite cambiar de grupo o quitar del reparto; las retiradas quedan disponibles para volver a añadirlas. Se puede guardar y publicar un subconjunto de la plantilla, incluido vaciar un reparto. Actualizar plantilla consulta las incorporaciones sin perder los ajustes en curso; las asignaciones que ya no cumplen los requisitos deben retirarse antes de guardar. Generar un reparto nuevo incluye automáticamente a toda la plantilla elegible, también las pendientes. Guardados y publicaciones mantienen permisos, versión, bloqueo por temporada y protección del histórico. Aplicar `086_training_group_individual_members.sql` después de `085` en Supabase web; conserva las firmas RPC y los tipos existentes.
- Aplicar `082_training_groups.sql` manualmente después de `081` y `083_notify_all_training_group_publications.sql` después de `082`. Cada publicación renueva el aviso para todas las jugadoras, también cuando se mantiene su color. Las tablas tienen RLS y no conceden acceso directo a clientes: las RPC exponen únicamente metadatos públicos y ocultan los borradores. No incluyen contactos, fotografías ni datos médicos.
- `features/trainingGroups` contiene componentes y lógica compartidos con la demo. `demo.local` añade una plantilla ampliada únicamente para este escenario y mantiene las publicaciones al cambiar de rol, sin consultar Supabase.

### Grupos de trabajo y vídeo análisis

- Las jugadoras abren Grupos como menú desplegable con Grupos de entrenamiento, Grupos de trabajo y Asignación de vídeo análisis. Gestión → Grupos abre para el owner una pantalla puente con las tres tarjetas; entrenadores con gestión de entrenamiento usan también esa pantalla.
- Los nueve grupos de trabajo conservan los colores y la distribución facilitada: Botiquín, Equipaciones, 3º tiempos, Eventos, Material, Merchan, Cámara, Fichas y Entrenadores. Solo el owner añade, retira, mueve o vincula integrantes. Los nombres sin cuenta se conservan; solo se enlazan automáticamente coincidencias exactas y únicas, sin inferir identidades por similitud.
- Cada integrante pertenece a un único grupo por temporada. Las cuentas disponibles respetan aprobación, actividad y vinculación; entrenadores activos pueden figurar sin ser jugadoras. No se incluyen contactos, fotografías ni datos médicos.
- Vídeo análisis se asigna por identificador de partido, con su fecha vigente; las jornadas pueden estar repartidas entre varios fines de semana. Cada derbi aparece una vez, usando su ficha local. Cámara, Fichas y Entrenadores forman un único grupo de análisis. El derbi inicial queda reservado a Merchan.
- El reparto inicial incluye los partidos publicados/finalizados de la temporada que cubre el 17/10/2026. Participan todos los grupos y las repeticiones favorecen a los de mayor tamaño. Repartir pendientes conserva las asignaciones guardadas. Cambiar integrantes no redistribuye partidos; cancelar conserva la asignación y eliminar el partido la borra en cascada.
- `features/workGroups` comparte las vistas y el algoritmo con `demo.local`. Los guardados usan versión y bloqueo por temporada. Aplicar `085_work_groups_and_video_analysis.sql` manualmente después de `084` en Supabase web; crea RLS, RPC y permisos `work_groups.*`/`video_analysis.*`, y carga las 43 integrantes de la imagen. Las siguientes temporadas comienzan con grupos vacíos para que el owner los organice.

### Tareas

- Las jugadoras ven y completan desde Calendario las tareas publicadas que les corresponden; la ruta histórica de Tareas redirige a Calendario.
- El staff gestiona publicación, edición, orden, avisos y resultados.
- Las tareas se asignan por semana y deben respetar temporada y vinculación.

### Partidos

- Incluye partidos oficiales y amistosos, disponibilidad y convocatorias.
- Todas las jugadoras vinculadas pueden consultar los partidos publicados/finalizados y las convocatorias publicadas de cualquier equipo de su temporada, aunque estén de baja o tengan Sin ficha/Solo entrenamientos. Los borradores siguen reservados al staff autorizado. Ver un partido no concede permiso de respuesta ni de préstamo entre equipos.
- Las jugadoras consultan y, si su ficha lo permite, responden los partidos desde Calendario; Dirección mantiene la sección independiente de Partidos.
- La primera respuesta ofrece Asistiré, En duda y No asistiré, tanto en la tarjeta como en el detalle del partido. En duda y No asistiré abren directamente su respuesta seleccionada y un comentario opcional; solo se guarda al confirmar, sin registrar antes una asistencia. En móvil las tres acciones se apilan. Las respuestas existentes permiten modificar su estado y comentario; se conservan los bloqueos por ficha, fecha y convocatoria publicada.
- La vista de lista de Partidos añade un bloque de fecha a la izquierda de cada tarjeta, con el mes abreviado y el día destacado. Conserva la información, los colores y las acciones de la tarjeta; el bloque también abre el detalle. Las tarjetas del calendario mantienen su presentación habitual.
- Las alineaciones publicadas tienen restricciones de edición y desbloqueo.
- Los listados de convocatorias, tanto borradores como publicadas y la revisión de los dos equipos del derbi, se ordenan por dorsal: muestran siempre 1–15 titulares en XV (1–7 en seven), dejando el nombre en blanco en los huecos. Suplentes solo muestra las jugadoras asignadas, con sus dorsales originales. Se conserva el resumen global de Delanteras/Línea, sin cabeceras de posición dentro de Titulares o Suplentes. Los huecos son visuales y no alteran convocadas, contadores ni guardado.
- Las convocatorias y resúmenes deben respetar la jugadora, el partido, la temporada y el periodo de vinculación.
- Un partido oficial entre dos equipos del CDU se representa mediante dos fichas vinculadas por `internal_fixture_id`, una por equipo, creadas en una sola RPC. En el calendario se muestra como un solo derbi.
- La disponibilidad de un derbi es compartida por sus dos fichas: se reutiliza la última respuesta de cada jugadora, aunque se haya guardado en la ficha local o visitante. No se duplican filas; `get_match_availability` devuelve la respuesta efectiva por ficha solicitada y mantiene los permisos de consulta. Guardado, publicación e informes usan la misma regla. Retirar disponibilidad elimina sus propuestas de ambos equipos y publicar cierra la respuesta en ambos. Las respuestas anteriores no requieren volver a registrarse; aplicar `075_shared_derby_availability.sql` en Supabase web.
- En Resumen de convocatorias y en el resumen personal, la disponibilidad cuenta una sola oportunidad y una sola respuesta por derbi, respetando ficha y vinculación. El detalle personal muestra una única ficha, dando prioridad a la convocatoria de la jugadora y después a su equipo. Los partidos borrados no cuentan y sus disponibilidades, convocatorias, cambios y eventos de minutos se eliminan en cascada. Aplicar `079_unique_fixture_availability_reports.sql` en Supabase web.
- Resumen de convocatorias y el resumen personal incluyen minutos jugados acumulados en partidos oficiales finalizados con acta de minutos revisada; un derbi cuenta una sola vez en los totales y convocatorias oficiales por jugadora. Aplicar `091_callup_report_minutes_and_derby_counts.sql` después de `090` en Supabase web. No ejecutar pgTAP en este entorno.
- Guardar Resultado y minutos del derbi usa la misma autorización que el guardado de partidos individuales: permiso `matches.edit` y acceso editable a ambas fichas; owner y entrenadores autorizados. Aplicar `092_internal_report_coach_permissions.sql` después de `091` en Supabase web.
- `save_internal_match_report` debe activar y restaurar `app.internal_fixture_write` al actualizar las dos fichas para satisfacer `guard_internal_match_structure`, además de `app.match_report_write`. Aplicar `093_internal_match_report_guard.sql` después de `092` en Supabase web.
- El owner puede activar por competición el límite de siete jugadoras de la última convocatoria oficial del otro equipo (incluidas suplentes sin minutos). El editor muestra la referencia y el contador; permite guardar borradores, pero para publicar exige confirmar primero Resultado y minutos del último partido anterior del otro equipo en esa temporada/competición y no superar siete coincidencias. Amistosos, borradores de partido y cancelados no son referencia; sin partido anterior no se aplica el límite. En derbis se compara cada equipo con el acta anterior del otro, excluyendo la pareja actual y manteniendo cero duplicadas entre ambas convocatorias. La comprobación definitiva se realiza en Supabase al publicar, también ante cambios de equipo/fecha/competición; las correcciones históricas se conservan y requieren revisar las convocatorias futuras afectadas. Aplicar `077_cross_team_callup_limit.sql` y activar la regla en Ajustes → Temporadas → Competiciones.
- Las jugadoras guardadas en la convocatoria de un equipo del derbi, titulares y suplentes, se excluyen de las disponibles del otro. Al retirarlas y guardar vuelven a estar disponibles. Los entrenadores consultan únicamente los identificadores reservados mediante una RPC protegida, sin recibir el borrador completo ajeno. Las coincidencias previas o debidas a edición simultánea siguen resolviéndose antes de publicar. Aplicar `078_derby_lineup_reservations.sql` en Supabase web.
- El resumen de disponibilidad cuenta una oportunidad por jugadora y fin de semana (viernes a domingo), y por día entre semana: partidos publicados/finalizados de su equipo en la fecha del encuentro, los elegibles del mixto o un préstamo mediante convocatoria guardada. El préstamo tiene prioridad y sustituye al partido propio; las respuestas siguen siendo específicas de cada partido y «En duda»/«No disponible» también cuentan como respuesta. Cancelados, borradores y borrados no cuentan. Una titular o suplente guardada reserva todo ese periodo: en la otra ficha del derbi se oculta; en partidos separados permanece visible como «Convocada en otro partido», indicando equipo y fecha, sin poder añadirla ni arrastrarla. Retirar y guardar libera la reserva. La RPC protegida `get_match_lineup_reservations` permite comprobar también borradores ajenos sin exponer dorsales. Supabase serializa guardados por periodo y valida guardado, publicación conjunta y cambios de calendario, sin reescribir históricos. Aplicar `080_weekend_player_opportunities.sql` después de `079` en Supabase web.
- Cada entrenador prepara el borrador de su equipo con jugadoras propias o del mixto. Solo el owner autoriza préstamos de otros equipos, resuelve propuestas duplicadas y publica o desbloquea ambas convocatorias de forma conjunta.
- El escenario del derbi en `demo.local` monta `MatchLineupDialog` e `InternalFixtureReviewDialog`, los mismos componentes usados en producción; no debe inventar un flujo distinto.
- Desde el día del partido, el staff con permiso de edición puede abrir Resultado y minutos y confirmar que ha terminado. Introduce marcador, duración, cambios y tarjetas manualmente o importa un acta PDF opcional. El PDF se procesa únicamente en el navegador: nunca se envía ni se almacena en Supabase. Solo al revisar los datos y pulsar Guardar se persisten resultado y eventos mediante una RPC atómica. En un derbi, cada ficha registra los eventos de su propio equipo.
- Los minutos oficiales se derivan de todos los tramos de juego, incluidas reentradas, expulsiones y el regreso real tras las amarillas (suspensión de 10 minutos en XV y 2 en seven). La modal muestra una vista previa y permite corregir resultados guardados sin volver a importar un PDF. Cambiar la convocatoria invalida la revisión de minutos, conservando los eventos. El resultado resumido sigue visible a quienes consultan el partido; los partidos finalizados permanecen en Calendario y en la vista previa, sin acciones de disponibilidad. `demo.local` ofrece el mismo formulario y conserva resultado y eventos en memoria. Los PDF históricos se conservan, pero ya no se habilitan nuevas subidas.

### Encuestas

- Las encuestas pueden incluir una descripción opcional, de texto plano y hasta 600 caracteres, para explicar su finalidad antes de que las jugadoras respondan.
- La descripción se muestra en Inicio y dentro de la respuesta, y solo sigue la misma visibilidad que la encuesta; no constituye un dato privado adicional.
- Los borradores se guardan de forma atómica junto con sus preguntas y opciones. Una encuesta publicada no puede cambiar su título, descripción ni preguntas.

### Competición

- Clasificación, calendario y estadísticas procedentes de la fuente de competición.
- La sincronización queda reservada al owner.

### Librería

- `src/features/library/LibraryView.tsx` muestra el árbol de carpetas y archivos sincronizados de Google Drive; `LibrarySettingsView` permite al owner guardar la carpeta raíz y lanzar la sincronización.
- `library_settings` conserva la carpeta y el estado de sincronización; `library_items` conserva únicamente metadatos y enlaces de Drive. No guardar nunca bytes de documentos en Supabase.
- `supabase/functions/sync-library/index.ts` usa la cuenta de servicio configurada en el secreto `GOOGLE_SERVICE_ACCOUNT_JSON`, recorre `files.list` de forma paginada y reemplaza el catálogo mediante `replace_library_catalog`.
- La carpeta raíz puede estar en Mi unidad. Debe compartirse como lectora con el correo de la cuenta de servicio; el permiso "cualquiera con el enlace" se mantiene si los miembros deben abrir los enlaces sin autenticarse en Drive.
- Las migraciones `037_library.sql` y `038_library_safe_delete.sql` se copian y ejecutan manualmente en el SQL Editor de Supabase (`038` corrige el `DELETE` protegido por `pg_safeupdate` si `037` ya estaba aplicada). No probarlas con Docker ni `supabase db reset` en este entorno; revisar RLS y el plan pgTAP de forma estática.
- Nunca introducir la clave JSON en el frontend, en una variable `VITE_`, en commits ni en mensajes. Las operaciones de configuración y sincronización están reservadas al owner; el catálogo solo se lee con RLS para usuarios aprobados, activos y no archivados.

### Asistencia

- Owner y entrenadores registran asistencia de campo. Los viernes autogestionados se registran automáticamente al terminar; el staff autorizado puede corregir después ese mismo registro tantas veces como sea necesario.
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

- Desde Datos de perfil, el owner puede abrir una vista previa de calendario como jugadora en una pestaña independiente. Es estrictamente de solo lectura: no permite completar tareas ni modificar disponibilidad, convocatorias, encuestas o perfil. La ruta `player-preview` valida el owner y la jugadora activa antes de cargar datos; en sus resultados solo muestra encuestas compartidas con el equipo.
- Desde Temporadas → Gestionar equipos, «Exportar PDF» abre una vista previa de todos los equipos, sus entrenadores y jugadoras vinculadas, incluidas las que están sin equipo. Incluye ficha y bajas deportivas actuales, sin datos de contacto ni notas médicas. «Guardar PDF» utiliza la impresión nativa del navegador con formato A4; no almacena el documento en Supabase y la búsqueda de jugadoras no limita la exportación.

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
- `AppLayout` compone `AppNavigation` y `MobileProfileMenu`; `navigationEntries.ts` configura las entradas usando los permisos comunes.
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
- Extraer transformaciones y cálculos de dominio a módulos puros para probarlos sin React. Inicio utiliza `features/dashboard/dashboardSelectors.ts`, que calcula únicamente el panel mostrado y conserva publicación, temporada y vinculación.
- No crear hooks únicamente para ocultar código; utilizar hooks para estado, efectos o comportamiento reutilizable.
- Evitar contextos globales para dependencias que pueden pasarse explícitamente por el router de vistas.
- Agrupar acciones relacionadas en objetos por dominio cuando una vista necesite muchas callbacks.

### Estilos

- `src/App.css` centraliza los imports de `src/styles` y conserva su orden; `src/index.css` contiene los estilos base y las variables globales.
- Conservar nombres de clase existentes al extraer componentes para evitar cambios visuales involuntarios.
- Añadir estilos en el módulo correspondiente de `src/styles`; al extraer o mover reglas, mantener el orden de importación y la cascada. No migrar toda la aplicación a CSS Modules dentro de una modificación funcional pequeña.
- Verificar siempre escritorio y móvil después de cambios en calendarios, modales, navegación o formularios.

## Fechas y zona horaria

- La zona funcional del equipo es `Europe/Madrid`.
- En cliente utilizar los helpers de `src/lib/dates.ts`; evitar conversiones UTC improvisadas.
- En SQL sensible al día actual utilizar la fecha de Madrid.
- Las semanas comienzan en lunes.
- Las pruebas que dependen del día de la semana deben fijar el reloj con `vi.setSystemTime`; no deben depender de la fecha real de ejecución.

## Rendimiento y caché

- Datos de perfil propio muestra la versión del código que ejecuta ese dispositivo, definida en `package.json`. El menú de perfil móvil también muestra esa versión al pie, sin tener que abrir «Editar mis datos» ni consultar la red. Al abrir Datos de perfil consulta `version.json` sin caché y ofrece «Actualizar a X.Y.Z» si la publicada es mayor, incluso tras posponer el aviso PWA. No guardar versiones en Supabase ni mostrar la versión del dispositivo del owner como si fuera la de otra persona. `scripts/appVersionPlugin.ts` incorpora ese número al código y genera el archivo de consulta.
- El hook local `.githooks/pre-commit` incrementa el patch de `package.json` y `package-lock.json` y los incluye en el mismo commit que los cambios preparados. `post-commit` sincroniza únicamente sus entradas de versión en el índice cuando se hace un commit con rutas concretas, conservando los demás cambios preparados. `npm ci` instala los hooks mediante `prepare`; `npm run setup:hooks` los activa en un clon ya existente. Usan Node 24, respetan los demás cambios no preparados y bloquean el commit si hay cambios de dependencias sin preparar en los package files. Un reintento conserva la versión ya preparada; un salto minor/major manual con `npm version minor/major --no-git-tag-version` se respeta. No incrementar el patch a mano ni crear commits adicionales de versión. Los commits sin cambios preparados no incrementan la versión. Los hooks locales no se ejecutan desde la web de GitHub ni al omitirlos con Git; en esos casos hay que incrementar y sincronizar manualmente la versión antes de publicar.
- Cloudflare Workers Builds publica directamente cada push a `main`, con `npm run lint && npm run build` y después `npx wrangler deploy`. No hay workflow de publicación, copia a `release` ni incremento de versión remoto. Lint, tipos y build de producción con presupuesto deben pasar antes del despliegue. `quality.yml` conserva esas comprobaciones y la revisión del diff en PR y ejecuciones manuales, sin duplicarlas automáticamente en `main`. Los tipos y el build de la demo, junto con las pruebas, se ejecutan aparte en `nightly-tests.yml` y sus fallos no bloquean publicaciones. Cloudflare debe usar `main` y tener desactivados los builds de vista previa. La antigua rama `release` queda sin uso y no debe fusionarse de vuelta a `main`. No añadir tokens de Cloudflare ni deploy hooks al frontend o al repositorio.
- Los pipelines rápidos reutilizan las descargas de npm, la caché de ESLint por contenido y los metadatos incrementales de TypeScript. `scripts/ciCacheKey.ts` calcula la huella del lockfile ignorando únicamente las versiones de la aplicación en la raíz y en `packages['']`; cualquier cambio de dependencias sigue invalidando la caché de validación. Las claves incluyen también Node y la configuración de lint/TypeScript. Restaurar los metadatos de validación después de `npm ci`, que elimina `node_modules`; no cachear `dist` ni reutilizar un build de otra versión o con otras variables de Supabase. El build de producción y su presupuesto se ejecutan siempre antes de publicar.

- La aplicación refresca la sección visible al recuperar foco o conexión si sus datos están obsoletos, sin vaciar las demás secciones preparadas.
- La navegación prioriza cambios rápidos de sección: `useTrainingData` conserva instantáneas por vista en memoria de la sesión, reutiliza datos comunes durante un minuto y prepara todas las secciones permitidas al entrar. El inicio espera a esa preparación hasta 15 segundos; después permite continuar aunque alguna petición siga pendiente. Las vistas preparadas y sus listas se muestran inmediatamente y refrescan en segundo plano al entrar, también tras una inactividad prolongada. `navigationResources.ts` comparte las listas de entrenamientos y encuestas, los grupos y la última competición; no precarga historiales, detalles, imágenes ni datos de gestión sin permiso. Los guardados invalidan las instantáneas y consultas compartidas; el cambio de cuenta o permisos invalida también respuestas pendientes. No persistir estos datos privados en localStorage ni en el service worker.
- `viewModules.ts` prepara el código de las vistas permitidas con dos trabajadores independientes tras cargar la sesión, eligiendo solo el calendario correspondiente al rol. Una petición lenta no debe detener el resto de la cola. Mantener bajo demanda el lector PDF y otras herramientas pesadas. La prueba `npx playwright test --config playwright.navigation.config.ts` usa la aplicación real con Supabase interceptado para comprobar la navegación en escritorio y móvil, incluida una inactividad de 20 minutos con respuestas lentas y la precarga restringida por permisos.
- Las vistas cargan ventanas de fechas y conservan rangos adicionales ya consultados.
- No eliminar la protección frente a respuestas fuera de orden.
- Las listas habituales tienen decenas de personas; priorizar consultas claras y payloads mínimos antes que tablas precalculadas.
- Al añadir una consulta a Inicio, evitar cargar datos privados o colecciones completas si basta con un resumen RPC.
- No invalidar toda la caché del navegador salvo que el cambio afecte realmente a esos datos.
- Las colecciones que deben estar completas usan `services/queryPagination.ts`, con páginas de 500 filas y una clave única al final del orden. No presentar datos parciales si falla una página ni sustituir la paginación por aumentar el límite de Supabase.
- Las cachés de cumpleaños e imágenes de contenido se aíslan por usuario desde `useAuth`; los cambios de sesión invalidan también las respuestas pendientes. La campana identifica sus datos por cuenta, estado, roles y permisos y utiliza la disponibilidad compartida de los derbis.
- El texto plano no carga el parser de Markdown; `FormattedContent` conserva el saneado para HTML y formato. El detalle imprimible de entrenamientos lo carga de inmediato para conservar la impresión completa. El arranque más Inicio tiene además un presupuesto de 700 kB / 200 kB gzip.
- Inicio y Datos de perfil se cargan bajo demanda. El build comprueba el presupuesto de JavaScript estático del arranque con `scripts/check-startup-size.mjs` (600 kB sin comprimir / 180 kB gzip); no subirlo para ocultar una regresión de carga. `npm run check:bundle` muestra además el tamaño incluyendo Inicio. Las consultas independientes de Inicio se ejecutan en paralelo y el panel del staff no necesita asistencia personal.

## Notificaciones

- La campana combina avisos funcionales y recordatorios del perfil.
- No volver a consultar tareas o resultados para la campana mientras no generen ninguna notificación. Los avisos solo relacionan `seasons`, sin una relación directa con `season_competitions`.
- Los cumpleaños no generan elementos persistentes en la campana; se muestran como una línea en Inicio y, para el owner, en el calendario de Resumen.
- Los mensajes de éxito compartidos utilizan `useOperationFeedback`.
- Si llega un mensaje nuevo antes de ocultar el anterior, debe reiniciarse el temporizador para que el nuevo mensaje permanezca visible el tiempo completo.

## Pruebas y definición de terminado

- Mantener o ampliar pruebas para cualquier regla de negocio modificada.
- Las pruebas se encuentran junto a componentes, hooks y servicios.
- Utilizar fixtures de `src/test/fixtures.ts` cuando sea posible.
- Para funciones SQL, comprobar existencia, permisos y restricciones en pgTAP.
- Por defecto, ejecutar los tests unitarios, de integración y E2E/Playwright únicamente en `.github/workflows/nightly-tests.yml`, no durante las modificaciones locales, desde hooks de commit ni en los pipelines de PR/publicación. Esto incluye `npm test -- --run`, `npm run test:e2e` y cualquier ejecución directa de Vitest o Playwright. Seguir creando y actualizando las pruebas necesarias aunque su ejecución se delegue en el workflow nocturno.
- El workflow nocturno se programa diariamente a las 00:00 en `Europe/Madrid`, con ajuste automático de verano/invierno, y admite ejecución manual. GitHub puede retrasar su inicio. La programación se activa cuando el archivo está en la rama predeterminada y prueba su último commit; no necesita un servidor propio, Supabase ni un navegador abierto.
- Las suites unitarias, Playwright de la demo y Playwright de navegación real interceptada se ejecutan de forma independiente, sin cancelar las demás por un fallo. Cada suite conserva durante 14 días informes descargables, logs y el SHA revisado; Playwright añade un informe HTML y las trazas de los fallos. Se descargan desde GitHub → Actions → Pruebas nocturnas → ejecución → Artifacts, o desde el enlace del resumen. No se descargan automáticamente al ordenador local.
- Los fallos nocturnos no bloquean nuevas publicaciones ni crean correcciones automáticas. Al abordar una incidencia detectada por estas pruebas, descargar y revisar el informe de la ejecución fallida, identificar su commit y preparar la corrección en una versión posterior. No considerar que todas las versiones intermedias han pasado las pruebas: cada noche se comprueba una instantánea.
- Ante una refactorización amplia o un cambio que modifique muchos archivos existentes, preguntar una sola vez si se quieren ejecutar pruebas en local para detectar regresiones o incompatibilidades antes del push. Explicar brevemente qué áreas afecta y proponer las pruebas relacionadas. La mera creación de muchos archivos nuevos no activa esta consulta.
- Ejecutar pruebas locales solo si el usuario las solicita expresamente o acepta esa propuesta; respetar el alcance autorizado. Si no hay respuesta o se rechaza, continuar sin ejecutarlas y dejar su validación a la ejecución nocturna.
- Para terminar la implementación local de una tarea con cambios de código relevantes deben pasar estas comprobaciones, una vez al final de la tarea:

  ```bash
  npm run lint
  npm run build
  git diff --check
  ```

- En cambios exclusivamente de documentación, revisar el contenido y ejecutar `git diff --check`; no es necesario ejecutar lint ni build.
- Para publicar deben pasar lint y build en Cloudflare, sin esperar a los tests nocturnos. Un commit local no activa el despliegue: Cloudflare publica al subir a `main`, `quality.yml` se ejecuta en PR o manualmente y `nightly-tests.yml` según su horario o manualmente. Al entregar, indicar qué se ha comprobado en local y qué queda delegado en la ejecución nocturna, sin dar las pruebas por pasadas si todavía no se han ejecutado.
- Para cambios visuales relevantes añadir o actualizar pruebas de Testing Library y, cuando proceda, Playwright móvil.
- Mantener `demo.local` sincronizada con las funcionalidades que deban poder probarse sin Supabase. Cuando se modifique una funcionalidad representada en la demo, comprobar también en local, al terminar la tarea:

  ```bash
  npx tsc -p demo.local/tsconfig.json
  npx vite build --config demo.local/vite.config.ts
  ```

- Las fuentes necesarias de `demo.local` están versionadas para que Playwright pueda ejecutarse en un checkout limpio; sus builds, copias de respaldo y archivos locales adicionales siguen ignorados. Las pruebas Playwright de la demo y de `playwright.navigation.config.ts` se ejecutan en el workflow nocturno; las ejecuciones locales siguen la política anterior.
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
