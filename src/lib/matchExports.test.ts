import { describe, expect, test } from 'vitest'
import { makeProfile } from '../test/fixtures'
import type { Match, MatchLineup, SeasonCallupReport } from '../types'
import { callupReportTsv, callupReportXml, lineupPlainText, lineupXml } from './matchExports'

const match: Match = {
  id: 'match-1', season_id: 'season-1', opponent: 'Rival & Compañía', match_date: '2026-08-20', kickoff_time: '12:00:00', venue: 'Campo <Norte>', is_home: true,
  notes: null, status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: true, created_by: 'owner-1', created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', seasons: { name: 'Temporada 2026/27' },
}
const entries: MatchLineup[] = [
  { match_id: 'match-1', player_id: 'player-2', role: 'starter', position: null, slot_number: 2, sort_order: 2, updated_at: '' },
  { match_id: 'match-1', player_id: 'player-1', role: 'starter', position: null, slot_number: 1, sort_order: 1, updated_at: '' },
]
const profiles = [makeProfile({ display_name: 'Inés & Ana' }), makeProfile({ id: 'player-2', display_name: 'Luisa' })]

const report: SeasonCallupReport = {
  seasonId: 'season-1', seasonName: '2026 & 2027', generatedOn: '2026-08-14',
  totals: { officialMatches: 5, friendlyMatches: 3, trainingSessions: 34 },
  players: [{ playerId: 'player-1', name: 'Inés & Ana', officialCallups: 4, friendlyCallups: 2, starterCallups: 4, substituteCallups: 2, eligibleMatches: 9, availabilityResponded: 8, availabilityPercentage: 89, attendedSessions: 28, eligibleSessions: 33, attendancePercentage: 85 }],
}

describe('match exports', () => {
  test('exports a numbered lineup as safe XML and readable text', () => {
    const xml = lineupXml(match, entries, profiles)
    expect(xml).toContain('rival="Rival &amp; Compañía"')
    expect(xml).toContain('campo="Campo &lt;Norte&gt;"')
    expect(xml.indexOf('dorsal="1"')).toBeLessThan(xml.indexOf('dorsal="2"'))
    expect(xml).toContain('nombre="Inés &amp; Ana"')

    const text = lineupPlainText(match, entries, profiles)
    expect(text).toContain('1. Inés & Ana\n2. Luisa')
  })

  test('exports report totals, percentages and tabular clipboard text', () => {
    expect(callupReportXml(report)).toContain('<totales oficiales="5" amistosos="3" entrenamientos="34" />')
    expect(callupReportXml(report)).toContain('nombre="Inés &amp; Ana"')
    expect(callupReportTsv(report)).toBe('Nombre\tOficiales (5)\tAmistosos (3)\tTitular\tSuplente\tDisponibilidad\tAsistencia (34)\nInés & Ana\t4\t2\t4\t2\t8/9 (89%)\t28 (85%)')
  })
})
