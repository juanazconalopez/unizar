import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

import { fetchActiveSeasonBirthdays, fetchPlayerCalendarBirthdays, fetchTodayBirthdays, invalidateBirthdayCache } from './birthdayService'

describe('birthday cache', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
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

    await fetchActiveSeasonBirthdays('season-1', '2026-08-31')
    await fetchActiveSeasonBirthdays('season-1', '2026-09-01')
    invalidateBirthdayCache()
    await fetchActiveSeasonBirthdays('season-1', '2026-09-01')

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
})
