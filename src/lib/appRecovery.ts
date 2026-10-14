import { errorText } from './errors'

export function isAppAssetLoadError(error: unknown) {
  return /ChunkLoadError|Loading chunk .+ failed|Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(errorText(error))
    || (typeof error === 'object' && error !== null && 'name' in error && error.name === 'ChunkLoadError')
}

function isAppRegistration(registration: ServiceWorkerRegistration | undefined): registration is ServiceWorkerRegistration {
  const worker = registration?.waiting ?? registration?.active ?? registration?.installing
  if (!worker) return false
  const url = new URL(worker.scriptURL)
  return url.origin === location.origin && url.pathname === '/sw.js'
}

function waitForInstallation(worker: ServiceWorker): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      window.clearTimeout(timeout)
      worker.removeEventListener('statechange', check)
      if (error) reject(error)
      else resolve()
    }
    const check = () => {
      if (worker.state === 'redundant') finish(new Error('No se pudo preparar la actualización. Inténtalo de nuevo.'))
      else if (['installed', 'activating', 'activated'].includes(worker.state)) finish()
    }
    const timeout = window.setTimeout(() => finish(new Error('La actualización está tardando demasiado. Inténtalo de nuevo.')), 15_000)
    worker.addEventListener('statechange', check)
    check()
  })
}

async function withUpdateTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeout: number | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = window.setTimeout(() => reject(new Error('La actualización está tardando demasiado. Inténtalo de nuevo.')), 15_000)
      }),
    ])
  } finally {
    window.clearTimeout(timeout)
  }
}

/** El perfil comprueba y prepara la publicación más reciente antes de activar o recuperar la PWA. */
export async function updateApp(reload?: () => void): Promise<void> {
  if (!navigator.onLine) throw new Error('Recupera la conexión antes de actualizar.')
  const registration = await withUpdateTimeout(navigator.serviceWorker?.getRegistration().catch(() => undefined) ?? Promise.resolve(undefined))
  if (isAppRegistration(registration)) {
    await withUpdateTimeout(registration.update().catch(() => { throw new Error('No se pudo descargar la actualización. Comprueba la conexión e inténtalo de nuevo.') }))
    if (registration.installing) await waitForInstallation(registration.installing)
  }
  if (!navigator.onLine) throw new Error('Recupera la conexión antes de actualizar.')
  await reloadApp(reload)
}

/** Recuperación explícita: renueva solo el worker de esta app, conservando sesión y borradores. */
export function reloadApp(reload: () => void = () => window.location.reload()): Promise<void> {
  return new Promise((resolve) => {
    let finished = false
    let serviceWorker: ServiceWorkerContainer | undefined
    const finish = () => {
      if (finished) return
      finished = true
      window.clearTimeout(timeout)
      serviceWorker?.removeEventListener('controllerchange', finish)
      reload()
      resolve()
    }
    // También recuperamos el control si Safari deja pendiente una operación del worker.
    const timeout = window.setTimeout(finish, 3000)
    void (async () => {
      if (!navigator.onLine) return finish()
      serviceWorker = navigator.serviceWorker
      const registration = await serviceWorker?.getRegistration()
      if (finished) return
      if (!isAppRegistration(registration)) return finish()
      if (registration.waiting) {
        serviceWorker!.addEventListener('controllerchange', finish)
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      } else {
        // Un worker antiguo puede seguir sirviendo el HTML de un despliegue anterior.
        // La siguiente navegación obtiene el HTML actual; no borramos Cache Storage ni localStorage.
        await registration.unregister()
        finish()
      }
    })().catch(finish)
  })
}
