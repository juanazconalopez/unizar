# CDU Rugby Zaragoza · Entrenamientos

Aplicación responsive para planificar y registrar los entrenamientos de un equipo.

## Funciones actuales

- Acceso con Google mediante Supabase Auth.
- Aprobación de cuentas y permisos independientes de jugador, colaborador y owner.
- Temporadas y participantes con fechas de incorporación y salida.
- Tareas semanales en borrador, publicadas o anuladas.
- Resultados con texto, fecha de realización y fatiga de 1 a 5.
- Panel semanal del jugador.
- Registro de asistencia a entrenamientos de campo por fecha.
- Grupos de entrenamiento Rojo/Blanco con reparto equilibrado, revisión y publicación manual cada tres semanas.
- Estadística personal de asistencia con mensajes motivadores.
- Gestión de usuarios, permisos y temporadas para owners.
- Histórico de competición sincronizado desde la publicación pública de MatchReady.
- Desautorización reversible de cuentas sin perder su histórico.

La autorización real se aplica mediante las políticas RLS de `supabase/migrations`.

## Base de datos

Las migraciones se aplican en orden desde el editor SQL de Supabase. Las migraciones
`003` a `013` añaden asistencia, archivo reversible de usuarios, lectura de resultados
para gestores, tipos de tarea canónicos, periodos históricos de participación y
normalización de nombres, partidos, disponibilidad y alineaciones, consultas indexadas,
histórico de competición y las restricciones de integridad transaccional, además de la
actualización automática de `updated_at`.
Deben aplicarse todas antes de publicar.

### Protección de bajas y cuentas inactivas

Después de `080_weekend_player_opportunities.sql`, copiar y ejecutar
`081_private_helpers_and_active_owners.sql` en el editor SQL de Supabase.
Esta migración impide llamar directamente por API al helper de bajas de otras
jugadoras y exige que el owner esté activo en los controles administrativos
históricos. Las RPC deportivas conservan sus comprobaciones internas de bajas.
Las firmas de las funciones no cambian. Las pruebas pgTAP se validan en Supabase;
no requieren ni se ejecutan con PostgreSQL local en este entorno.

Volver a desplegar también `sync-competition` con el comando de la siguiente
sección para que su autorización rechace a los owners inactivos.

### Grupos de entrenamiento Rojo/Blanco

Después de `081`, copiar y ejecutar completas `supabase/migrations/082_training_groups.sql` y `supabase/migrations/083_notify_all_training_group_publications.sql`
en el editor SQL de Supabase y publicar el frontend. No requiere otra Edge Function.
Los tipos y las pruebas pgTAP incluyen sus tablas, permisos y RPC; las comprobaciones
SQL se validan en Supabase web, sin una base de datos local.

Owner y entrenadores acceden desde **Gestión → Grupos de entrenamiento**. Pueden
generar un reparto, mover jugadoras, guardar el borrador y confirmar su publicación.
Los borradores son privados. Incluye Regional/Nacional con equipo y Solo entrenamientos
sin equipo; excluye Sin ficha. Mantiene a las jugadoras de baja deportiva. El reparto
equilibra cada equipo por posición principal y mantiene diferencias máximas de una
jugadora por categoría y en el total. Los ajustes manuales muestran advertencias.

La vista selecciona automáticamente el último reparto publicado de la temporada activa
(o la temporada más reciente si ninguna está vigente), aunque el reparto supere las tres
semanas. Muestra una sola fecha de inicio y no presenta selectores de temporada/reparto
ni las fechas de auditoría. Las jugadoras consultan su grupo en Grupos de entrenamiento
y reciben un aviso en la campana cada vez que se publica un reparto, con el recordatorio de camiseta/peto. El
aviso aparece al actualizar la campana; no envía push cuando la aplicación está cerrada.
A los 21 días aparece el aviso de renovación; el reparto anterior se mantiene hasta la
fecha efectiva del siguiente. No hay publicación automática.

La demo local usa los mismos componentes y un adaptador en memoria con una plantilla
ampliada de A, B, mixto y Solo entrenamientos. Para abrirla:

```bash
source /home/jazcona/.nvm/nvm.sh
nvm use
npm run dev -- --config demo.local/vite.config.ts --host 127.0.0.1 --port 4174
```

