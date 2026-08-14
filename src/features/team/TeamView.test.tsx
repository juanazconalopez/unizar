import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { makeProfile } from '../../test/fixtures'
import { TeamView } from './TeamView'

describe('TeamView', () => {
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
