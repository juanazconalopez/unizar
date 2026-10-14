import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { APP_VERSION } from '../../lib/appVersion'
import { updateApp } from '../../lib/appRecovery'
import { AppVersionInfo } from './AppVersionInfo'

vi.mock('../../lib/appRecovery', () => ({ updateApp: vi.fn().mockResolvedValue(undefined) }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"version":"1.0.3"}')))
})
afterEach(() => vi.unstubAllGlobals())

describe('version in personal profile', () => {
  test('shows the executing version and offers an update to the newer publication', async () => {
    render(<AppVersionInfo />)
    expect(screen.getByText(`Versión ${APP_VERSION}`)).toBeInTheDocument()
    const update = await screen.findByRole('button', { name: 'Actualizar a 1.0.3' })
    expect(screen.queryByText('Versión 1.0.3')).not.toBeInTheDocument()
    await act(async () => fireEvent.click(update))
    expect(updateApp).toHaveBeenCalledOnce()
    expect(screen.getByText(`Versión ${APP_VERSION}`)).toBeInTheDocument()
  })

  test.each([APP_VERSION, '0.9.9'])('only shows the running version when server publishes %s', async (version) => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ version })))
    await act(async () => render(<AppVersionInfo />))
    expect(screen.getByText(`Versión ${APP_VERSION}`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Actualizar/ })).not.toBeInTheDocument()
  })

  test('keeps the local version when offline and checks again on reconnecting', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    render(<AppVersionInfo />)
    expect(await screen.findByRole('status')).toHaveTextContent('Recupera la conexión')
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByText(`Versión ${APP_VERSION}`)).toBeInTheDocument()
    vi.stubGlobal('navigator', { onLine: true })
    fireEvent(window, new Event('online'))
    expect(await screen.findByRole('button', { name: 'Actualizar a 1.0.3' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('does not claim to be updated when the server check fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network failed'))
    render(<AppVersionInfo />)
    expect(await screen.findByRole('status')).toHaveTextContent('No se pudo comprobar')
    expect(screen.getByText(`Versión ${APP_VERSION}`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Actualizar/ })).not.toBeInTheDocument()
  })

  test('allows retrying a failed update without changing the running version', async () => {
    vi.mocked(updateApp).mockRejectedValueOnce(new Error('Recupera la conexión antes de actualizar.'))
    render(<AppVersionInfo />)
    const update = await screen.findByRole('button', { name: 'Actualizar a 1.0.3' })
    await act(async () => fireEvent.click(update))
    expect(screen.getByRole('alert')).toHaveTextContent('Recupera la conexión')
    expect(update).toBeEnabled()
    expect(screen.getByText(`Versión ${APP_VERSION}`)).toBeInTheDocument()
    await act(async () => fireEvent.click(update))
    expect(updateApp).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('protects profile edits and does not update while the profile is saving', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { rerender } = render(<AppVersionInfo hasUnsavedChanges />)
    const update = await screen.findByRole('button', { name: 'Actualizar a 1.0.3' })
    fireEvent.click(update)
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('sin guardar'))
    expect(updateApp).not.toHaveBeenCalled()
    rerender(<AppVersionInfo disabled />)
    expect(update).toBeDisabled()
  })
})
