import { describe, expect, test } from 'vitest'
import { navigationFromLocation, urlForNavigation } from './navigation'

describe('contextual navigation', () => {
  test('reads a valid view, date and announcement from the URL', () => {
    expect(navigationFromLocation({ search: '?view=tasks&date=2026-08-20&announcement=notice-1' } as Location)).toEqual({
      view: 'tasks', date: '2026-08-20', announcementId: 'notice-1',
    })
  })

  test('rejects unknown views and malformed dates', () => {
    expect(navigationFromLocation({ search: '?view=unknown&date=20-08-2026' } as Location)).toEqual({ view: 'home' })
  })

  test('creates shareable contextual URLs', () => {
    expect(urlForNavigation({ view: 'matches', date: '2026-09-12' })).toContain('?view=matches&date=2026-09-12')
  })

  test('accepts the unified staff calendar route', () => {
    expect(navigationFromLocation({ search: '?view=calendar&date=2026-09-12' } as Location)).toEqual({
      view: 'calendar', date: '2026-09-12',
    })
  })

  test('accepts the private training plans route', () => {
    expect(navigationFromLocation({ search: '?view=training' } as Location)).toEqual({ view: 'training' })
  })

  test('keeps the selected training plan in a shareable URL', () => {
    expect(navigationFromLocation({ search: '?view=training&training=plan-1' } as Location)).toEqual({
      view: 'training', trainingPlanId: 'plan-1',
    })
    expect(urlForNavigation({ view: 'training', trainingPlanId: 'plan-1' })).toContain('?view=training&training=plan-1')
  })
})