En `http://127.0.0.1:4174`, abrir **Gestionar grupos** y después cambiar **Ver como**
a Jugadora para comprobar el grupo y su aviso. Los cambios se conservan entre roles
y se reinician al recargar. La carpeta `demo.local` sigue siendo local e ignorada por Git.

### Sincronización de competición

Después de aplicar `012_competition_history.sql` y
`013_reliability_hardening.sql`, despliega la función de servidor:

```bash
npx supabase functions deploy sync-competition --project-ref TU_PROJECT_REF
```

No necesita secretos adicionales: Supabase proporciona a la función `SUPABASE_URL`,
`SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. Solo el owner autenticado puede
ejecutarla. Al abrir Competición, el owner lanza una sincronización en segundo plano
si la copia tiene más de doce horas; también dispone del botón **Sincronizar**.

La función descubre el calendario actual desde la página estable de la Federación,
procesa calendario, clasificación y estadísticas públicas de MatchReady, y guarda
una instantánea separada por temporada. Una nueva edición aparece automáticamente
en el selector y las anteriores permanecen en Supabase aunque desaparezca su fuente.

### Librería de Google Drive

La Librería guarda únicamente metadatos de una carpeta raíz de Drive. Los documentos
no se transfieren a Supabase: los enlaces de visualización y descarga siguen apuntando
a Google Drive. La carpeta debe compartirse como mínimo con la cuenta de servicio de
Google como lectora; el acceso "cualquiera con el enlace" se puede mantener para que
los miembros abran los documentos.

En el proyecto de Google Cloud de la cuenta de servicio debe estar habilitada la **Google
Drive API**. No hace falta habilitar APIs de subida ni guardar archivos en Supabase.

Después de aplicar `037_library.sql` desde el SQL Editor (y `038_library_safe_delete.sql`
si la primera migración ya se ejecutó antes de esta corrección), despliega la función:

```bash
npx supabase functions deploy sync-library --project-ref TU_PROJECT_REF
```

En **Edge Functions → Secrets** configura `GOOGLE_SERVICE_ACCOUNT_JSON` con el
contenido de la clave JSON de la cuenta de servicio. Nunca lo guardes en el frontend,
en `.env` con prefijo `VITE_` ni en Git. Solo el owner puede cambiar la carpeta y
sincronizar; el catálogo es de lectura para usuarios aprobados y activos.

## Desarrollo local

Requiere Node **24.21.0 LTS**, fijado en `.nvmrc` y `.node-version`.
La instalación comprueba la versión mediante `engines` y `.npmrc`.

```bash
nvm install
nvm use
npm ci
npm run dev
```

Crea `.env.local` con las variables públicas del proyecto:

```dotenv
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Los secretos de Google no deben guardarse en el proyecto ni usar el prefijo `VITE_`. Las credenciales OAuth del login se configuran en **Authentication → Sign In / Providers → Google**; la clave JSON de la cuenta de servicio de Drive se configura únicamente en **Edge Functions → Secrets** como `GOOGLE_SERVICE_ACCOUNT_JSON`.

## Organización del código

```text
src/
├── components/     # Layout y piezas visuales reutilizables
├── constants/      # Opciones y valores compartidos
├── features/       # Pantallas agrupadas por funcionalidad
├── hooks/          # Estado de autenticación y carga de datos
├── lib/            # Cliente Supabase y utilidades puras
├── services/       # Escrituras y operaciones contra Supabase
├── App.tsx         # Coordinación de vistas y operaciones
└── types.ts        # Tipos compartidos del dominio
```

## Comprobaciones

```bash
nvm use
npm test
npm run lint
npm run build
```

Los tests usan Vitest y Testing Library. Las pruebas de cada componente o feature
se guardan junto al archivo probado (`*.test.tsx`); `src/test` contiene únicamente
la configuración y las fixtures compartidas. Para trabajar en modo interactivo:

```bash
nvm use
npm run test:watch
```

Los tipos del esquema usados por el cliente de Supabase se guardan en
`src/lib/database.types.ts`. Regéneralos después de aplicar una migración:

```bash
nvm use
SUPABASE_PROJECT_ID=tu-project-ref SUPABASE_ACCESS_TOKEN=tu-token npm run types:supabase
```

Sin `SUPABASE_PROJECT_ID`, el mismo comando consulta la instancia local iniciada
con Supabase CLI. La compilación estricta detectará después cualquier consulta o
escritura que ya no coincida con el esquema.

Las comprobaciones SQL de esquema y RLS están en `supabase/tests/schema_test.sql`
y se ejecutan con Supabase CLI mediante `supabase test db`.

