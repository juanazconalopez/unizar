import { errorText } from './errors'

export function isAppAssetLoadError(error: unknown) {
  return /ChunkLoadError|Loading chunk .+ failed|Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(errorText(error))
    || (typeof error === 'object' && error !== null && 'name' in error && error.name === 'ChunkLoadError')
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
      const worker = registration?.waiting ?? registration?.active
      const scriptUrl = worker ? new URL(worker.scriptURL) : null
      if (!registration || scriptUrl?.origin !== location.origin || scriptUrl.pathname !== '/sw.js') return finish()
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
