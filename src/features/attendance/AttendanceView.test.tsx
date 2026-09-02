import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { todayIso } from '../../lib/dates'
import { makeAttendance, makeMembership, makeProfile, makeProvisionalAttendance, makeProvisionalPlayer, makeSeason, makeSession } from '../../test/fixtures'
import { AttendanceView } from './AttendanceView'

describe('AttendanceView', () => {
  test('shows only active players, restores attendance and saves changes', async () => {
    const user = userEvent.setup()
    const today = todayIso()
    const profiles = [
      makeProfile(),
      makeProfile({ id: 'player-2', display_name: 'María López' }),
      makeProfile({ id: 'inactive', display_name: 'Inactiva', is_active: false }),
      makeProfile({ id: 'pending', display_name: 'Pendiente', is_approved: false }),
      makeProfile({ id: 'archived', display_name: 'Archivada', is_archived: true }),
      makeProfile({ id: 'owner', display_name: 'Owner Excluida', is_owner: true }),
    ]
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <AttendanceView
        profiles={profiles}
        memberships={[
          makeMembership(),
          makeMembership({ id: 'membership-2', player_id: 'player-2' }),
        ]}
        sessions={[makeSession({ session_date: today })]}
        attendance={[makeAttendance({ training_sessions: { session_date: today } })]}
        seasons={[makeSeason({ start_date: '2026-01-01', end_date: '2026-12-31' })]}
        onSave={onSave}
      />,
    )

    const list = screen.getByText('JUGADORAS ACTIVAS').closest('section')!
    expect(within(list).getByText('Ana Martín')).toBeInTheDocument()
    expect(within(list).getByText('María López')).toBeInTheDocument()
    expect(screen.queryByText('Inactiva')).not.toBeInTheDocument()
    expect(screen.queryByText('Owner Excluida')).not.toBeInTheDocument()
    expect(within(list).getByRole('checkbox', { name: /Ana Martín/ })).toBeChecked()
    expect(screen.getByText(/Temporada:/)).toHaveTextContent('Temporada 2026')

    await user.click(within(list).getByRole('checkbox', { name: /María López/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))

    expect(onSave).toHaveBeenCalledWith(today, ['player-1', 'player-2'], ['player-1', 'player-2'], [])
    expect(screen.getByText('Asistencia guardada para esta fecha.')).toBeInTheDocument()
  })

  test('excludes memberships from another season but still allows invited attendees', () => {
    const today = todayIso()
    render(
      <AttendanceView
        profiles={[makeProfile()]}
        memberships={[makeMembership({ season_id: 'previous-season' })]}
        seasons={[makeSeason({ id: 'current-season', start_date: '2026-01-01', end_date: '2026-12-31' })]}
        sessions={[]}
        attendance={[]}
        onSave={vi.fn()}
      />,
    )

    expect(today).toMatch(/^2026-/)
    expect(screen.queryByText('Ana Martín')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir invitada' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar asistencia' })).toBeInTheDocument()
  })

  test('adds new and returning invited players and saves them as attendees', async () => {
    const user = userEvent.setup()
    const today = todayIso()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<AttendanceView
      attendance={[]}
      memberships={[makeMembership()]}
      profiles={[makeProfile()]}
      provisionalAttendance={[makeProvisionalAttendance({ training_sessions: { session_date: '2026-08-01' } })]}
      provisionalPlayers={[makeProvisionalPlayer()]}
      seasons={[makeSeason({ start_date: '2026-01-01', end_date: '2026-12-31' })]}
      sessions={[]}
      onSave={onSave}
    />)

    await user.click(screen.getByRole('checkbox', { name: /Ana Martín/ }))
    await user.click(screen.getByRole('button', { name: 'Añadir invitada' }))
    let dialog = screen.getByRole('dialog', { name: 'Añadir invitada' })
    await user.selectOptions(within(dialog).getByLabelText('Invitada anterior'), 'guest-1')
    await user.click(within(dialog).getByRole('button', { name: 'Añadir invitada' }))
    expect(screen.getByRole('region', { name: 'Invitadas: 1' })).toHaveTextContent('Laura Invitada')

    await user.click(screen.getByRole('button', { name: 'Añadir invitada' }))
    dialog = screen.getByRole('dialog', { name: 'Añadir invitada' })
    await user.type(within(dialog).getByLabelText('Nombre y apellidos'), '  Nuria   Prueba  ')
    await user.click(within(dialog).getByRole('button', { name: 'Añadir invitada' }))
    expect(screen.getByRole('region', { name: 'Invitadas: 2' })).toHaveTextContent('Nuria Prueba')
    expect(screen.getByText('1 del equipo · 2 invitadas').closest('.attendance-count')).toHaveTextContent('3')

    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))
    expect(onSave).toHaveBeenCalledWith(today, ['player-1'], ['player-1'], [
      { id: 'guest-1', displayName: 'Laura Invitada' },
      { displayName: 'Nuria Prueba' },
    ])
  })
})