En Supabase, añade tanto la dirección local como la dirección desplegada a **Authentication → URL Configuration → Redirect URLs**.

## Publicación en Cloudflare Workers

El despliegue actual utiliza Workers Builds, conectado al repositorio de GitHub.
La configuración se encuentra en **Workers & Pages → unizar → Settings → Build**:

- Rama de producción para el versionado automático: `release`
- Builds para ramas que no son de producción: desactivados
- Comando de compilación: `npm run build`
- Comando de despliegue: `npx wrangler deploy`
- Recursos generados por Vite: `dist`
- La configuración versionada de Wrangler está en `wrangler.jsonc`; declara los
  recursos estáticos y el fallback de rutas de la SPA para que el despliegue no
  dependa del asistente interactivo de detección de Vite.
- Versión de Node: **24.21.0**, indicada en `.node-version` y `.nvmrc`.
  Si existe `NODE_VERSION` en **Build Variables and Secrets**, debe tener ese mismo
  valor en todos los builds. Véase la [configuración oficial del build de Workers](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/#overriding-default-versions).

Configura estas variables en **Build Variables and Secrets** para producción y,
si se habilitan, también para las vistas previas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Vite incorpora estas variables durante la compilación. Añadirlas solo a las
variables de ejecución del Worker no configura el frontend.

Para comprobar la versión efectiva, abre **Deployments → Build** en la fila del
despliegue y busca `nodejs@24.21.0` e `Installing nodejs 24.21.0`. Un registro
anterior conserva la versión con la que se compiló; cambiar archivos o variables
solo tiene efecto en una compilación nueva.

Añade la dirección `https://<worker>.<cuenta>.workers.dev` y las direcciones de
vista previa utilizadas a las URLs de redirección permitidas de Supabase. La URI
autorizada de Google continúa siendo el callback de Supabase, no la URL de Cloudflare.

### Versionado y publicación automática

`npm ci` instala el hook `.githooks/pre-commit`. En un clon existente se puede
activar también con `npm run setup:hooks`. Se conserva cualquier configuración
de hooks ajena al proyecto: si existe, hay que integrar ambos antes de activarlo.

Al hacer un commit local con cambios preparados, el hook incrementa el patch
(1.0.11 → 1.0.12), actualiza `package.json` y los dos campos de versión raíz de
`package-lock.json`, y añade únicamente esos archivos al mismo commit. No hace
falta ejecutar `npm version patch` ni crear un commit adicional. Funciona con Git
y con los editores que ejecutan sus hooks; utiliza Node 24 y carga nvm si hace falta.
No instala dependencias ni ejecuta las pruebas durante el commit.

Si un commit falla después de preparar la versión, reintentarlo conserva ese
número. Los commits sin cambios preparados no incrementan la versión. Si los
package files contienen cambios de dependencias sin preparar, el hook detiene
el commit para que no se incluyan por accidente: prepara esos cambios primero.
Los demás cambios locales que no se hayan preparado se conservan fuera del commit.
Para un salto minor o major, ejecuta `npm version minor --no-git-tag-version` o
`npm version major --no-git-tag-version` y prepara ambos archivos; el hook
respeta el número superior que hayas elegido.

Cada push a `main` activa `.github/workflows/release.yml` directamente, sin una
espera fija. Ejecuta pruebas, lint, build y revisión del diff y envía a `release`
exactamente la versión incluida en el commit. `quality.yml` comprueba los PR y
las ejecuciones manuales; no repite automáticamente las validaciones de `main`.
Continúa siendo necesario el tiempo de las comprobaciones y del despliegue de
Cloudflare. La automatización no incrementa la versión de nuevo ni escribe en `main`.

`scripts/automaticRelease.ts` conserva el historial de `release` sin forzar pushes
y registra `Unizar-Source-Commit`. Comprueba que el SHA siga siendo el último de
`main` antes de validar y justo antes de publicar. Repetir un SHA o publicar el
mismo contenido no crea otra publicación. Si falla una comprobación, no se envía
a `release`; reintentar un build de Cloudflare conserva el mismo número.

Los hooks locales no se ejecutan al editar desde la web de GitHub o al omitirlos
con Git. CI comprueba que los package files coincidan y que la versión sea
superior a la anterior antes de publicar código distinto.

Cloudflare debe tener **Production branch: release** y **Builds for non-production
branches** desactivado. Se conservan `npm run build`, `npx wrangler deploy` y las
variables reales de Supabase. GitHub utiliza su token temporal con `contents: write`
solo en el job de publicación; no necesita un token de Cloudflare. Las reglas de
protección de `release` deben permitir el push de la automatización. Los builds
de comprobación en GitHub usan valores ficticios de Supabase; el build real se
realiza en Cloudflare. No guardar tokens o deploy hooks en el repositorio.

## Aplicación instalable (PWA)

La compilación genera el manifest, el service worker y los iconos necesarios para
instalar la aplicación desde Android, iOS y navegadores de escritorio. No se deben
añadir reglas de caché globales en Cloudflare: el HTML y el service worker
necesitan revalidarse para detectar cada despliegue, mientras que los recursos de
Vite ya incluyen hashes y se almacenan de forma segura.

Cuando hay una versión nueva, la aplicación muestra el aviso **Nueva versión
disponible**. La actualización solo se aplica al pulsar el botón para evitar perder
un formulario que se esté rellenando y conserva la sesión de Supabase.

**Datos de perfil** muestra la versión que está ejecutándose en ese dispositivo.
Al abrir el perfil se consulta la última publicación y, si tiene una versión mayor,
aparece **Actualizar a X.Y.Z**, también después de posponer el aviso automático.
El número se incorpora al código durante la compilación y el build genera
`version.json` para consultar la última versión, fuera de la caché de la PWA.
No se registra en Supabase: cada dispositivo muestra su propia versión.

El workflow de publicación incrementa automáticamente el patch en ambas ramas.
Para establecer un salto de versión en `main` antes de la próxima publicación, usar
`npm version minor --no-git-tag-version` o `major` y mantener sincronizados
`package.json` y `package-lock.json`. El build utiliza un único número para la
interfaz y `version.json`; no incrementar la versión durante el build de Cloudflare.

La caché es opcional, tanto en Safari como en la aplicación instalada. Si el
navegador bloquea el almacenamiento o no queda espacio, las imágenes se descargan
desde Supabase y las recién pegadas se conservan en memoria para poder guardarlas.
En ese caso se avisa de que hay que guardar antes de cerrar o recargar. Los avisos
siguen funcionando y los borradores indican si no se pueden conservar en el
dispositivo. La pantalla inicial desaparece a los dos segundos, aunque su fotografía
no termine de cargar.

Si una sección necesita un archivo de una versión anterior, **Actualizar y
reintentar** activa la actualización pendiente o retira únicamente el service worker
antiguo de esta aplicación antes de recargar. Conserva la sesión y los borradores;
no borra globalmente los datos del navegador. Las cachés de recursos y fuentes
se pueden liberar automáticamente ante un error de cuota.

Los datos no se guardan en la caché del service worker. Se consultan al iniciar la
aplicación y se refrescan silenciosamente al volver a primer plano o recuperar la
conexión, siempre que haya pasado al menos un minuto desde la última carga.

Tras entrar se prepara el código de las secciones permitidas en lotes de dos,
priorizando Calendario, Partidos, Asistencia y Grupos. También se preparan sus
datos principales según permisos. Los datos comunes se reutilizan durante un
minuto y las secciones visitadas conservan una instantánea en memoria: al volver
se muestran de inmediato y se refrescan en segundo plano si están obsoletas.
Guardar cambios invalida las instantáneas; cambiar de cuenta o permisos invalida
también las respuestas pendientes. Nada de esto persiste datos privados fuera
de la sesión. El lector PDF sigue cargándose únicamente al importar un acta.

La precaché del service worker contiene solo la
estructura inicial, estilos e iconos de instalación; los fragmentos versionados,
los escudos y las fuentes se guardan después de descargarse. Las consultas de
Supabase se separan por sección y comparten perfil, permisos y catálogos para
evitar repetirlos durante la preparación y navegación.

Inicio y Datos de perfil también se cargan bajo demanda: la pantalla de acceso no
descarga el renderizador de contenido con formato ni el campo internacional de
teléfono. Tras recuperar la sesión se precarga la sección solicitada en paralelo
con sus consultas. Inicio consulta cumpleaños, tareas, agenda y asistencia personal
en paralelo; evita repetir la consulta de avisos, no carga catálogos de equipos que
no utiliza y no descarga asistencia personal para el panel de equipo del staff.
El resumen personal conserva las sesiones realizadas y las restricciones de
temporada y vinculación.

El build comprueba el grafo de JavaScript estático del arranque y el de Inicio;
`npm run check:bundle` repite la medición sin recompilar. El arranque tiene un presupuesto
de 600 kB sin comprimir y 180 kB gzip. La medición excluye CSS, imágenes, datos de
Supabase y la compresión del servidor; no es una medición de tiempo en un iPhone.

Los nuevos esquemas de ejercicios se adjuntan pegando imágenes en su descripción.
La pizarra táctica y las dependencias Konva se han retirado. Los esquemas antiguos
siguen visibles mediante SVG, incluidos los PDF por impresión, y se conservan al
editar, duplicar o guardar un ejercicio predefinido. No requiere migración SQL.

Cuando el navegador lo permite aparece **Instalar aplicación** en el perfil. En
iPhone y iPad se muestra una guía para añadirla desde Safari. Si se pierde la
conexión, la aplicación avisa, impide enviar cambios desde sus manejadores y ofrece
un reintento explícito si la carga inicial no puede completarse.

Las pruebas móviles incluyen Chromium y WebKit con el dispositivo iPhone 14,
incluidos el almacenamiento lleno o bloqueado y una fotografía inicial pendiente.
Para preparar los navegadores de pruebas: `npx playwright install chromium webkit`.

## Migración a Node 24 y mantenimiento

Las consultas que necesitan colecciones completas (Librería, resultados,
asistencia, convocatorias y vista previa de jugadora) utilizan páginas de
500 filas con un orden que termina en una clave única. Un fallo en una página
propaga el error en lugar de presentar un informe parcial. Las ventanas de
fechas y los permisos de Supabase siguen limitando los datos consultados.

Las cachés de cumpleaños e imágenes de contenido se separan por cuenta y se
limpian en los cambios de sesión, incluidos los iniciados desde otra pestaña.
Las respuestas pendientes no pueden volver a escribir la caché de una sesión
anterior. La campana también invalida sus datos al cambiar de cuenta, estado,
roles o permisos; reutiliza la disponibilidad compartida de los derbis y evita
consultar tareas y resultados que no utiliza.

El texto plano se muestra sin cargar el parser de Markdown. El contenido con
formato conserva HTML saneado, enlaces y listas; su parser y los modales de
Inicio se cargan cuando hacen falta. El detalle imprimible de entrenamientos
mantiene el renderizado inmediato del formato. El build conserva el presupuesto
de arranque de 600 kB / 180 kB gzip y añade uno de 700 kB / 200 kB gzip para
el arranque más Inicio.

En la comprobación local de estos cambios, el JavaScript estático del arranque
más Inicio pasa de 938,5 kB / 275,5 kB gzip a 605,0 kB / 174,2 kB gzip.
Esta medida excluye CSS, imágenes, respuestas de Supabase y los módulos que se
cargan después si el contenido necesita formato; no mide el tiempo total de carga.

La migración local utiliza **Node 24.21.0 LTS** y su npm **11.19.0**. Desarrollo y
el build de Cloudflare fijan la versión mediante `.nvmrc` y `.node-version`;
`engines` limita el proyecto a Node 24 y `.npmrc` impide instalar con una rama
incompatible. La [guía oficial de Node](https://nodejs.org/en/blog/migrations/v22-to-v24)
indica soporte para Node 24 hasta abril de 2028.

Fases aplicadas:

1. **Node con el lockfile anterior.** Se comprobó primero `npm ci`, pruebas, lint
   y build con Node 24, antes de actualizar dependencias. El tamaño del arranque
   permaneció igual. Una compilación local registró 8,52 s con Node 22 y 8,18 s con
   Node 24; estas ejecuciones aisladas no acreditan una mejora de compilación y no
   miden fluidez en Safari. Node construye la web; las usuarias ejecutan JavaScript
   en su navegador.
2. **Dependencias compatibles por grupos.** Vite pasa a 8.3.4, React y React DOM a
   19.3.0, Supabase JS a 2.117.3, PDF.js a 6.4.299, Playwright a 1.64.0 y Vitest a
   4.1.11. Se actualizaron también tipos, ESLint, Testing Library, teléfono y CLI
   de Supabase; las versiones exactas quedan en `package-lock.json`. Se mantiene
   TypeScript 6, jsdom 28 y PWA 1 con Workbox 7: sus siguientes versiones mayores
   requieren una revisión independiente. El plugin de React queda fijado en
   6.0.5, compatible con Vite 8; npm no pudo resolver los peers opcionales de Babel
   de 6.1.2 con este conjunto de dependencias. La instalación final se valida con
   `npm ci`, sin forzar esa resolución.
3. **Refactorización localizada.** `dashboardSelectors.ts` reúne los cálculos
   puros de Inicio y conserva reglas de temporada, publicación y vinculación.
   Solo calcula el resumen que se muestra (jugadora o staff), agrupa vinculaciones
   por jugadora y reutiliza resultados por tarea; React memoriza el resumen hasta
   que cambian sus datos o el día. `AppNavigation`, `navigationEntries` y
   `MobileProfileMenu` separan navegación, configuración y menú del layout.
   `CalendarTrainingPlans` separa las tarjetas de entrenamientos del calendario.
   `App.css` importa los módulos de `src/styles` en el orden original; la
   extracción conserva todas las reglas y la cascada. Una corrección de la modal
   impide que su foco inicial interrumpa la escritura en un campo ya seleccionado.
4. **Medición.** El presupuesto continúa en 600 kB JS sin comprimir / 180 kB gzip.
   Tras actualizar dependencias, el arranque registra aproximadamente 575,5 kB /
   163,1 kB gzip y el arranque más Inicio 937,1 kB / 275,0 kB gzip. Las versiones
   nuevas incrementan algo el tamaño respecto a las optimizaciones anteriores
   (538,4 kB / 152,6 kB gzip); el límite no se ha elevado. En una comparación local
   con Node 24, 40 jugadoras, 240 vinculaciones, 6 tareas y 1.000 cálculos por panel,
   el cálculo personal pasó de unos 0,23 ms a 0,013 ms y el del staff de 0,23 ms a
   0,15 ms, conservando los mismos resultados. Es una medición de lógica pura,
   sin red, DOM ni dispositivo real, y no representa el tiempo completo de Inicio.
5. **Comprobaciones continuas.** `.github/workflows/quality.yml` prepara pruebas,
   lint, build con presupuesto y revisión de espacios para pull requests y cambios
   en `main`, usando `.nvmrc` y `npm ci`. No despliega la aplicación ni requiere
   credenciales de Supabase. Vitest no carga `.env.local` y usa valores ficticios
   de Supabase para que las pruebas funcionen también en un checkout limpio.
   Los E2E se ejecutan localmente con Chromium y WebKit;
   `demo.local` no está versionada y no está disponible en el checkout de CI.

Validación local de esta migración: instalación limpia y árbol de dependencias
correctos; 611 pruebas en 116 archivos y 124 E2E aprobados; lint, build de
producción, presupuesto, TypeScript y build de demo correctos. Inicio, Calendario
y Entrenamientos conservan la geometría de referencia en escritorio y WebKit
móvil. La vista previa de producción permite entrar sin almacenamiento y recargar
la pantalla de acceso sin conexión cuando la caché está disponible. El workflow
está preparado y revisado localmente; su ejecución en GitHub queda pendiente de
subir estos cambios.

Para validar localmente:

```bash
nvm use
npm ci
npm test -- --run --maxWorkers=2
npm run lint
npm run build
npx tsc -p demo.local/tsconfig.json
npx vite build --config demo.local/vite.config.ts
npm run test:e2e
git diff --check
```

Antes de publicar, comprobar la vista previa de Cloudflare con Node 24.21.0, el
acceso real con Google y la actualización desde una PWA de la versión anterior.
La configuración del repositorio no permite verificar una posible sobrescritura
`NODE_VERSION` del panel de Cloudflare. Las pruebas locales no sustituyen esas
comprobaciones del despliegue ni una prueba en un iPhone físico. Esta migración
no necesita cambios de esquema ni ejecutar SQL en Supabase.

Revisar dependencias mensualmente y cuando una corrección afecte al proyecto;
actualizar por grupos compatibles y mantener el lockfile. Para futuras mejoras,
medir por separado acceso sin sesión, Inicio de jugadora, Inicio de staff y cambios
de mes del calendario, comparando descarga, consultas y renderizado con los mismos
datos y condiciones. Mantener la coordinación de `useTrainingData`, las reglas de
permisos y los selectores de dominio al extraer componentes; la división de archivos
mejora mantenimiento y solo mejora rendimiento cuando reduce trabajo o carga.
