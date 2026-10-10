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

- Rama de producción: `main`
- Comando de compilación: `npm run build`
- Comando de despliegue: `npx wrangler deploy`
- Recursos generados por Vite: `dist`
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

## Aplicación instalable (PWA)

La compilación genera el manifest, el service worker y los iconos necesarios para
instalar la aplicación desde Android, iOS y navegadores de escritorio. No se deben
añadir reglas de caché globales en Cloudflare: el HTML y el service worker
necesitan revalidarse para detectar cada despliegue, mientras que los recursos de
Vite ya incluyen hashes y se almacenan de forma segura.

Cuando hay una versión nueva, la aplicación muestra el aviso **Nueva versión
disponible**. La actualización solo se aplica al pulsar el botón para evitar perder
un formulario que se esté rellenando y conserva la sesión de Supabase.

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

Las secciones secundarias se descargan bajo demanda. La precaché contiene solo la
estructura inicial, estilos e iconos de instalación; los fragmentos versionados,
los escudos y las fuentes se guardan después de su primer uso. Las consultas de
Supabase también se separan por sección para que Inicio no descargue resultados,
partidos o asistencias de gestión que no necesita.

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
