import { navigationFromLocation, urlForNavigation } from '../lib/navigation'
import { reconcilePushAccount } from './pushNotificationsService'
export { disablePush } from './pushNotificationsService'

const RETURN_KEY = 'cdu-auth-return'

/** Los errores de este canal adicional no bloquean la recuperación de la sesión. */
export async function syncSessionDevice(userId: string | null) {
  if (userId) restoreAuthNavigation()
  await reconcilePushAccount(userId)
}

/** Solo conserva navegación de la app; nunca tokens OAuth, fragmentos ni URLs externas. */
export function rememberAuthNavigation() {
  try {
    const target = navigationFromLocation()
    const search = new URL(urlForNavigation(target), window.location.origin).search
    if (!search) sessionStorage.removeItem(RETURN_KEY)
    else sessionStorage.setItem(RETURN_KEY, JSON.stringify({ search, expiresAt: Date.now() + 30 * 60 * 1000 }))
  } catch { /* El acceso con Google funciona también si se bloquea sessionStorage. */ }
}

export function restoreAuthNavigation() {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(RETURN_KEY) ?? 'null')
    sessionStorage.removeItem(RETURN_KEY)
    if (!saved || typeof saved !== 'object' || !('search' in saved) || typeof saved.search !== 'string'
      || !('expiresAt' in saved) || typeof saved.expiresAt !== 'number' || saved.expiresAt < Date.now()
      || new URLSearchParams(window.location.search).has('view')) return
    const target = navigationFromLocation({ search: saved.search })
    window.history.replaceState(target, '', urlForNavigation(target))
    window.dispatchEvent(new PopStateEvent('popstate'))
  } catch { /* La recuperación del destino no bloquea la sesión. */ }
}
