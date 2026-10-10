import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { RegisterSWOptions } from 'vite-plugin-pwa/types'

const sw = vi.hoisted(() => ({ options: null as RegisterSWOptions | null, needRefresh: true, setNeedRefresh: vi.fn() }))
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: RegisterSWOptions) => {
    sw.options = options
    return { needRefresh: [sw.needRefresh, sw.setNeedRefresh] }
  },
}))
vi.mock('../../lib/appRecovery', () => ({ reloadApp: vi.fn().mockResolvedValue(undefined) }))

import { PwaUpdatePrompt } from './PwaUpdatePrompt'
import { reloadApp } from '../../lib/appRecovery'

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('optional PWA updates', () => {
  test('updates only after the user clicks the button', async () => {
    render(<PwaUpdatePrompt />)
    expect(reloadApp).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Actualizar' })))
    expect(reloadApp).toHaveBeenCalledOnce()
  })

  test('keeps the current screen and offers a retry when offline', () => {
    vi.stubGlobal('navigator', { onLine: false })
    render(<PwaUpdatePrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Recupera la conexión antes de actualizar.')
    expect(reloadApp).not.toHaveBeenCalled()
  })

  test('ignores optional registration and background update failures', async () => {
    render(<PwaUpdatePrompt />)
    expect(() => sw.options?.onRegisterError?.(new DOMException('Sin espacio', 'QuotaExceededError'))).not.toThrow()
    const update = vi.fn().mockRejectedValue(new Error('No hay conexión'))
    act(() => sw.options?.onRegisteredSW?.('/sw.js', { update } as unknown as ServiceWorkerRegistration))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
      window.dispatchEvent(new Event('focus'))
    })
    expect(update).toHaveBeenCalledOnce()
    expect(screen.getByText('Nueva versión disponible')).toBeInTheDocument()
  })
})
