import { expect, test } from 'vitest'
import { makeMatch } from '../test/fixtures'
import type { Match, MatchLineup } from '../types'
import { crossTeamCallupOverlap, crossTeamCallupReference, crossTeamCallupRestriction } from './crossTeamCallups'

const target = makeMatch({ id: 'b-next', team_id: 'b', competition_id: 'league', match_date: '2026-10-18' })
const previous = makeMatch({ id: 'a-last', team_id: 'a', competition_id: 'league', match_date: '2026-10-11', status: 'completed', report_events_reviewed: true, lineup_published: true })
const lineups: MatchLineup[] = Array.from({ length: 10 }, (_, index) => ({ match_id: previous.id, player_id: `p-${index}`, slot_number: index + 1, role: index === 9 ? 'substitute' : 'starter', position: null, sort_order: index + 1, updated_at: '2026-10-11T12:00:00Z' }))

test('allows seven shared players and blocks eight, including non-playing substitutes', () => {
  const reference = crossTeamCallupReference(target, [previous], lineups, true)
  expect(crossTeamCallupRestriction(reference, ['p-0', 'p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-9'])).toBeNull()
  expect(crossTeamCallupRestriction(reference, ['p-0', 'p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-9'])).toContain('Hay 8')
  expect(crossTeamCallupOverlap(reference, ['p-9', 'p-9', 'other'])).toEqual(['p-9'])
})

test('uses the last other-team fixture in the same competition and season, excluding cancelled, draft and future fixtures', () => {
  const ignored: Match[] = [
    { ...previous, id: 'cup', match_date: '2026-10-17', competition_id: 'cup' },
    { ...previous, id: 'season-old', match_date: '2026-10-17', season_id: 'old' },
    { ...previous, id: 'own', match_date: '2026-10-17', team_id: 'b' },
    { ...previous, id: 'cancelled', match_date: '2026-10-17', status: 'cancelled' },
    { ...previous, id: 'draft', match_date: '2026-10-17', status: 'draft' },
    { ...previous, id: 'future', match_date: '2026-10-19' },
  ]
  expect(crossTeamCallupReference(target, [...ignored, previous], lineups, true).matchId).toBe(previous.id)
})

test('waits for the latest acta instead of silently using an older confirmed acta', () => {
  const unconfirmed = { ...previous, id: 'a-pending', match_date: '2026-10-17', status: 'published' as const, report_events_reviewed: false }
  const reference = crossTeamCallupReference(target, [previous, unconfirmed], lineups, true)
  expect(reference.matchId).toBe('a-pending')
  expect(crossTeamCallupRestriction(reference, [])).toContain('Confirma el acta')
})

test('keeps an unpublished other-team draft private while blocking publication', () => {
  const reference = crossTeamCallupReference(target, [{ ...previous, lineup_published: false, report_events_reviewed: false }], lineups, true)
  expect(reference.playerIds).toEqual([])
  expect(crossTeamCallupRestriction(reference, [])).toContain('Confirma el acta')
})

test('does not impose a limit on friendlies, disabled competitions, or the first other-team fixture', () => {
  for (const reference of [
    crossTeamCallupReference({ ...target, match_kind: 'friendly' }, [previous], lineups, true),
    crossTeamCallupReference({ ...target, status: 'completed' }, [previous], lineups, true),
    crossTeamCallupReference(target, [previous], lineups, false),
    crossTeamCallupReference(target, [], lineups, true),
  ]) expect(crossTeamCallupRestriction(reference, lineups.map((entry) => entry.player_id))).toBeNull()
})

test('applies reciprocally on the next A fixture and uses the same B acta for consecutive A fixtures', () => {
  const b = { ...previous, id: 'b-last', team_id: 'b' }
  for (const match_date of ['2026-10-18', '2026-10-25']) {
    expect(crossTeamCallupReference({ ...target, team_id: 'a', match_date }, [previous, b], [], true).matchId).toBe('b-last')
  }
})

test('excludes the paired derby fixture from the previous acta comparison', () => {
  const derby = { ...target, internal_fixture_id: 'derby', kickoff_time: '12:00:00' }
  const paired = { ...previous, id: 'paired', match_date: derby.match_date, kickoff_time: '11:00:00', internal_fixture_id: 'derby' }
  expect(crossTeamCallupReference(derby, [paired, previous], lineups, true).matchId).toBe(previous.id)
})
