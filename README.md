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

Requiere Node `20.19` o posterior compatible con Vite 8.

```bash
nvm use 22
npm install
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
nvm use 22
npm test
npm run lint
npm run build
```

Los tests usan Vitest y Testing Library. Las pruebas de cada componente o feature
se guardan junto al archivo probado (`*.test.tsx`); `src/test` contiene únicamente
la configuración y las fixtures compartidas. Para trabajar en modo interactivo:

```bash
nvm use 22
npm run test:watch
```

Los tipos del esquema usados por el cliente de Supabase se guardan en
`src/lib/database.types.ts`. Regéneralos después de aplicar una migración:

```bash
nvm use 22
SUPABASE_PROJECT_ID=tu-project-ref SUPABASE_ACCESS_TOKEN=tu-token npm run types:supabase
```

Sin `SUPABASE_PROJECT_ID`, el mismo comando consulta la instancia local iniciada
con Supabase CLI. La compilación estricta detectará después cualquier consulta o
escritura que ya no coincida con el esquema.

Las comprobaciones SQL de esquema y RLS están en `supabase/tests/schema_test.sql`
y se ejecutan con Supabase CLI mediante `supabase test db`.

En Supabase, añade tanto la dirección local como la dirección desplegada a **Authentication → URL Configuration → Redirect URLs**.

## Publicación en Cloudflare Pages

Conecta el repositorio de GitHub desde **Workers & Pages → Create → Pages → Connect to Git** y utiliza:

- Rama de producción: `main`
- Comando de compilación: `npm run build`
- Directorio de salida: `dist`
- Versión de Node: la indicada en `.node-version`

Configura estas variables tanto para producción como para las vistas previas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Después del primer despliegue, añade la dirección `https://<proyecto>.pages.dev` a las URLs de redirección permitidas de Supabase. La URI autorizada de Google continúa siendo el callback de Supabase, no la URL de Cloudflare.

## Aplicación instalable (PWA)

La compilación genera el manifest, el service worker y los iconos necesarios para
instalar la aplicación desde Android, iOS y navegadores de escritorio. No se deben
añadir reglas de caché globales en Cloudflare Pages: el HTML y el service worker
necesitan revalidarse para detectar cada despliegue, mientras que los recursos de
Vite ya incluyen hashes y se almacenan de forma segura.

Cuando hay una versión nueva, la aplicación muestra el aviso **Nueva versión
disponible**. La actualización solo se aplica al pulsar el botón para evitar perder
un formulario que se esté rellenando y conserva la sesión de Supabase.

Los datos no se guardan en la caché del service worker. Se consultan al iniciar la
aplicación y se refrescan silenciosamente al volver a primer plano o recuperar la
conexión, siempre que haya pasado al menos un minuto desde la última carga.

Las secciones secundarias se descargan bajo demanda. La precaché contiene solo la
estructura inicial, estilos e iconos de instalación; los fragmentos versionados,
los escudos y las fuentes se guardan después de su primer uso. Las consultas de
Supabase también se separan por sección para que Inicio no descargue resultados,
partidos o asistencias de gestión que no necesita.

Cuando el navegador lo permite aparece **Instalar aplicación** en el perfil. En
iPhone y iPad se muestra una guía para añadirla desde Safari. Si se pierde la
conexión, la aplicación avisa, impide enviar cambios desde sus manejadores y ofrece
un reintento explícito si la carga inicial no puede completarse.
