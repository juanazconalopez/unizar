# Notificaciones push

Cloudflare sigue sirviendo archivos estáticos. El navegador recibe Web Push estándar;
Supabase mantiene dispositivos, preferencias y una cola transaccional. No utiliza
Realtime, Firebase ni OneSignal. La campana actual continúa funcionando.

## Avisos y destinatarios

| Tipo | Momento | Destinatarios |
| --- | --- | --- |
| Partidos | Publicación y cambios de fecha, hora, lugar, convocatoria, rival, equipo o cancelación | Personas con consulta de ese partido; jugadoras vinculadas en su fecha |
| Convocatorias | Publicación, nueva publicación y cambios en una convocatoria publicada | Personas con consulta del partido y permiso para ver convocatorias |
| Avisos | Al pasar a publicado; una edición menor no repite el envío | Personas que pueden consultar el aviso |
| Grupos Rojo/Blanco | Cada publicación, aunque se mantenga el color | Integrantes elegibles del reparto publicado |
| Disponibilidad pendiente | Lunes y miércoles, desde las 09:00 de Madrid, para partidos de esa semana | Jugadoras elegibles que siguen sin respuesta y sin convocatoria cerrada |
| Disponibilidad para staff | Agrupa cambios de respuesta durante 15 minutos | Owner y entrenadores autorizados en ese equipo; no Dirección |
| Entrenamientos | Cambios de fecha/horario y cancelación o recuperación, también en borrador | Staff autorizado y jugadoras vinculadas en la fecha nueva o anterior |
| Respuesta de entrenamiento | Una vez, por la mañana del entrenamiento, para sesiones posteriores a las 12:00 | Jugadoras con respuesta pendiente o invalidada por cambio de horario |

Los recordatorios se generan entre las 09:00 y las 12:00 en `Europe/Madrid` y caducan
a las 20:00, o dejan de ser elegibles al responder/cerrarse la sesión. No se
recuperan recordatorios de días anteriores. No se envían cumpleaños, tareas,
recordatorios de perfil ni el aviso derivado de «Próximo partido».

La disponibilidad respeta ficha, excepciones de Solo entrenamientos, bajas,
reservas y la respuesta compartida de derbis. Se reutilizan los selectores SQL
existentes. El permiso `notifications.push` permite activar el canal; cada aviso
exige además sus permisos deportivos, perfil activo y vinculación correspondiente.

Los mensajes de pantalla bloqueada tienen título genérico y nunca llevan nombres,
contactos, comentarios, fotografías, ejercicios ni información médica. La pulsación
abre la fecha/sección y exige la sesión y los permisos normales de la aplicación.
Si se necesita entrar con Google, el destino se conserva durante 30 minutos en
sessionStorage, sin guardar tokens ni fragmentos OAuth.

## Preparación y despliegue

1. Ejecutar completas `097_web_push_devices.sql` y
   `098_web_push_events_and_dispatch.sql`, en ese orden, en Supabase → SQL Editor
   con postgres, después de 096. La segunda usa `pg_cron` (instalado en 090),
   `pg_net` y Supabase Vault. No se ejecuta PostgreSQL local.
2. Con Node 24 (`source /home/jazcona/.nvm/nvm.sh` y `nvm use`), ejecutar:

   ```bash
   node scripts/generate-web-push-keys.mjs
   ```

   Crea `web-push-secrets.local` con permisos 600, ignorado por Git, sin imprimir
   claves. No sobrescribe un fichero existente. Conservar las claves para todas
   las publicaciones: cambiarlas obliga a renovar suscripciones. No subir el
   fichero ni pegar su contenido en chats, logs o documentación.
3. Completar `WEB_PUSH_SUBJECT` en ese fichero con un `mailto:` de contacto real o
   una URL pública. Configurar los secretos del servidor:

   ```bash
   npx supabase secrets set --env-file web-push-secrets.local --project-ref TU_PROJECT_REF
   npx supabase functions deploy send-push --project-ref TU_PROJECT_REF --no-verify-jwt --use-api
   ```

   `--use-api` realiza el despliegue sin Docker. La función **no** usa el JWT público: valida `x-push-secret` contra
   `PUSH_DISPATCH_SECRET` antes de consultar la cola. No acepta destinatarios,
   mensajes ni endpoints aportados por la llamada. Su dependencia `web-push`
   está fijada a 3.6.7 y solo se ejecuta en el servidor, sin aumentar el bundle React.
