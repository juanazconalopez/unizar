import { describe, expect, test } from 'vitest'
import { activeMembershipFor, activePlayers, membershipCoversDate, membershipOverlapsSeasonRange, resultsByTask, seasonForDate } from './selectors'
import { makeMembership, makeProfile, makeResult, makeSeason } from '../test/fixtures'

describe('domain selectors', () => {
  test('uses the player permission independently from staff roles', () => {
    expect(activePlayers([
      makeProfile(),
      makeProfile({ id: 'owner', is_owner: true, is_player: false }),
      makeProfile({ id: 'coach-only', is_coach: true, is_player: false }),
      makeProfile({ id: 'viewer-only', is_viewer: true, is_player: false }),
      makeProfile({ id: 'player-coach', is_coach: true }),
      makeProfile({ id: 'player-viewer', is_viewer: true }),
    ])).toHaveLength(3)
    const oldPeriod = makeMembership({ id: 'old', active_until: '2026-03-01' })
    const currentPeriod = makeMembership({ id: 'current', active_from: '2026-06-01' })
    expect(activeMembershipFor([oldPeriod, currentPeriod], 'season-1', 'player-1')).toEqual(currentPeriod)
    expect(membershipCoversDate(oldPeriod, '2026-02-01')).toBe(true)
    expect(membershipCoversDate(oldPeriod, '2026-04-01')).toBe(false)
  })

  test('groups results once per task', () => {
    const grouped = resultsByTask([makeResult(), makeResult({ player_id: 'player-2' })])
    expect(grouped.get('task-1')).toHaveLength(2)
  })

  test('clamps open membership periods to their season dates', () => {
    const membership = makeMembership({ active_from: '2026-01-01', active_until: null })
    const season = makeSeason({ start_date: '2026-01-01', end_date: '2026-06-30' })

    expect(membershipOverlapsSeasonRange(membership, season, '2026-06-01', '2026-06-30')).toBe(true)
    expect(membershipOverlapsSeasonRange(membership, season, '2026-07-01', '2026-07-31')).toBe(false)
    expect(membershipOverlapsSeasonRange(membership, undefined, '2026-06-01', '2026-06-30')).toBe(false)
  })

  test('finds the only season that contains a date', () => {
    const previous = makeSeason({ id: 'previous', start_date: '2025-07-01', end_date: '2026-06-30' })
    const active = makeSeason({ id: 'active', start_date: '2026-07-01', end_date: '2027-06-30' })

    expect(seasonForDate([previous, active], '2026-08-14')).toEqual(active)
    expect(seasonForDate([previous, active], '2027-07-01')).toBeUndefined()
  })
})
