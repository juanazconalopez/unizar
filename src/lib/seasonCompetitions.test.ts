import { describe, expect, test } from 'vitest'
import type { Match } from '../types'
import { compareMatches, matchColor, matchLegendItems, nextSeasonTeamColor } from './seasonCompetitions'

function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1', season_id: 'season-1', competition_id: 'competition-1', opponent: 'Rival', match_date: '2026-09-20', kickoff_time: '12:00:00', venue: null, callup_time: null, callup_venue: null,
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

  test.each(['published', 'draft', 'completed'] as const)('uses the assigned team color for %s matches, including friendlies', (status) => {
    const team = { id: 'team-b', name: 'Unizar B', color: 'green', is_mixed: false, is_default: false }
    expect(matchColor(match({ status, team_id: team.id, season_teams: team })).solid).toBe('#2d7653')
    expect(matchColor(match({ status, team_id: team.id, season_teams: { ...team, color: 'blue' }, match_kind: 'friendly' })).solid).toBe('#397b9f')
  })

  test('changes color when an existing match is reassigned from A to B', () => {
    const original = match({ team_id: 'a', season_teams: { id: 'a', name: 'Unizar A', color: 'purple', is_mixed: false, is_default: true } })
    const moved = { ...original, team_id: 'b', season_teams: { ...original.season_teams!, id: 'b', name: 'Unizar B', color: 'green' } }
    expect(matchColor(original).solid).toBe('#7459ae')
    expect(matchColor(moved).solid).toBe('#2d7653')
    expect(moved.season_competitions).toEqual(original.season_competitions)
  })

  test('retains competition fallback for a missing or invalid team color', () => {
    for (const color of [undefined, 'invalid']) {
      expect(matchColor(match({ team_id: 'b', season_teams: { id: 'b', name: 'B', color, is_mixed: false, is_default: false } })).solid).toBe('#7459ae')
    }
  })

  test('explains colors by team without repeating the same team in the legend', () => {
    const team = { id: 'b', name: 'Unizar B', color: 'green', is_mixed: false, is_default: false }
    const official = match({ team_id: 'b', season_teams: team })
    expect(matchLegendItems([official, { ...official, id: 'friendly', match_kind: 'friendly' }, { ...official, id: 'cancelled', status: 'cancelled' }])).toEqual([
      { key: 'team:b', label: 'Unizar B', solid: '#2d7653' },
    ])
    expect(nextSeasonTeamColor([{ color: 'purple' }])).toBe('green')
  })
})
