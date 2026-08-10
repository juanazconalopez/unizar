import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { makeProfile } from '../../test/fixtures'
import { AppLayout } from './AppLayout'

function renderLayout(profile = makeProfile(), onNavigate = vi.fn()) {
  render(
    <AppLayout
      profile={profile}
      email="ana@example.com"
      view="home"
      message=""
      errorMessage=""
      onNavigate={onNavigate}
      onSignOut={vi.fn()}
    >
      <p>Contenido</p>
    </AppLayout>,
  )
  return { navigation: screen.getByRole('navigation', { name: 'Navegación principal' }), onNavigate }
}

describe('AppLayout', () => {
  test('limits player navigation to the permitted screens', async () => {
    const user = userEvent.setup()
    const { navigation, onNavigate } = renderLayout()

    expect(within(navigation).getByRole('button', { name: 'Inicio' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: 'Tareas' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: 'Partidos' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: 'Competición' })).toBeInTheDocument()
    expect(within(navigation).queryByRole('button', { name: 'Resumen' })).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('button', { name: 'Equipo' })).not.toBeInTheDocument()

    await user.click(within(navigation).getByRole('button', { name: 'Tareas' }))
    expect(onNavigate).toHaveBeenCalledWith('tasks')
  })

  test('shows every management area to owners', () => {
    const { navigation } = renderLayout(makeProfile({ is_owner: true, is_collaborator: true }))

    for (const label of ['Inicio', 'Resumen', 'Tareas', 'Partidos', 'Asistencia', 'Ajustes']) {
      expect(within(navigation).getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(within(navigation).queryByRole('button', { name: 'Temporadas' })).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('button', { name: 'Equipo' })).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('button', { name: 'Competición' })).not.toBeInTheDocument()
  })

  test('keeps player sections available when a player is also a collaborator', () => {
    const { navigation } = renderLayout(makeProfile({ is_collaborator: true }))
    expect(within(navigation).getByRole('button', { name: 'Tareas' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: 'Partidos' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: 'Competición' })).toBeInTheDocument()
    expect(within(navigation).queryByRole('button', { name: 'Resumen' })).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('button', { name: 'Ajustes' })).not.toBeInTheDocument()
  })

  test('offers the native PWA installation when the browser supports it', async () => {
    const user = userEvent.setup()
    const prompt = vi.fn().mockResolvedValue(undefined)
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    })

    act(() => window.dispatchEvent(event))
    renderLayout()
    await user.click(screen.getByRole('button', { name: 'Instalar aplicación' }))

    expect(prompt).toHaveBeenCalledOnce()
  })

  test('warns when the application loses its connection', () => {
    render(
      <AppLayout
        profile={makeProfile()}
        email="ana@example.com"
        view="home"
        message=""
        errorMessage=""
        online={false}
        onNavigate={vi.fn()}
        onSignOut={vi.fn()}
      >
        <p>Contenido</p>
      </AppLayout>,
    )

    expect(screen.getByText(/Sin conexión. Puedes consultar/)).toBeInTheDocument()
  })
})
