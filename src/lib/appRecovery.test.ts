import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { isAppAssetLoadError, reloadApp } from './appRecovery'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function mockWorker(registration: unknown) {
  const container = Object.assign(new EventTarget(), { getRegistration: vi.fn().mockResolvedValue(registration) })
  vi.stubGlobal('navigator', { onLine: true, serviceWorker: container })
  return container
}

describe('application recovery', () => {
  test('recognizes Safari and Chromium asset failures without treating every error as an update', () => {
    expect(isAppAssetLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isAppAssetLoadError(new TypeError('Failed to fetch dynamically imported module: https://example.com/chunk.js'))).toBe(true)
    expect(isAppAssetLoadError({ name: 'ChunkLoadError', message: 'Error' })).toBe(true)
    expect(isAppAssetLoadError(new DOMException('Sin espacio', 'QuotaExceededError'))).toBe(false)
    expect(isAppAssetLoadError(new Error('Error de permisos'))).toBe(false)
  })

  test('activates a waiting update before reloading', async () => {
    const postMessage = vi.fn()
    const container = mockWorker({ waiting: { scriptURL: new URL('/sw.js', location.origin).href, postMessage } })
    const reload = vi.fn()
    const pending = reloadApp(reload)
    await Promise.resolve()
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reload).not.toHaveBeenCalled()
    container.dispatchEvent(new Event('controllerchange'))
    await pending
    expect(reload).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  test('bypasses the old app worker while preserving session and draft data', async () => {
    localStorage.setItem('session', 'keep-session')
    localStorage.setItem('draft', 'keep-draft')
    const unregister = vi.fn().mockResolvedValue(true)
    mockWorker({ active: { scriptURL: new URL('/sw.js', location.origin).href }, unregister })
    const reload = vi.fn()
    await reloadApp(reload)
    expect(unregister).toHaveBeenCalledOnce()
    expect(reload).toHaveBeenCalledOnce()
    expect(localStorage.getItem('session')).toBe('keep-session')
    expect(localStorage.getItem('draft')).toBe('keep-draft')
  })

  test('leaves other service workers alone', async () => {
    const unregister = vi.fn()
    mockWorker({ active: { scriptURL: new URL('/another-worker.js', location.origin).href }, unregister })
    await reloadApp(vi.fn())
    expect(unregister).not.toHaveBeenCalled()
  })

  test('recovers when worker operations reject or remain pending', async () => {
    const container = mockWorker(undefined)
    container.getRegistration.mockRejectedValueOnce(new DOMException('Bloqueado', 'SecurityError'))
    const reload = vi.fn()
    await reloadApp(reload)
    expect(reload).toHaveBeenCalledOnce()

    container.getRegistration.mockReturnValueOnce(new Promise(() => undefined))
    const pending = reloadApp(reload)
    await vi.advanceTimersByTimeAsync(3000)
    await pending
    expect(reload).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('removes the controller listener after an activation timeout', async () => {
    const container = mockWorker({ waiting: { scriptURL: new URL('/sw.js', location.origin).href, postMessage: vi.fn() } })
    const reload = vi.fn()
    const pending = reloadApp(reload)
    await vi.advanceTimersByTimeAsync(3000)
    await pending
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledOnce()
  })
})
