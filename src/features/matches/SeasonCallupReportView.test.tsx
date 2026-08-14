import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { makeSeason } from '../../test/fixtures'
import type { PlayerSeasonSummary, SeasonCallupReport } from '../../types'
import { SeasonCallupReportView } from './SeasonCallupReportView'

const report: SeasonCallupReport = {
  seasonId: 'season-1', seasonName: 'Temporada 2026', generatedOn: '2026-08-14',
  totals: { officialMatches: 5, friendlyMatches: 3, trainingSessions: 34 },
  players: [
    { playerId: 'fina', name: 'Fina', officialCallups: 4, friendlyCallups: 2, starterCallups: 4, substituteCallups: 2, eligibleMatches: 9, availabilityResponded: 8, availabilityPercentage: 89, attendedSessions: 28, eligibleSessions: 33, attendancePercentage: 85 },
    { playerId: 'luisa', name: 'Luisa', officialCallups: 4, friendlyCallups: 1, starterCallups: 3, substituteCallups: 2, eligibleMatches: 9, availabilityResponded: 9, availabilityPercentage: 100, attendedSessions: 34, eligibleSessions: 34, attendancePercentage: 100 },
  ],
}

const playerSummary: PlayerSeasonSummary = {
  seasonId: 'season-1', seasonName: 'Temporada 2026', playerId: 'fina', playerName: 'Fina', generatedOn: '2026-08-14',
  callups: { official: 4, friendly: 2, starter: 4, substitute: 2 },
  availability: { eligibleMatches: 9, responded: 8, available: 6, doubt: 1, unavailable: 1, unanswered: 1, percentage: 89 },
  attendance: { attended: 28, eligibleSessions: 33, percentage: 85 },
  matches: [],
}

describe('SeasonCallupReportView', () => {
  test('shows fixed totals and the ordered player metrics', async () => {
    const onLoad = vi.fn().mockResolvedValue(report)
    render(<SeasonCallupReportView onLoad={onLoad} season={makeSeason()} />)

    const table = await screen.findByRole('table')
    expect(onLoad).toHaveBeenCalledWith('season-1')
    expect(within(table).getByRole('columnheader', { name: /Oficiales 5/ })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: /Amistosos 3/ })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: /Asistencia 34/ })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: /Fina 4 2 4 2 8\/989% 2885%/ })).toBeInTheDocument()
  })

  test('opens the complete summary for a player from her row', async () => {
    const user = userEvent.setup()
    const onLoadPlayer = vi.fn().mockResolvedValue(playerSummary)
    render(<SeasonCallupReportView onLoad={vi.fn().mockResolvedValue(report)} onLoadPlayer={onLoadPlayer} season={makeSeason()} />)

    await user.click(await screen.findByRole('button', { name: /Fina/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Fina' })
    expect(dialog).toHaveTextContent('8/9 respuestas')
    expect(dialog).toHaveTextContent('28/33 entrenamientos')
    expect(onLoadPlayer).toHaveBeenCalledWith('season-1', 'fina')
  })

  test('copies a tabular version to the clipboard', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<SeasonCallupReportView onLoad={vi.fn().mockResolvedValue(report)} season={makeSeason()} />)

    await user.click(await screen.findByRole('button', { name: 'Copiar tabla' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Nombre\tOficiales (5)'))
    expect(screen.getByRole('button', { name: 'Tabla copiada' })).toBeInTheDocument()
  })
})
