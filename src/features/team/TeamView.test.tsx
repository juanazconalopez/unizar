import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { makeProfile } from '../../test/fixtures'
import { TeamView } from './TeamView'

describe('TeamView', () => {
  test('opens an accent-insensitive name search and filters every account state', async () => {
    const user = userEvent.setup()
    render(<TeamView profiles={[
      makeProfile({ id: 'maria', display_name: 'María López' }),
      makeProfile({ id: 'clara', display_name: 'Clara Pérez' }),
      makeProfile({ id: 'archived', display_name: 'María Luisa', is_approved: false, is_active: false, is_archived: true }),
    ]} currentUserId="owner-1" onUpdate={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Buscar personas' }))
    const search = screen.getByRole('searchbox', { name: 'Buscar por nombre' })
    await user.type(search, 'maria')

    expect(screen.getByText('María López')).toBeInTheDocument()
    expect(screen.getByText('María Luisa')).toBeInTheDocument()
    expect(screen.queryByText('Clara Pérez')).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'sin coincidencias')
    expect(screen.getByText('No hay personas que coincidan con “sin coincidencias”.')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('searchbox', { name: 'Buscar por nombre' })).not.toBeInTheDocument()
  })

  test('warns only for identical or globally very similar pending names', () => {
    render(<TeamView profiles={[
      makeProfile({ id: 'registered', display_name: 'María López' }),
      makeProfile({ id: 'similar-pending', display_name: 'Maria Lopex', is_approved: false, is_active: false }),
      makeProfile({ id: 'martinez', display_name: 'Ana Martínez' }),
      makeProfile({ id: 'martin-pending', display_name: 'Ana Martín', is_approved: false, is_active: false }),
    ]} currentUserId="owner-1" onUpdate={vi.fn()} />)

    const similarRequest = screen.getByText('Maria Lopex').closest('article')!
    expect(within(similarRequest).getByText('Posible cuenta duplicada')).toBeInTheDocument()
    expect(similarRequest).toHaveTextContent('María López (miembro activo)')
    expect(within(screen.getByText('Ana Martín').closest('article')!).queryByText('Posible cuenta duplicada')).not.toBeInTheDocument()
  })

  test('approves pending profiles with active player permissions', async () => {
    const user = userEvent.setup()
    const pending = makeProfile({ id: 'pending', display_name: 'Nerea Ruiz', is_approved: false, is_active: false })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(<TeamView profiles={[makeProfile(), pending]} currentUserId="player-1" onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: 'Aprobar como jugadora' }))

    expect(onUpdate).toHaveBeenCalledWith({ ...pending, is_approved: true, is_active: true })
  })

  test('updates permissions and restores archived profiles', async () => {
    const user = userEvent.setup()
    const member = makeProfile({ id: 'member', display_name: 'María López' })
    const archived = makeProfile({ id: 'archived', display_name: 'Paula Romero', is_approved: false, is_active: false, is_archived: true })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(<TeamView profiles={[makeProfile(), member, archived]} currentUserId="player-1" onUpdate={onUpdate} />)

    const memberRow = screen.getByText('María López').closest('article')!
    await user.click(within(memberRow).getByRole('checkbox', { name: 'Entrenador' }))
    expect(onUpdate).toHaveBeenCalledWith({ ...member, is_coach: true })
    expect(within(memberRow).getByRole('checkbox', { name: 'Jugadora' })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Ver usuarios desautorizados (1)' }))
    await user.click(screen.getByRole('button', { name: 'Restaurar acceso' }))
    expect(onUpdate).toHaveBeenCalledWith({
      ...archived,
      is_archived: false,
      is_approved: true,
      is_active: false,
    })
  })
})
