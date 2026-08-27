import { describe, expect, test } from 'vitest'
import { makeMembership, makeProfile, makeSeason } from '../test/fixtures'
import type { SeasonCallupReport } from '../types'
import { activePlayersXml, attendanceReportXml, currentSeasonPlayers } from './seasonExports'

describe('season exports', () => {
  test('exports only active players enrolled in the season on the requested date', () => {
    const season = makeSeason({ name: 'Temporada & 2026' })
    const active = makeProfile({ display_name: 'Inés & Ana' })
    const inactive = makeProfile({ id: 'inactive', display_name: 'Inactiva', is_active: false })
    const otherSeason = makeProfile({ id: 'other', display_name: 'Otra temporada' })
    const ended = makeProfile({ id: 'ended', display_name: 'Baja' })
    const players = currentSeasonPlayers(
      [active, inactive, otherSeason, ended],
      [
        makeMembership(),
        makeMembership({ id: 'inactive-membership', player_id: inactive.id }),
        makeMembership({ id: 'other-membership', player_id: otherSeason.id, season_id: 'season-2' }),
        makeMembership({ id: 'ended-membership', player_id: ended.id, active_until: '2026-05-31' }),
      ],
      season,
      '2026-08-27',
    )

    expect(players).toEqual([active])
    expect(activePlayersXml(season, players, '2026-08-27')).toContain('temporada="Temporada &amp; 2026"')
    expect(activePlayersXml(season, players, '2026-08-27')).toContain('nombre="Inés &amp; Ana"')
  })

  test('exports accumulated attendance for only the filtered players', () => {
    const report: SeasonCallupReport = {
      seasonId: 'season-1', seasonName: 'Temporada 2026', generatedOn: '2026-08-27',
      totals: { officialMatches: 0, friendlyMatches: 0, trainingSessions: 34 },
      players: [
        { playerId: 'ana', name: 'Ana', officialCallups: 0, friendlyCallups: 0, starterCallups: 0, substituteCallups: 0, eligibleMatches: 0, availabilityResponded: 0, availabilityPercentage: null, attendedSessions: 28, eligibleSessions: 33, attendancePercentage: 85 },
        { playerId: 'luisa', name: 'Luisa', officialCallups: 0, friendlyCallups: 0, starterCallups: 0, substituteCallups: 0, eligibleMatches: 0, availabilityResponded: 0, availabilityPercentage: null, attendedSessions: 34, eligibleSessions: 34, attendancePercentage: 100 },
      ],
    }

    const xml = attendanceReportXml(report, new Set(['ana']))
    expect(xml).toContain('entrenamientos="34" jugadoras="1"')
    expect(xml).toContain('nombre="Ana" asistencias="28" entrenamientos-computables="33" porcentaje="85"')
    expect(xml).not.toContain('Luisa')
  })
})
