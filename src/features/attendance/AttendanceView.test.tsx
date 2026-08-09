import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { todayIso } from '../../lib/dates'
import { makeAttendance, makeProfile, makeSession } from '../../test/fixtures'
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
        sessions={[makeSession({ session_date: today })]}
        attendance={[makeAttendance({ training_sessions: { session_date: today } })]}
        onSave={onSave}
      />,
    )

    const list = screen.getByText('JUGADORAS ACTIVAS').closest('section')!
    expect(within(list).getByText('Ana Martín')).toBeInTheDocument()
    expect(within(list).getByText('María López')).toBeInTheDocument()
    expect(screen.queryByText('Inactiva')).not.toBeInTheDocument()
    expect(screen.queryByText('Owner Excluida')).not.toBeInTheDocument()
    expect(within(list).getByRole('checkbox', { name: /Ana Martín/ })).toBeChecked()

    await user.click(within(list).getByRole('checkbox', { name: /María López/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))

    expect(onSave).toHaveBeenCalledWith(today, ['player-1', 'player-2'], ['player-1', 'player-2'])
  })
})
