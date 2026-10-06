import { describe, expect, it } from 'vitest'
import { countNationalLeagueStarts, licenseAllowsTeam, lineupLicenseWarnings, matchAvailabilityRestriction, matchLicenseRestriction } from './playerLicenses'
import { makeMatch, makeMembership, makeProfile } from '../test/fixtures'
import type { MatchLineup, PlayerLicenseType } from '../types'

const competition = { id: 'competition-1', name: 'Liga nacional', color: 'blue', is_default: true, competition_level: 'national' as const, is_league: true }
const lineup: MatchLineup = { match_id: 'match-1', player_id: 'player-1', slot_number: 1, role: 'starter', position: null, sort_order: 1, updated_at: '2026-09-01T12:00:00Z' }

describe('fichas deportivas', () => {
  it.each(['none', 'training'] as PlayerLicenseType[])('%s permite convocatorias amistosas, pero no oficiales', (license_type) => {
    const membership = makeMembership({ license_type, season_team_id: null })
    expect(licenseAllowsTeam(license_type)).toBe(false)
    expect(matchLicenseRestriction(makeMatch(), [membership], 'player-1')).toMatch(/amistosos/)
    expect(matchLicenseRestriction(makeMatch({ match_kind: 'friendly' }), [membership], 'player-1')).toBeNull()
  })
  it.each(['none', 'training'] as PlayerLicenseType[])('%s no puede responder disponibilidad en oficiales ni amistosos', (license_type) => {
    const membership = makeMembership({ license_type, season_team_id: null })
    for (const match_kind of ['official', 'friendly'] as const) {
      expect(matchAvailabilityRestriction(makeMatch({ match_kind }), [membership], 'player-1')).toMatch(/consultar.*Regional o Nacional/)
    }
  })
  it.each(['regional', 'national'] as PlayerLicenseType[])('%s puede responder partidos de otro equipo, también amistosos', (license_type) => {
    const membership = makeMembership({ license_type, season_team_id: 'team-b' })
    for (const match_kind of ['official', 'friendly'] as const) {
      expect(matchAvailabilityRestriction(makeMatch({ match_kind, team_id: 'team-a' }), [membership], 'player-1')).toBeNull()
    }
  })
  it('la disponibilidad conserva los periodos, niveles y límite de titularidades', () => {
    expect(matchAvailabilityRestriction(makeMatch({ season_competitions: competition }), [makeMembership({ license_type: 'regional' })], 'player-1')).toMatch(/Nacional/)
    expect(matchAvailabilityRestriction(makeMatch(), [makeMembership({ license_type: 'national', national_starts: 6 })], 'player-1')).toMatch(/seis titularidades/)
    expect(matchAvailabilityRestriction(makeMatch({ match_kind: 'friendly' }), [], 'player-1')).toMatch(/vinculada/)
    expect(matchAvailabilityRestriction(makeMatch({ match_kind: 'friendly', match_date: '2026-10-01' }), [makeMembership({ active_until: '2026-09-30' })], 'player-1')).toMatch(/vinculada/)
  })
  it('la regional no permite nacionales y la nacional permite ambas antes de seis titularidades', () => {
    const national = makeMatch({ season_competitions: competition })
    expect(matchLicenseRestriction(national, [makeMembership({ license_type: 'regional' })], 'player-1')).toMatch(/Nacional/)
    expect(matchLicenseRestriction(national, [makeMembership({ license_type: 'national', national_starts: 5 })], 'player-1')).toBeNull()
    expect(matchLicenseRestriction(makeMatch(), [makeMembership({ license_type: 'national', national_starts: 5 })], 'player-1')).toBeNull()
  })
  it.each(['regional', 'national'] as PlayerLicenseType[])('seis titularidades bloquean regional incluso si el owner cambia a %s', (license_type) => {
    const membership = makeMembership({ license_type, national_starts: 6 })
    expect(matchLicenseRestriction(makeMatch(), [membership], 'player-1')).toMatch(/seis titularidades/)
    expect(matchLicenseRestriction(makeMatch({ match_kind: 'friendly' }), [membership], 'player-1')).toBeNull()
  })
  it('el límite no bloquea nacional ni se traslada a otra temporada', () => {
    expect(matchLicenseRestriction(makeMatch({ season_competitions: competition }), [makeMembership({ license_type: 'national', national_starts: 8 })], 'player-1')).toBeNull()
    const memberships = [makeMembership({ license_type: 'national', national_starts: 8 }), makeMembership({ season_id: 'season-2', license_type: 'regional', national_starts: 0 })]
    expect(matchLicenseRestriction(makeMatch({ season_id: 'season-2' }), memberships, 'player-1')).toBeNull()
  })
  it('respeta los periodos reales de vinculación también en amistosos', () => {
    expect(matchLicenseRestriction(makeMatch({ match_kind: 'friendly', match_date: '2026-10-01' }), [makeMembership({ active_until: '2026-09-30' })], 'player-1')).toMatch(/vinculada/)
  })
  it('solo cuenta titularidades de liga nacional completadas y revisadas, una por partido', () => {
    const base = makeMatch({ status: 'completed', report_events_reviewed: true, season_competitions: competition })
    const matches = [base,
      { ...base, id: 'cup', season_competitions: { ...competition, is_league: false } },
      { ...base, id: 'friendly', match_kind: 'friendly' as const },
      { ...base, id: 'regional', season_competitions: { ...competition, competition_level: 'regional' as const } },
      { ...base, id: 'draft', status: 'published' as const },
      { ...base, id: 'unreviewed', report_events_reviewed: false },
      { ...base, id: 'other-season', season_id: 'season-2' },
      { ...base, id: 'substitute' },
      { ...base, id: 'cancelled', status: 'cancelled' as const }]
    const entries = matches.map((match) => ({ ...lineup, match_id: match.id, role: match.id === 'substitute' ? 'substitute' as const : 'starter' as const }))
    expect(countNationalLeagueStarts(matches, [...entries, lineup], 'season-1', 'player-1')).toBe(1)
    expect(countNationalLeagueStarts(matches, entries, 'season-1', 'other-player')).toBe(0)
  })
  it('permite corregir resultados anteriores sin aplicarles una bajada de ficha posterior', () => {
    expect(matchLicenseRestriction(makeMatch({ status: 'completed' }), [makeMembership({ license_type: 'none' })], 'player-1')).toBeNull()
  })
  it('avisa de convocatorias futuras incompatibles sin alterar los partidos finalizados', () => {
    const memberships = [makeMembership({ license_type: 'training' })]
    expect(lineupLicenseWarnings(makeMatch({ status: 'published' }), [lineup], memberships, [makeProfile()])[0]).toContain('Ana Martín')
    expect(lineupLicenseWarnings(makeMatch({ status: 'completed' }), [lineup], memberships, [makeProfile()])).toEqual([])
  })
})
