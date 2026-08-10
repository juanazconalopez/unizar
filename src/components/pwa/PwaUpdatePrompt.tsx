import { useCallback, useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
const MIN_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000

export function PwaUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const lastUpdateCheck = useRef(0)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_serviceWorkerUrl, registration) {
      if (registration) {
        lastUpdateCheck.current = Date.now()
        setRegistration(registration)
      }
    },
  })

  const checkForUpdate = useCallback(() => {
    if (!registration || !navigator.onLine || document.visibilityState !== 'visible') return
    if (Date.now() - lastUpdateCheck.current < MIN_UPDATE_CHECK_INTERVAL_MS) return
    lastUpdateCheck.current = Date.now()
    void registration.update()
  }, [registration])

  useEffect(() => {
    if (!registration) return

    const updateTimer = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', checkForUpdate)
    window.addEventListener('focus', checkForUpdate)
    return () => {
      window.clearInterval(updateTimer)
      document.removeEventListener('visibilitychange', checkForUpdate)
      window.removeEventListener('focus', checkForUpdate)
    }
  }, [checkForUpdate, registration])

  if (!needRefresh) return null

  return (
    <aside aria-live="polite" className="pwa-update">
      <div>
        <strong>Nueva versión disponible</strong>
        <span>Actualiza para recibir las últimas mejoras. Tu sesión seguirá iniciada.</span>
      </div>
      <div className="pwa-update-actions">
        <button className="secondary-button compact" onClick={() => setNeedRefresh(false)} type="button">
          Más tarde
        </button>
        <button className="primary-button compact" onClick={() => void updateServiceWorker(true)} type="button">
          Actualizar
        </button>
      </div>
    </aside>
  )
}
