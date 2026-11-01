// @vitest-environment node
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, test, vi } from 'vitest'

type WorkerEvent = { data?: unknown; waitUntil: (work: Promise<void>) => void; notification?: unknown; ports?: unknown[] }

function workerHarness(owner = 'player-1') {
  const handlers: Record<string, (event: WorkerEvent) => void> = {}
  let stored: string | null = owner
  const showNotification = vi.fn().mockResolvedValue(undefined)
  const navigate = vi.fn().mockResolvedValue(undefined)
  const focus = vi.fn().mockResolvedValue(undefined)
  const openWindow = vi.fn()
  const cache = {
    match: async () => stored ? { text: async () => stored } : undefined,
    put: async (_url: string, response: Response) => { stored = await response.text() },
    delete: async () => { stored = null },
  }
  runInNewContext(readFileSync(new URL('../../../public/push-sw.js', import.meta.url), 'utf8'), {
    URL, Response,
    caches: { open: async () => cache },
    self: {
      location: { origin: 'https://club.test' },
      addEventListener: (type: string, callback: (event: WorkerEvent) => void) => { handlers[type] = callback },
      registration: { showNotification, getNotifications: async () => [] },
      clients: { matchAll: async () => [{ url: 'https://club.test/', navigate, focus }], openWindow },
    },
  })
  async function dispatch(type: string, properties: Omit<WorkerEvent, 'waitUntil'>) {
    let work = Promise.resolve()
    handlers[type]({ ...properties, waitUntil: (promise) => { work = promise } })
    await work
  }
  return { dispatch, showNotification, navigate, focus, openWindow }
}

describe('recepción y apertura de push en la PWA', () => {
  test('muestra avisos de la cuenta vinculada sin exponer datos del mensaje', async () => {
    const worker = workerHarness()
    await worker.dispatch('push', { data: { json: () => ({ userId: 'player-1', eventId: 'event-1', title: 'Convocatoria publicada', body: 'datos privados', url: '/?view=calendar&date=2026-11-12' }) } })
    expect(worker.showNotification).toHaveBeenCalledWith('Convocatoria publicada', expect.objectContaining({ body: 'Abre la aplicación para consultar el aviso.', tag: 'event-1' }))
  })

  test('ignora mensajes de otra cuenta y no permite abrir un destino externo', async () => {
    const worker = workerHarness()
    await worker.dispatch('push', { data: { json: () => ({ userId: 'player-2', title: 'Ajeno' }) } })
    expect(worker.showNotification).not.toHaveBeenCalled()
    const close = vi.fn()
    await worker.dispatch('notificationclick', { notification: { close, data: { userId: 'player-1', url: 'https://evil.test/' } } })
    expect(close).toHaveBeenCalled()
    expect(worker.navigate).toHaveBeenCalledWith('https://club.test/')
    expect(worker.focus).toHaveBeenCalled()
  })

  test('desvincular la cuenta impide mostrar y abrir notificaciones antiguas', async () => {
    const worker = workerHarness()
    const reply = vi.fn()
    await worker.dispatch('message', { data: { type: 'PUSH_ACCOUNT', owner: null }, ports: [{ postMessage: reply }] })
    expect(reply).toHaveBeenCalledWith({ ok: true })
    await worker.dispatch('push', { data: { json: () => ({ userId: 'player-1', title: 'Antiguo' }) } })
    await worker.dispatch('notificationclick', { notification: { close: vi.fn(), data: { userId: 'player-1', url: '/?view=calendar' } } })
    expect(worker.showNotification).not.toHaveBeenCalled()
    expect(worker.navigate).not.toHaveBeenCalled()
    expect(worker.openWindow).not.toHaveBeenCalled()
  })
})
