import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { CompetitionView } from './CompetitionView'
import type { CompetitionFixture, CompetitionPlayerStat, CompetitionSeason, CompetitionStanding } from '../../types'

const seasons: CompetitionSeason[] = [{ id: '25-26', name: '2025–26', startsOn: '2025-09-01', sourceLabel: 'MatchReady', updatedAt: '2026-04-11T18:00:00Z' }]
const fixtures: CompetitionFixture[] = [{ id: 'm1', competitionSeasonId: '25-26', round: 'Final', roundOrder: 7, matchDate: '2026-04-11', kickoffTime: '14:00', homeTeam: 'Unizar Femenino', awayTeam: 'Fénix C.R.', homeScore: 51, awayScore: 0, status: 'final' }]
const standings: CompetitionStanding[] = [{ competitionSeasonId: '25-26', position: 1, team: 'Unizar Femenino', played: 7, won: 6, drawn: 1, lost: 0, pointsFor: 299, pointsAgainst: 25, difference: 274, offensiveBonus: 6, defensiveBonus: 0, points: 32 }]
const playerStats: CompetitionPlayerStat[] = [{ competitionSeasonId: '25-26', player: 'Irati Tejero', team: 'Unizar Femenino', points: 40, tries: 8, conversions: 0, penalties: 0, drops: 0, yellowCards: 0, redCards: 0 }]

describe('CompetitionView', () => {
  test('selects the most recent season regardless of input order', async () => {
    const user = userEvent.setup()
    const unorderedSeasons = [seasons[0], { ...seasons[0], id: '26-27', name: '2026–27', startsOn: '2026-09-01' }]
    render(<CompetitionView fixtures={fixtures} playerStats={playerStats} seasons={unorderedSeasons} standings={standings} />)
    expect(screen.getByRole('combobox', { name: 'Temporada' })).toHaveValue('26-27')
    expect(screen.getByRole('heading', { name: 'Competición' })).toBeInTheDocument()
    const tabs = screen.getByRole('navigation', { name: 'Secciones de competición' })
    for (const label of ['Resultados', 'Clasificación', 'Estadísticas']) expect(within(tabs).getByRole('button', { name: label })).toBeInTheDocument()
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Temporada' }), '25-26')
    expect(screen.getByText('Final')).toBeInTheDocument()
    expect(screen.getByText('51')).toBeInTheDocument()
    expect(screen.getAllByAltText('Escudo de Unizar Femenino').length).toBeGreaterThan(0)
  })

  test('shows the league table and sortable statistic views', async () => {
    const user = userEvent.setup()
    render(<CompetitionView fixtures={fixtures} playerStats={playerStats} seasons={seasons} standings={standings} />)
    await user.click(screen.getByRole('button', { name: 'Clasificación' }))
    expect(screen.getByRole('table')).toHaveTextContent('Unizar Femenino')
    expect(screen.getByRole('table')).toHaveTextContent('32')
    await user.click(screen.getByRole('button', { name: 'Estadísticas' }))
    expect(screen.getByText('Irati Tejero')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ensayos' }))
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  test('makes the missing production feed explicit', () => {
    render(<CompetitionView fixtures={[]} playerStats={[]} seasons={[]} standings={[]} />)
    expect(screen.getByText('Competición pendiente de sincronización')).toBeInTheDocument()
  })

  test('allows the owner to start the first synchronization', async () => {
    const user = userEvent.setup()
    const onSync = vi.fn().mockResolvedValue(undefined)
    render(<CompetitionView fixtures={[]} isOwner onSync={onSync} playerStats={[]} seasons={[]} standings={[]} />)
    await user.click(screen.getByRole('button', { name: 'Sincronizar ahora' }))
    expect(onSync).toHaveBeenCalledOnce()
  })

  test('loads another historical season when it is selected', async () => {
    const user = userEvent.setup()
    const onSeasonChange = vi.fn().mockResolvedValue(undefined)
    const older = { ...seasons[0], id: '24-25', name: '2024–25', startsOn: '2024-07-01' }
    render(<CompetitionView fixtures={fixtures} onSeasonChange={onSeasonChange} playerStats={playerStats} seasons={[seasons[0], older]} standings={standings} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Temporada' }), '24-25')
    expect(onSeasonChange).toHaveBeenCalledWith('24-25')
  })
})
