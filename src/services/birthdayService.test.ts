import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

import { fetchActiveSeasonBirthdays, fetchPlayerCalendarBirthdays, fetchTodayBirthdays, invalidateBirthdayCache, setBirthdayCacheUser } from './birthdayService'

describe('birthday cache', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    setBirthdayCacheUser(null)
  })

  test('requests today birthdays only once per user and day', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ player_id: 'player-1', display_name: 'Ana Martín' }], error: null })

    const first = await fetchTodayBirthdays('viewer-1', '2026-08-31')
    const second = await fetchTodayBirthdays('viewer-1', '2026-08-31')

    expect(first).toEqual(second)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('get_today_active_player_birthdays')
  })

  test('refreshes the season calendar on a new day or after invalidation', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })

    await fetchActiveSeasonBirthdays('owner-1', 'season-1', '2026-08-31')
    await fetchActiveSeasonBirthdays('owner-1', 'season-1', '2026-09-01')
    invalidateBirthdayCache()
    await fetchActiveSeasonBirthdays('owner-1', 'season-1', '2026-09-01')

    expect(mocks.rpc).toHaveBeenCalledTimes(3)
  })

  test('caches the privacy-safe player calendar per user and season', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ season_id: 'season-1', player_id: 'player-2', display_name: 'Bea', birthday_on: '2026-09-03' }], error: null })

    const first = await fetchPlayerCalendarBirthdays('player-1', 'season-1', '2026-09-02')
    const second = await fetchPlayerCalendarBirthdays('player-1', 'season-1', '2026-09-02')

    expect(first).toEqual(second)
    expect(mocks.rpc).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith('get_player_season_birthday_calendar')
  })

  test('loads birthdays and invalidates safely when reads, writes and removals are blocked', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new DOMException('Bloqueado', 'SecurityError') })
    }
    await expect(fetchTodayBirthdays('player-1', '2026-09-02')).resolves.toEqual([])
    await expect(fetchPlayerCalendarBirthdays('player-1', 'season-1', '2026-09-02')).resolves.toEqual([])
    expect(() => invalidateBirthdayCache()).not.toThrow()
  })

  test('separates the calendar with ages by account and removes old accounts on login and logout', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ display_name: 'Ana', age: 24 }], error: null })
    localStorage.setItem('unizar:birthdays:season:season-1', 'legacy ages')
    localStorage.setItem('session', 'keep')
    setBirthdayCacheUser('owner-1')
    await fetchActiveSeasonBirthdays('owner-1', 'season-1', '2026-09-01')
    await fetchActiveSeasonBirthdays('owner-2', 'season-1', '2026-09-01')
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem('unizar:birthdays:season:season-1')).toBeNull()

    setBirthdayCacheUser('owner-2')
    expect(localStorage.getItem('unizar:birthdays:user:owner-1:season:season-1')).toBeNull()
    await fetchActiveSeasonBirthdays('owner-2', 'season-1', '2026-09-01')
    expect(mocks.rpc).toHaveBeenCalledTimes(2)
    setBirthdayCacheUser(null)
    expect(localStorage.getItem('unizar:birthdays:user:owner-2:season:season-1')).toBeNull()
    expect(localStorage.getItem('session')).toBe('keep')
  })

  test('does not recreate private cache entries when an old request finishes after signout', async () => {
    let finish!: (value: unknown) => void
    mocks.rpc.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    setBirthdayCacheUser('owner-1')
    const request = fetchActiveSeasonBirthdays('owner-1', 'season-1', '2026-09-01')
    setBirthdayCacheUser(null)
    finish({ data: [{ display_name: 'Ana', age: 24 }], error: null })
    await request
    expect(localStorage.getItem('unizar:birthdays:user:owner-1:season:season-1')).toBeNull()
  })
})
