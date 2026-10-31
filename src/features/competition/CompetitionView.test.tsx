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

  test('defaults to the latest synchronized season as data arrives and on reopening for players', async () => {
    const user = userEvent.setup()
    const props = { fixtures, playerStats, standings }
    const latest = { ...seasons[0], id: '26-27', name: '2026–27', startsOn: '2026-09-01' }
    const latestFixtures = [{ ...fixtures[0], id: 'latest-match', competitionSeasonId: latest.id, homeScore: 24, awayScore: 7 }]
    const { rerender, unmount } = render(<CompetitionView {...props} seasons={[]} />)
    rerender(<CompetitionView {...props} seasons={seasons} />)
    expect(screen.getByRole('combobox', { name: 'Temporada' })).toHaveValue('25-26')

    rerender(<CompetitionView {...props} fixtures={[...fixtures, ...latestFixtures]} seasons={[...seasons, latest]} />)
    expect(screen.getByRole('combobox', { name: 'Temporada' })).toHaveValue('26-27')
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.queryByText('51')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Temporada' }), '25-26')
    expect(screen.getByText('51')).toBeInTheDocument()
    rerender(<CompetitionView {...props} seasons={[latest, ...seasons]} />)
    expect(screen.getByRole('combobox', { name: 'Temporada' })).toHaveValue('25-26')

    unmount()
    render(<CompetitionView {...props} fixtures={[...fixtures, ...latestFixtures]} seasons={[...seasons, latest]} />)
    expect(screen.getByRole('combobox', { name: 'Temporada' })).toHaveValue('26-27')
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  test('places new rounds above earlier rounds while keeping matches ordered within each round', () => {
    const first = { ...fixtures[0], id: 'round-1', round: 'Jornada 1', roundOrder: 1, matchDate: '2026-01-10' }
    const secondEarly = { ...fixtures[0], id: 'round-2-early', round: 'Jornada 2', roundOrder: 2, matchDate: '2026-01-17', homeTeam: 'Equipo sábado' }
    const secondLate = { ...secondEarly, id: 'round-2-late', matchDate: '2026-01-18', homeTeam: 'Equipo domingo' }
    const props = { playerStats, standings, seasons }
    const { rerender } = render(<CompetitionView {...props} fixtures={[first]} />)
    rerender(<CompetitionView {...props} fixtures={[first, secondLate, secondEarly]} />)

    const rounds = document.querySelectorAll<HTMLElement>('.competition-round')
    expect([...rounds].map((round) => round.querySelector('.competition-section-heading > span')?.textContent)).toEqual(['Jornada 2', 'Jornada 1'])
    expect([...rounds[0].querySelectorAll('.competition-team:not(.away) strong')].map((team) => team.textContent)).toEqual(['Equipo sábado', 'Equipo domingo'])

    rerender(<CompetitionView {...props} fixtures={[first, fixtures[0], secondLate, secondEarly]} />)
    expect([...document.querySelectorAll('.competition-section-heading > span')].map((heading) => heading.textContent)).toEqual(['Final', 'Jornada 2', 'Jornada 1'])
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
