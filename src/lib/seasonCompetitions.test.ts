import { describe, expect, test } from 'vitest'
import type { Match } from '../types'
import { compareMatches, matchColor } from './seasonCompetitions'

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1', season_id: 'season-1', competition_id: 'competition-1', opponent: 'Rival', match_date: '2026-09-20', kickoff_time: '12:00:00', venue: null,
    is_home: true, notes: null, status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: false,
    created_by: 'owner-1', created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z', seasons: { name: '2026' },
    season_competitions: { id: 'competition-1', name: 'Liga Aragonesa', color: 'purple', is_default: true }, ...overrides,
  }
}

describe('season competition match presentation', () => {
  test('uses the competition color for official matches and green for drafts and friendlies', () => {
    expect(matchColor(match()).solid).toBe('#7459ae')
    expect(matchColor(match({ status: 'draft' })).solid).toBe('#2d7653')
    expect(matchColor(match({ match_kind: 'friendly', competition_id: null, season_competitions: null })).solid).toBe('#2d7653')
  })

  test('orders the default competition before other competitions regardless of kickoff time', () => {
    const cup = match({ id: 'cup', kickoff_time: '10:00:00', season_competitions: { id: 'cup', name: 'Copa Aragón', color: 'orange', is_default: false } })
    const league = match({ id: 'league', kickoff_time: '18:00:00', status: 'draft' })
    expect([cup, league].sort(compareMatches).map((item) => item.id)).toEqual(['league', 'cup'])
  })
})
