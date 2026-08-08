import { render, screen, within } from '@testing-library/react'
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
    expect(within(navigation).queryByRole('button', { name: 'Resumen' })).not.toBeInTheDocument()
    expect(within(navigation).queryByRole('button', { name: 'Equipo' })).not.toBeInTheDocument()

    await user.click(within(navigation).getByRole('button', { name: 'Tareas' }))
    expect(onNavigate).toHaveBeenCalledWith('tasks')
  })

  test('shows every management area to owners', () => {
    const { navigation } = renderLayout(makeProfile({ is_owner: true, is_collaborator: true }))

    for (const label of ['Inicio', 'Resumen', 'Tareas', 'Asistencia', 'Temporadas', 'Equipo']) {
      expect(within(navigation).getByRole('button', { name: label })).toBeInTheDocument()
    }
  })
})
