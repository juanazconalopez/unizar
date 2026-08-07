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

Las migraciones se aplican en orden desde el editor SQL de Supabase. La migración
`003_attendance_and_archived_users.sql` añade las sesiones de campo, la asistencia,
el archivo reversible de usuarios y sus políticas RLS. Debe aplicarse antes de
publicar una versión del frontend que utilice esas funciones.

## Desarrollo local

Requiere Node `20.19` o posterior compatible con Vite 8.

```bash
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
npm run lint
npm run build
```

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
