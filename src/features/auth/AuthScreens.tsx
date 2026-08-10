import clubLogo from '../../assets/BFCZgzPP.png'
import { Icon } from '../../components/Icon'
import { ClubBrand } from '../../components/ui/ClubBrand'

export function LoadingScreen() {
  return (
    <div className="center-screen">
      <img alt="CDU Rugby Zaragoza" className="loading-logo" src={clubLogo} />
      <div className="loader" />
      <p>Preparando tu espacio…</p>
    </div>
  )
}

export function DataLoadErrorScreen({ errorMessage, online, onRetry, onSignOut }: {
  errorMessage: string
  online: boolean
  onRetry: () => void
  onSignOut: () => void
}) {
  return (
    <main className="center-screen pending-screen load-error-screen">
      <span className="pending-club-logo"><img alt="CDU Rugby Zaragoza" src={clubLogo} /></span>
      <span className="eyebrow">{online ? 'NO SE HAN PODIDO CARGAR LOS DATOS' : 'SIN CONEXIÓN'}</span>
      <h1>{online ? 'Algo no ha ido bien' : 'Necesitamos conexión'}</h1>
      <p>{online ? errorMessage : 'Conéctate a Internet para recuperar la información actualizada del equipo.'}</p>
      <div className="load-error-actions">
        <button className="primary-button" disabled={!online} onClick={onRetry} type="button">Reintentar</button>
        <button className="secondary-button" onClick={onSignOut} type="button"><Icon name="logout" size={18} />Cerrar sesión</button>
      </div>
    </main>
  )
}

export function LoginScreen({ errorMessage, onLogin }: { errorMessage: string; onLogin: () => void }) {
  return (
    <main className="login-screen">
      <section className="login-copy">
        <ClubBrand />
        <div>
          <span className="eyebrow">CDU RUGBY ZARAGOZA · SENIOR FEMENINO</span>
          <h1>Entrenamos<br />como equipo.</h1>
          <p>Consulta tus sesiones, registra cómo te has sentido y sigue tu evolución junto al resto del equipo.</p>
        </div>
        <div className="login-feature">
          <span><Icon name="check" /></span>
          <div><strong>Una semana más clara</strong><p>Todas tus tareas organizadas por temporada.</p></div>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <img alt="Escudo del CDU Rugby Zaragoza" className="login-logo" src={clubLogo} />
          <h2>Te damos la bienvenida</h2>
          <p>Accede con la cuenta de Google que utilizas con tu equipo.</p>
          <button className="google-button" onClick={onLogin}><GoogleIcon /> Continuar con Google</button>
          {errorMessage && <p className="form-error">{errorMessage}</p>}
          <small>Las cuentas nuevas necesitan la aprobación de un administrador.</small>
        </div>
      </section>
    </main>
  )
}

export function PendingScreen({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  return (
    <main className="center-screen pending-screen">
      <span className="pending-club-logo"><img alt="CDU Rugby Zaragoza" src={clubLogo} /></span>
      <span className="eyebrow">SOLICITUD ENVIADA</span>
      <h1>Hola, {name}</h1>
      <p>Tu cuenta está esperando la aprobación del administrador. Podrás entrar en cuanto forme parte del equipo.</p>
      <button className="secondary-button" onClick={onSignOut}><Icon name="logout" size={18} />Cerrar sesión</button>
    </main>
  )
}

export function DisabledScreen({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  return (
    <main className="center-screen pending-screen">
      <span className="pending-club-logo"><img alt="CDU Rugby Zaragoza" src={clubLogo} /></span>
      <span className="eyebrow">CUENTA DESAUTORIZADA</span>
      <h1>Hola, {name}</h1>
      <p>Tu cuenta ya no tiene acceso a la aplicación. Si crees que se trata de un error, ponte en contacto con el responsable del equipo.</p>
      <button className="secondary-button" onClick={onSignOut}><Icon name="logout" size={18} />Cerrar sesión</button>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" height="20" viewBox="0 0 24 24" width="20">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.24-2.53c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.87A6.02 6.02 0 0 1 6.07 12c0-.65.11-1.28.32-1.87v-2.6H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.47l3.35-2.6Z" />
      <path fill="#EA4335" d="M12 6c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.53l3.35 2.6C7.18 7.76 9.39 6 12 6Z" />
    </svg>
  )
}
