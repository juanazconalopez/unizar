import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { makeSeason } from '../../test/fixtures'
import type { SeasonCallupReport } from '../../types'
import { SeasonAttendanceReport } from './SeasonAttendanceReport'

const report: SeasonCallupReport = {
  seasonId: 'season-1', seasonName: 'Temporada 2026', generatedOn: '2026-08-27',
  totals: { officialMatches: 0, friendlyMatches: 0, trainingSessions: 34 },
  players: [
    { playerId: 'maria', name: 'María López', officialCallups: 0, friendlyCallups: 0, starterCallups: 0, substituteCallups: 0, eligibleMatches: 0, availabilityResponded: 0, availabilityPercentage: null, attendedSessions: 28, eligibleSessions: 33, attendancePercentage: 85 },
    { playerId: 'luisa', name: 'Luisa', officialCallups: 0, friendlyCallups: 0, starterCallups: 0, substituteCallups: 0, eligibleMatches: 0, availabilityResponded: 0, availabilityPercentage: null, attendedSessions: 34, eligibleSessions: 34, attendancePercentage: 100 },
  ],
}

describe('SeasonAttendanceReport', () => {
  test('shows the team average card and opens a descending, searchable attendance ranking', async () => {
    const user = userEvent.setup()
    const onLoad = vi.fn().mockResolvedValue(report)
    render(<SeasonAttendanceReport onLoad={onLoad} season={makeSeason()} />)

    expect(await screen.findByText('93%')).toBeInTheDocument()
    expect(onLoad).toHaveBeenCalledWith('season-1')
    await user.click(screen.getByRole('button', { name: /Ver asistencia acumulada/ }))

    const dialog = screen.getByRole('dialog', { name: 'Asistencia acumulada' })
    const table = within(dialog).getByRole('table')
    expect(within(table).getByRole('row', { name: 'María López 28 33 85%' })).toBeInTheDocument()
    const rows = within(table).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Luisa')
    expect(rows[2]).toHaveTextContent('María López')
    expect(within(dialog).getByText('2 de 2 jugadoras')).toBeInTheDocument()

    await user.type(within(dialog).getByRole('searchbox', { name: 'Buscar jugadora por nombre' }), 'maria')
    expect(within(dialog).getByText('María López')).toBeInTheDocument()
    expect(within(dialog).queryByText('Luisa')).not.toBeInTheDocument()
    expect(within(dialog).getByText('1 de 2 jugadoras')).toBeInTheDocument()
  })
})
