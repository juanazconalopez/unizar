import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), invoke: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from, functions: { invoke: mocks.invoke } },
}))

import { fetchCompetitionSeasonData, fetchCompetitionSeasons, syncCompetition } from './competitionService'

function queryResult(data: unknown[]) {
  const order = vi.fn().mockResolvedValue({ data, error: null })
  return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order })), order })) }
}

describe('competitionService', () => {
  beforeEach(() => vi.clearAllMocks())

  test('maps persisted competition snapshots to the application model', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'competition_seasons') return queryResult([{
        id: '2025-26', name: 'Temporada 2025/2026', starts_on: '2025-09-01',
        source_label: 'MatchReady', synced_at: '2026-04-12T10:00:00Z',
      }])
      if (table === 'competition_fixtures') return queryResult([{
        id: 'fixture-1', competition_season_id: '2025-26', round: 'Final', round_order: 7,
        match_date: '2026-04-11', kickoff_time: '14:00:00', home_team: 'CDU Rugby', away_team: 'Fénix',
        home_score: 51, away_score: 0, status: 'final', source_match_id: '123',
      }])
      if (table === 'competition_standings') return queryResult([{
        competition_season_id: '2025-26', position: 1, team: 'CDU Rugby', played: 7,
        won: 6, drawn: 1, lost: 0, points_for: 299, points_against: 25, difference: 274,
        offensive_bonus: 6, defensive_bonus: 0, points: 32,
      }])
      return queryResult([{
        competition_season_id: '2025-26', player: 'Ana Martín', team: 'CDU Rugby',
        points: 40, tries: 8, conversions: 0, penalties: 0, drops: 0, yellow_cards: 0, red_cards: 0,
      }])
    })

    await expect(fetchCompetitionSeasons()).resolves.toEqual([expect.objectContaining({
      id: '2025-26', name: 'Temporada 2025/2026', startsOn: '2025-09-01', updatedAt: '2026-04-12T10:00:00Z',
    })])
    const data = await fetchCompetitionSeasonData('2025-26')
    expect(data.fixtures[0]).toEqual(expect.objectContaining({ status: 'final', homeScore: 51 }))
    expect(data.standings[0]).toEqual(expect.objectContaining({ position: 1, offensiveBonus: 6 }))
    expect(data.playerStats[0]).toEqual(expect.objectContaining({ player: 'Ana Martín', tries: 8 }))
  })

  test('rejects unknown fixture states instead of displaying corrupt data', async () => {
    mocks.from.mockImplementation((table: string) => table === 'competition_fixtures'
      ? queryResult([{
        id: 'fixture-1', competition_season_id: '2025-26', round: 'Final', round_order: 7,
        match_date: '2026-04-11', kickoff_time: null, home_team: 'CDU', away_team: 'Fénix',
        home_score: null, away_score: null, status: 'unknown', source_match_id: null,
      }])
      : queryResult([]))

    await expect(fetchCompetitionSeasonData('2025-26')).rejects.toThrow('Estado de partido')
  })

  test('surfaces the detailed Edge Function error', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'MatchReady no ha devuelto una clasificación reconocible.' })) },
    })

    await expect(syncCompetition()).rejects.toThrow('MatchReady no ha devuelto una clasificación reconocible.')
  })
})
