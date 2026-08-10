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
- Desautorización reversible de cuentas sin perder su histórico.

La autorización real se aplica mediante las políticas RLS de `supabase/migrations`.

## Base de datos

Las migraciones se aplican en orden desde el editor SQL de Supabase. Las migraciones
`003` a `008` añaden asistencia, archivo reversible de usuarios, lectura de resultados
para gestores, tipos de tarea canónicos, periodos históricos de participación y
normalización de nombres, partidos, disponibilidad y alineaciones, además de la actualización automática de `updated_at`.
Deben aplicarse todas antes de publicar.

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

Los secretos de Google no deben guardarse en el proyecto ni usar el prefijo `VITE_`. Se configuran únicamente en Supabase, dentro de **Authentication → Sign In / Providers → Google**.

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
