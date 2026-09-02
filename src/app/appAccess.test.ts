import { describe, expect, test } from 'vitest'
import { makeMembership, makeProfile, makeSeason } from '../test/fixtures'
import { canAccessView, hasWorkingSeason } from './appAccess'

describe('application access rules', () => {
  test('requires an active covered membership for a player season context', () => {
    const player = makeProfile()
    const season = makeSeason()
    expect(hasWorkingSeason(player, [season], [makeMembership()], player.id)).toBe(true)
    expect(hasWorkingSeason(player, [season], [], player.id)).toBe(false)
  })

  test('keeps manager routes centralized', () => {
    const owner = makeProfile({ is_owner: true, is_player: false })
    expect(canAccessView(owner, 'calendar')).toBe(true)
    expect(canAccessView(owner, 'tasks')).toBe(false)
    const player = makeProfile()
    expect(canAccessView(player, 'calendar')).toBe(true)
    expect(canAccessView(player, 'tasks')).toBe(false)
    expect(canAccessView(player, 'matches')).toBe(false)
    expect(canAccessView(player, 'settings')).toBe(false)
    expect(canAccessView(makeProfile({ is_player: false, is_viewer: true }), 'matches')).toBe(true)
  })
})