4. En Supabase Vault crear estos dos secretos desde SQL Editor, sustituyendo
   los marcadores. No utilizar la clave `service_role` como secreto de Cron:

   ```sql
   select vault.create_secret(
     'https://TU_PROJECT_REF.supabase.co/functions/v1/send-push', 'push_function_url'
   );
   select vault.create_secret('VALOR_DE_PUSH_DISPATCH_SECRET', 'push_dispatch_secret');
   ```

   El segundo valor debe coincidir con el del fichero y el de Edge Functions.
   Si ya existen, actualizarlos en Vault; no crear nombres duplicados. Antes de
   configurar ambos, el trabajo no realiza ninguna petición HTTP.
5. En Cloudflare → unizar → Settings → Build, añadir
   `VITE_WEB_PUSH_PUBLIC_KEY` con **solo** el valor de `WEB_PUSH_PUBLIC_KEY`.
   Para desarrollo también puede ir en `.env.local`. Publicar el frontend con
   lint y build. Nunca definir la privada, el secreto de Cron ni `service_role`
   en variables `VITE_`. No hay cambios en el servidor de Cloudflare.
6. Actualizar la PWA en los dispositivos. En la campana → «Notificaciones en este
   dispositivo», activarlas con una pulsación, aceptar el permiso y solicitar
   la prueba. En iPhone/iPad instalar primero en pantalla de inicio y abrir
   desde el icono (iOS/iPadOS 16.4 o posterior). La instalación no sustituye el
   permiso de notificaciones.

## Envío, cuotas y mantenimiento

- Cron revisa cada cinco minutos, pero solo invoca la Edge Function si hay trabajo.
  Cada invocación reclama hasta 30 entregas, con seis conexiones simultáneas.
  Cada pasada inicia como máximo ocho lotes (240 entregas). Un envío habitual
  empieza en los siguientes cinco minutos; colas mayores, reintentos o demoras
  del proveedor pueden tardar más. El resumen del staff añade sus 15 minutos.
- La cola usa bloqueo `skip locked` y una concesión de tres minutos. Reintenta
  fallos temporales hasta cinco intentos, con espera creciente. Un 404/410 elimina
  la suscripción; errores permanentes finalizan esa entrega. La misma etiqueta
  de notificación reemplaza un reintento si el proveedor aceptó el envío antes
  de perderse su confirmación. No se garantiza entrega exactamente una vez.
- Se reevalúan permisos, preferencias, actividad, fechas y respuestas al reclamar
  cada entrega. Dispositivos activados después de un evento no reciben su historial.
  Las publicaciones se registran dentro de la misma transacción que sus cambios.
- Cada dispositivo admite preferencias independientes. Desactivar o cerrar sesión
  elimina su suscripción y el vínculo local. El service worker comprueba la cuenta
  receptora antes de mostrar y abrir el aviso. No almacena el contenido deportivo
  en sus cachés; solo conserva el identificador de cuenta para ese control.
- La limpieza automática elimina eventos caducados hace más de 30 días y sus
  entregas. No almacena un log por petición ni registra endpoints o secretos.
- Revisar Supabase → Cron → `unizar-web-push`, las respuestas de `pg_net` y los
  contadores de Edge Functions. El resultado de cada lote incluye únicamente
  `processed`, `sent` y `failed`. Consultar Supabase Usage tras el piloto.
- Para pausar los envíos, desactivar `unizar-web-push` en Supabase → Cron. La
  aplicación y la campana siguen funcionando. Los pendientes caducan; no borrar
  las claves VAPID para una pausa temporal.

## Validación

En local se comprueban lint, build, tipos/build de la demo y `git diff --check`.
Las pruebas de servicios, preferencias, payload, aislamiento de cuenta y service
worker se ejecutan en el workflow nocturno. Playwright incluye la configuración
de avisos en escritorio y móvil usando la demo, sin enviar push reales.
`schema_test.sql` incluye RLS, permisos, destinos y restricciones de la cola;
esas pruebas SQL se validan en Supabase web según el flujo del proyecto.

Antes de extender al equipo, validar un envío real con Android e iPhone: PWA cerrada,
pulsación con sesión caducada, cambio de cuenta, cierre de sesión, retirada de
permiso, recordatorio ya respondido y publicación sin duplicados. Los proveedores,
el dispositivo y sus modos de concentración pueden retrasar o silenciar avisos.

Referencias: [programar funciones con Cron y Vault](https://supabase.com/docs/guides/functions/schedule-functions),
[desplegar funciones sin Docker](https://supabase.com/docs/guides/functions/quickstart),
[Web Push en Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers),
[biblioteca web-push](https://github.com/web-push-libs/web-push),
[extender Workbox con un listener push](https://developer.chrome.com/docs/workbox/modules/workbox-build#type-GenerateSWOptions).
