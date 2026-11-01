import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { rememberAuthNavigation, restoreAuthNavigation } from './sessionDeviceService'

vi.mock('./pushNotificationsService', () => ({ disablePush: vi.fn(), reconcilePushAccount: vi.fn() }))

describe('destino de una push tras entrar con Google', () => {
  beforeEach(() => { sessionStorage.clear(); window.history.replaceState(null, '', '/'); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T09:00:00Z')) })
  afterEach(() => vi.useRealTimers())

  test('recupera la fecha y el aviso una sola vez, sin guardar fragmentos OAuth', () => {
    window.history.replaceState(null, '', '/?view=calendar&date=2026-11-12&announcement=notice-1#access_token=private-token')
    rememberAuthNavigation()
    expect(sessionStorage.getItem('cdu-auth-return')).not.toContain('private-token')
    window.history.replaceState(null, '', '/')
    const changed = vi.fn()
    window.addEventListener('popstate', changed, { once: true })
    restoreAuthNavigation()
    expect(window.location.search).toBe('?view=calendar&date=2026-11-12&announcement=notice-1')
    expect(changed).toHaveBeenCalledOnce()
    expect(sessionStorage.getItem('cdu-auth-return')).toBeNull()
  })

  test('no sustituye el destino de una nueva notificación por un destino anterior', () => {
    window.history.replaceState(null, '', '/?view=training-groups')
    rememberAuthNavigation()
    window.history.replaceState(null, '', '/?view=calendar&date=2026-11-13')
    restoreAuthNavigation()
    expect(window.location.search).toBe('?view=calendar&date=2026-11-13')
  })

  test('descarta destinos caducados y búsquedas con rutas desconocidas', () => {
    window.history.replaceState(null, '', '/?view=calendar&date=2026-11-12')
    rememberAuthNavigation()
    window.history.replaceState(null, '', '/')
    vi.setSystemTime(new Date('2026-11-01T10:00:00Z'))
    restoreAuthNavigation()
    expect(window.location.search).toBe('')
    sessionStorage.setItem('cdu-auth-return', JSON.stringify({ search: '?view=https://evil.test&date=bad', expiresAt: Date.now() + 1000 }))
    restoreAuthNavigation()
    expect(window.location.pathname).toBe('/')
    expect(window.location.search).toBe('')
  })
})
