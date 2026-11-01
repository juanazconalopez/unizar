import { beforeEach, describe, expect, test, vi } from 'vitest'
const api = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: api.rpc, auth: { getSession: api.getSession } } }))
import { disablePush, enablePush, getPushDeviceState, pushSupportMessage, reconcilePushAccount, savePushTopics } from './pushNotificationsService'

const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/device', unsubscribe: vi.fn(),
  toJSON: () => ({ keys: { p256dh: 'public-key', auth: 'auth-key' } }),
}
const worker = { postMessage: vi.fn() }
const registered = { active: worker, pushManager: { getSubscription: vi.fn(), subscribe: vi.fn() } }

describe('notificaciones por dispositivo', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') })
    vi.stubGlobal('MessageChannel', class {
      port1 = { onmessage: null as ((event: { data: unknown }) => void) | null, close: vi.fn() }
      port2 = { postMessage: (data: unknown) => queueMicrotask(() => this.port1.onmessage?.({ data })) }
    })
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: vi.fn().mockResolvedValue(registered) } })
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Chrome' })
    api.rpc.mockResolvedValue({ data: [], error: null })
    api.getSession.mockResolvedValue({ data: { session: { user: { id: 'player-1' } } } })
    registered.pushManager.getSubscription.mockResolvedValue(subscription)
    registered.pushManager.subscribe.mockResolvedValue(subscription)
    subscription.unsubscribe.mockResolvedValue(true)
    worker.postMessage.mockImplementation((_message, ports) => ports[0].postMessage({ ok: true }))
  })

  test('no consulta Supabase si este navegador no está suscrito', async () => {
    expect(await getPushDeviceState('player-1')).toMatchObject({ enabled: false })
    expect(api.rpc).not.toHaveBeenCalled()
  })

  test('desvincula el dispositivo antes de descartar sus datos locales', async () => {
    localStorage.setItem('cdu-push-device', 'device-1')
    localStorage.setItem('cdu-push-owner', 'player-1')
    await disablePush()
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(api.rpc).toHaveBeenCalledWith('unregister_push_device', { checked_device_key: 'device-1' })
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'PUSH_ACCOUNT', owner: null }, expect.any(Array))
    expect(localStorage.getItem('cdu-push-owner')).toBeNull()
  })

  test('puede cerrar sesión sin red si elimina la suscripción del navegador', async () => {
    localStorage.setItem('cdu-push-device', 'device-1')
    api.rpc.mockResolvedValue({ error: new Error('sin conexión') })
    await expect(disablePush()).resolves.toBeUndefined()
    expect(localStorage.getItem('cdu-push-device')).toBeNull()
  })

  test('no descarta la desvinculación si fallan tanto navegador como servidor', async () => {
    localStorage.setItem('cdu-push-device', 'device-1')
    subscription.unsubscribe.mockResolvedValue(false)
    api.rpc.mockResolvedValue({ error: new Error('sin conexión') })
    await expect(disablePush()).rejects.toThrow('Recupera la conexión')
    expect(localStorage.getItem('cdu-push-device')).toBe('device-1')
  })

  test('cambiar de cuenta elimina la suscripción anterior y no la reasigna', async () => {
    localStorage.setItem('cdu-push-owner', 'player-1')
    localStorage.setItem('cdu-push-device', 'device-1')
    api.getSession.mockResolvedValue({ data: { session: { user: { id: 'player-2' } } } })
    await reconcilePushAccount('player-2')
    expect(subscription.unsubscribe).toHaveBeenCalled()
    expect(api.rpc).not.toHaveBeenCalledWith('register_push_device', expect.anything())
  })

  test('ignora una sincronización antigua que llega después de cambiar de cuenta', async () => {
    localStorage.setItem('cdu-push-owner', 'player-1')
    api.getSession.mockResolvedValue({ data: { session: { user: { id: 'player-2' } } } })
    await reconcilePushAccount('player-1')
    expect(worker.postMessage).not.toHaveBeenCalled()
    expect(api.rpc).not.toHaveBeenCalled()
  })

  test('no guarda preferencias para una cuenta que ya no está conectada', async () => {
    await expect(savePushTopics('player-2', ['matches'])).rejects.toThrow('La cuenta ha cambiado')
    expect(api.rpc).not.toHaveBeenCalled()
  })

  test('no solicita permisos automáticamente al consultar el estado', async () => {
    await getPushDeviceState('player-1')
    expect(Notification.requestPermission).not.toHaveBeenCalled()
  })

  test('solo vincula la cuenta al worker después de registrar el dispositivo', async () => {
    registered.pushManager.getSubscription.mockResolvedValue(null)
    await enablePush('player-1', ['matches', 'lineups'])
    expect(api.rpc).toHaveBeenCalledWith('register_push_device', expect.objectContaining({
      checked_endpoint: subscription.endpoint, checked_p256dh: 'public-key', checked_auth: 'auth-key', checked_topics: ['matches', 'lineups'],
    }))
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'PUSH_ACCOUNT', owner: 'player-1' }, expect.any(Array))
    expect(localStorage.getItem('cdu-push-owner')).toBe('player-1')
    expect(localStorage.getItem('cdu-push-device')).toMatch(/^[0-9a-f-]{36}$/)
  })

  test('revoca la suscripción si cambia la cuenta durante el alta', async () => {
    registered.pushManager.getSubscription.mockResolvedValue(null)
    api.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'player-1' } } } })
      .mockResolvedValueOnce({ data: { session: { user: { id: 'player-1' } } } })
      .mockResolvedValue({ data: { session: { user: { id: 'player-2' } } } })
    await expect(enablePush('player-1', ['matches'])).rejects.toThrow('La cuenta ha cambiado')
    expect(subscription.unsubscribe).toHaveBeenCalled()
    expect(localStorage.getItem('cdu-push-owner')).toBeNull()
  })

  test('explica la instalación necesaria en iPhone', () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone' })
    expect(pushSupportMessage()).toContain('pantalla de inicio')
  })

  test('rechazar el permiso no crea una suscripción en el servidor', async () => {
    // La configuración se importa al cargar el módulo: la prueba se ejecuta con la clave pública de Vitest.
    vi.mocked(Notification.requestPermission).mockResolvedValue('denied')
    await expect(enablePush('player-1', ['matches'])).rejects.toThrow()
    expect(api.rpc).not.toHaveBeenCalled()
  })
})
