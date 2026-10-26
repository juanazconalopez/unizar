# Demo local con datos mock

Las fuentes de esta carpeta están versionadas para las pruebas Playwright del
workflow nocturno. Sus builds, copias de respaldo y archivos locales adicionales
siguen ignorados por Git. No usa Supabase ni modifica datos reales: todas las
operaciones se guardan en memoria y se pierden al recargar la página.

## Ejecutar

Activa primero Node 24 con NVM y después inicia la demo:

```bash
source /home/jazcona/.nvm/nvm.sh
nvm use
npm run dev -- --config demo.local/vite.config.ts
```

La terminal mostrará la URL local. Para verificar la compilación independiente:

```bash
source /home/jazcona/.nvm/nvm.sh
nvm use
npx tsc -p demo.local/tsconfig.json
npx vite build --config demo.local/vite.config.ts
```

## Escenarios incluidos

- Cambio de rol entre owner, entrenador, Dirección y jugadora.
- Panel personal de jugadora y panel de equipo con participación y progreso semanal.
- Tareas publicadas, borradores y anuladas; creación y cambio de estado.
- Tarea de tipo Vídeo con un partido completo enlazado desde las indicaciones.
- Registro y edición de resultados personales.
- Resumen mensual de rendimiento del equipo.
- Registro de asistencia de jugadoras activas.
- Temporadas pasada, activa y próxima; altas y bajas de participantes.
- Equipo con owners, entrenadores, Dirección, jugadoras activas/inactivas, una solicitud
  pendiente, una posible cuenta duplicada y un perfil archivado.
- Búsqueda por nombre, sin distinguir mayúsculas ni acentos, en la administración del equipo.
- Listado compacto del equipo sin controles accidentales y ficha completa al pulsar cada persona.
- Edición simulada por el owner de datos, estado y roles desde el lápiz de la ficha; el email permanece bloqueado.
- Fotografía privada simulada, solicitada únicamente al abrir Datos de perfil; los avatares del resto de la aplicación conservan las iniciales.
- La jugadora puede abrir “Editar mis datos” desde su menú de usuario para probar teléfono, nacimiento y selección de fotografía sin persistencia real.
- Asistencia incluye cinco invitadas simuladas: se pueden añadir o reutilizar por nombre y vincular después desde la ficha de una cuenta en Ajustes → Equipo.

## Grupos Rojo/Blanco

Desde Gestión → Grupos de entrenamiento se puede generar un reparto equilibrado, mover jugadoras, guardar un borrador privado y publicar. Las jugadoras consultan su grupo en esa sección y reciben un aviso en la campana al publicarse cada reparto. El ejemplo comienza con un reparto de hace más de tres semanas para ver el aviso de renovación.

La plantilla ampliada de A, B, mixto y Solo entrenamientos solo se utiliza en este escenario, sin alterar los partidos ni la asistencia de la demo. Los grupos se conservan al cambiar Ver como y se reinician al recargar. Se usan los componentes reales y un adaptador en memoria, sin peticiones a Supabase.
