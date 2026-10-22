import { expect, test } from 'vitest'
import { makeProfile } from '../test/fixtures'
import { navigationPreloadTargets, prepareNavigationQueue } from './navigationPreparation'
import { PERMISSIONS } from '../lib/permissions'

test('prepares all permitted sections without private staff sections for a player', () => {
  const ownerTargets = navigationPreloadTargets(makeProfile({ is_owner: true }), [])
  expect(ownerTargets).toEqual(expect.arrayContaining(['training', 'statistics', 'settings', 'library', 'work-groups', 'video-analysis', 'surveys']))
  expect(ownerTargets).not.toContain('player-preview')
  expect(navigationPreloadTargets(makeProfile(), [PERMISSIONS.calendar.personal, PERMISSIONS.library.view])).toEqual(['calendar', 'library'])
})

test('a slow preparation does not stall other sections, with at most two requests at a time', async () => {
  let release!: () => void
  const slow = new Promise<void>((resolve) => { release = resolve })
  const started: number[] = []
  let pending = 0, peak = 0
  const request = prepareNavigationQueue([1, 2, 3, 4], async (item) => {
    started.push(item); pending += 1; peak = Math.max(peak, pending)
    if (item === 1) await slow
    pending -= 1
  }, () => false)
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
  expect(started).toEqual([1, 2, 3, 4])
  expect(peak).toBe(2)
  release()
  await request
})
