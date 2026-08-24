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
    const { navigation } = renderLayout(makeProfile({ is_owner: true }))

    for (const label of ['Inicio', 'Resumen', 'Tareas', 'Partidos', 'Competición', 'Asistencia', 'Ajustes']) {
      expect(within(navigation).getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(within(navigation).queryByRole('button', { name: 'Temporadas' })).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('button', { name: 'Equipo' })).not.toBeInTheDocument()
  })

  test('gives coaches every sports area but not settings', () => {
    const { navigation } = renderLayout(makeProfile({ is_coach: true }))
    expect(within(navigation).getByRole('button', { name: 'Tareas' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: 'Partidos' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: 'Competición' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: 'Resumen' })).toBeInTheDocument()
    expect(within(navigation).getByRole('button', { name: 'Asistencia' })).toBeInTheDocument()
    expect(within(navigation).queryByRole('button', { name: 'Ajustes' })).not.toBeInTheDocument()
  })

  test('limits Dirección to read-only team areas', () => {
    const { navigation } = renderLayout(makeProfile({ is_viewer: true, is_player: false }))
    for (const label of ['Inicio', 'Resumen', 'Partidos', 'Competición']) {
      expect(within(navigation).getByRole('button', { name: label })).toBeInTheDocument()
    }
    for (const label of ['Tareas', 'Asistencia', 'Ajustes']) {
      expect(within(navigation).queryByRole('button', { name: label })).not.toBeInTheDocument()
    }
  })

  test('keeps player navigation when Dirección is an additional role', () => {
    const { navigation } = renderLayout(makeProfile({ is_viewer: true }))

    for (const label of ['Inicio', 'Resumen', 'Tareas', 'Partidos', 'Competición']) {
      expect(within(navigation).getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(within(navigation).queryByRole('button', { name: 'Asistencia' })).not.toBeInTheDocument()
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

  test('allows approved active users to edit their display name', async () => {
    const user = userEvent.setup()
    const onUpdateDisplayName = vi.fn().mockResolvedValue(undefined)
    render(
      <AppLayout
        profile={makeProfile()}
        email="ana@example.com"
        view="home"
        message=""
        errorMessage=""
        onNavigate={vi.fn()}
        onSignOut={vi.fn()}
        onUpdateDisplayName={onUpdateDisplayName}
      ><p>Contenido</p></AppLayout>,
    )

    await user.click(screen.getAllByRole('button', { name: 'Editar mi nombre' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Editar mi nombre' })
    const input = within(dialog).getByLabelText('Nombre y apellidos')
    await user.clear(input)
    await user.type(input, 'María López')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar nombre' }))

    expect(onUpdateDisplayName).toHaveBeenCalledWith('María López')
  })

  test('does not offer name editing to inactive users', () => {
    render(
      <AppLayout
        profile={makeProfile({ is_active: false })}
        email="ana@example.com"
        view="home"
        message=""
        errorMessage=""
        onNavigate={vi.fn()}
        onSignOut={vi.fn()}
        onUpdateDisplayName={vi.fn()}
      ><p>Contenido</p></AppLayout>,
    )

    expect(screen.queryByRole('button', { name: 'Editar mi nombre' })).not.toBeInTheDocument()
  })

  test('opens an alert and navigates to its related screen', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onNotificationRead = vi.fn()
    render(
      <AppLayout
        profile={makeProfile()}
        email="ana@example.com"
        view="home"
        message=""
        errorMessage=""
        notifications={[{ id: 'notice-1', kind: 'task', title: 'Nueva tarea publicada', text: 'Velocidad', view: 'tasks', occurredAt: '2026-08-07T10:00:00.000Z' }]}
        notificationUnreadCount={1}
        onNavigate={onNavigate}
        onNotificationRead={onNotificationRead}
        onSignOut={vi.fn()}
      ><p>Contenido</p></AppLayout>,
    )
    await user.click(screen.getAllByRole('button', { name: 'Avisos, 1 sin leer' })[0])
    await user.click(screen.getByRole('button', { name: /Nueva tarea publicada/ }))
    expect(onNotificationRead).toHaveBeenCalledWith(expect.objectContaining({ id: 'notice-1' }))
    expect(onNavigate).toHaveBeenCalledWith('tasks')
  })
})
