import { describe, expect, test } from 'vitest'
import { makeMembership, makeTask } from '../test/fixtures'
import { canUserCompleteTask } from './tasks'

describe('canUserCompleteTask', () => {
  const task = makeTask()

  test('accepts memberships overlapping any day of the task week', () => {
    expect(canUserCompleteTask(task, [makeMembership({ active_from: '2026-08-09' })], 'player-1')).toBe(true)
    expect(canUserCompleteTask(task, [makeMembership({ active_until: '2026-08-03' })], 'player-1')).toBe(true)
  })

  test('rejects memberships outside the week, season or player', () => {
    expect(canUserCompleteTask(task, [makeMembership({ active_from: '2026-08-10' })], 'player-1')).toBe(false)
    expect(canUserCompleteTask(task, [makeMembership({ active_until: '2026-08-02' })], 'player-1')).toBe(false)
    expect(canUserCompleteTask(task, [makeMembership({ season_id: 'another-season' })], 'player-1')).toBe(false)
    expect(canUserCompleteTask(task, [makeMembership({ player_id: 'another-player' })], 'player-1')).toBe(false)
  })
})
