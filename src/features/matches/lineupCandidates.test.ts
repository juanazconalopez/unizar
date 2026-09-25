import { describe, expect, test } from 'vitest'
import { makeMembership, makeProfile, makeSeason } from '../../test/fixtures'
import { orderedLineupCandidates } from './lineupCandidates'

describe('orderedLineupCandidates', () => {
  test('prioritises the match team, then mixed, then groups the remaining teams', () => {
    const season = makeSeason()
    const own = makeProfile({ id: 'own', display_name: 'Zoe' })
    const mixed = makeProfile({ id: 'mixed', display_name: 'Ana' })
    const otherB = makeProfile({ id: 'other-b', display_name: 'Bea' })
    const otherA = makeProfile({ id: 'other-a', display_name: 'Celia' })
    const teams = [
      { id: 'own-team', season_id: season.id, name: 'Unizar A', is_mixed: false },
      { id: 'mixed-team', season_id: season.id, name: 'Mixto', is_mixed: true },
      { id: 'other-b-team', season_id: season.id, name: 'Unizar C', is_mixed: false },
      { id: 'other-a-team', season_id: season.id, name: 'Unizar B', is_mixed: false },
    ] as never
    const memberships = [
      makeMembership({ player_id: own.id, season_team_id: 'own-team' }),
      makeMembership({ id: 'mixed-member', player_id: mixed.id, season_team_id: 'mixed-team' }),
      makeMembership({ id: 'other-b-member', player_id: otherB.id, season_team_id: 'other-b-team' }),
      makeMembership({ id: 'other-a-member', player_id: otherA.id, season_team_id: 'other-a-team' }),
    ]
    expect(orderedLineupCandidates([otherB, mixed, otherA, own], memberships, teams, season.id, 'own-team').map((player) => player.id))
      .toEqual(['own', 'mixed', 'other-a', 'other-b'])
  })
})
