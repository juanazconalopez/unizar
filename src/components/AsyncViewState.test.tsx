import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ViewErrorBoundary } from './AsyncViewState'
import { reloadApp } from '../lib/appRecovery'

vi.mock('../lib/appRecovery', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/appRecovery')>(),
  reloadApp: vi.fn().mockResolvedValue(undefined),
}))

function BrokenView({ error }: { error: Error }): never { throw error }

describe('view error recovery', () => {
  test('offers an explicit update for a missing Safari module', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<ViewErrorBoundary><BrokenView error={new TypeError('Importing a module script failed.')} /></ViewErrorBoundary>)
    expect(screen.getByText('La sección necesita actualizarse')).toBeInTheDocument()
    expect(reloadApp).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar y reintentar' }))
    expect(reloadApp).toHaveBeenCalledOnce()
  })

  test('does not blame an app error on an update', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<ViewErrorBoundary><BrokenView error={new Error('Error de aplicación')} /></ViewErrorBoundary>)
    expect(screen.getByText('No hemos podido abrir esta pantalla')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
