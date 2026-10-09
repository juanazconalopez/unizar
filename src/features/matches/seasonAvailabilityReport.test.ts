import { describe, expect, test } from 'vitest'
import type { MatchAvailability, MatchLineup } from '../../types'
import { makeMatch, makeMembership, makeSeasonTeam } from '../../test/fixtures'
import { seasonAvailabilityReport } from './seasonAvailabilityReport'

const member = makeMembership({ season_team_id: 'team-a', license_type: 'regional' })
const match = (id: string, date = '2026-10-17', team = 'team-a') => makeMatch({ id, match_date: date, team_id: team, lineup_published: false })
const response = (id: string, overrides: Partial<MatchAvailability> = {}): MatchAvailability => ({
  match_id: id, player_id: member.player_id, status: 'available', comment: null, updated_at: '2026-10-01T10:00:00Z', ...overrides,
})
const entry = (id: string): MatchLineup => ({ match_id: id, player_id: member.player_id, role: 'substitute', slot_number: 16, sort_order: 16, position: null, updated_at: '2026-10-01T10:00:00Z' })
const report = (matches: ReturnType<typeof match>[], answers: MatchAvailability[] = [], entries: MatchLineup[] = [], membership = member, mixed = false) =>
  seasonAvailabilityReport(matches, answers, member.player_id, [membership], [makeSeasonTeam({ id: 'team-a', is_mixed: mixed })], entries)

describe('disponibilidad por equipo y fin de semana', () => {
  test('cuenta solo su equipo y no exige responder al otro, aunque lo haya respondido', () => {
    const a = match('a'), b = match('b', '2026-10-18', 'team-b')
    expect(report([a, b], [response(a.id), response(b.id)]).totals).toMatchObject({ eligibleMatches: 1, responded: 1, available: 1, percentage: 100 })
    expect(report([b], [response(b.id)]).totals).toMatchObject({ eligibleMatches: 0, responded: 0, percentage: null })
    expect(report([a, b], [response(b.id)]).totals).toMatchObject({ eligibleMatches: 1, responded: 0 })
  })

  test('un préstamo guardado sustituye al partido propio y conserva la respuesta específica de su fecha', () => {
    const a = match('a'), b = match('b', '2026-10-18', 'team-b')
    const result = report([a, b], [response(a.id), response(b.id, { status: 'unavailable' })], [entry(b.id)])
    expect(result.matches).toEqual([b])
    expect(result.totals).toMatchObject({ eligibleMatches: 1, available: 0, unavailable: 1, responded: 1 })
    expect(report([b], [response(b.id)], [entry(b.id)]).totals.eligibleMatches).toBe(1)
  })

  test('derbis: reutiliza la última respuesta de cualquiera de las fichas una sola vez', () => {
    const a = { ...match('a'), internal_fixture_id: 'derby' }, b = { ...match('b', a.match_date, 'team-b'), internal_fixture_id: 'derby', is_home: false }
    const result = report([a, b], [response(a.id), response(b.id, { status: 'doubt', updated_at: '2026-10-02T10:00:00Z' })])
    expect(result.matches).toEqual([a])
    expect(result.totals).toMatchObject({ eligibleMatches: 1, responded: 1, doubt: 1 })
    expect(report([a, b], [response(a.id)], [entry(b.id)]).matches).toEqual([b])
  })

  test('dos encuentros propios o del mixto el mismo fin de semana son una oportunidad', () => {
    const fri = match('fri', '2026-10-16'), sat = match('sat'), sun = match('sun', '2026-10-18', 'team-b')
    expect(report([fri, sat, sun], [response(sat.id), response(sun.id)], [], member, true).totals).toMatchObject({ eligibleMatches: 1, responded: 1 })
    expect(report([fri, sat], [response(sat.id)]).matches).toEqual([sat])
    expect(report([sun], [response(sun.id)], [], member, true).totals.eligibleMatches).toBe(1)
  })

  test('separa fines de semana, temporadas y días entre semana', () => {
    const matches = [match('sat'), match('next', '2026-10-24'), match('wed', '2026-10-14'), match('thu', '2026-10-15')]
    expect(report(matches).totals).toMatchObject({ eligibleMatches: 4, responded: 0 })
    expect(report([...matches, { ...match('other-season'), season_id: 'other' }]).totals.eligibleMatches).toBe(4)
  })

  test('cancelados, borradores y respuestas huérfanas no cuentan; reprogramar recalcula', () => {
    const a = match('a'), cancelled = { ...match('cancelled', '2026-10-24'), status: 'cancelled' as const }, draft = { ...match('draft', '2026-10-31'), status: 'draft' as const }
    expect(report([a, cancelled, draft], [response('deleted'), response(cancelled.id)]).totals).toMatchObject({ eligibleMatches: 1, responded: 0 })
    expect(report([], [response('deleted')]).totals).toMatchObject({ eligibleMatches: 0, percentage: null })
    expect(report([a, match('rescheduled', '2026-10-24')], [response(a.id)]).totals.eligibleMatches).toBe(2)
  })

  test('respeta vinculación y ficha; cambiar de equipo no reescribe el equipo de fechas anteriores', () => {
    const a = match('a'), b = match('b', '2026-10-24', 'team-b')
    const members = [{ ...member, active_until: '2026-10-18' }, { ...member, id: 'new', season_team_id: 'team-b', active_from: '2026-10-19' }]
    expect(seasonAvailabilityReport([a, b], [], member.player_id, members, [], []).totals.eligibleMatches).toBe(2)
    expect(report([a], [], [], { ...member, active_from: '2026-10-18' }).totals.eligibleMatches).toBe(0)
    expect(report([a], [], [], { ...member, license_type: 'training', season_team_id: null }).totals.eligibleMatches).toBe(0)
    const national = { ...a, season_competitions: { id: 'national', name: 'Nacional', color: 'green', is_default: false, competition_level: 'national' as const } }
    expect(report([national]).totals.eligibleMatches).toBe(0)
  })

  test('no utiliza respuestas de otra jugadora; no disponible y en duda cuentan como respuesta', () => {
    const a = match('a'), b = match('b', '2026-10-24'), c = match('c', '2026-10-31')
    expect(report([a, b, c], [response(a.id, { player_id: 'other' }), response(b.id, { status: 'doubt' }), response(c.id, { status: 'unavailable' })]).totals)
      .toMatchObject({ eligibleMatches: 3, responded: 2, doubt: 1, unavailable: 1, unanswered: 1, percentage: 67 })
  })
})
