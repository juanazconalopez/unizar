import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchNotificationFeed } from '../services/notificationsService'
import { makeAnnouncement, makeProfile, makeProfilePrivateDetails } from '../test/fixtures'
import { NOTIFICATION_REFRESH_INTERVAL_MS, useNotifications } from './useNotifications'

vi.mock('../services/notificationsService', () => ({ fetchNotificationFeed: vi.fn() }))

describe('useNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T10:00:00Z'))
    localStorage.clear()
    vi.mocked(fetchNotificationFeed).mockReset()
    vi.mocked(fetchNotificationFeed).mockResolvedValue({
      tasks: [], results: [], memberships: [], matches: [], availability: [], lineups: [],
      announcements: [makeAnnouncement({ updated_at: '2026-08-12T08:00:00.000Z' })],
    })
  })

  afterEach(() => vi.useRealTimers())

  async function loadInitialFeed() {
    await act(async () => {
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })
  }

  test('removes a read notification from the list and keeps it hidden on this device', async () => {
    const profile = makeProfile()
    const first = renderHook(() => useNotifications(profile, profile.id))
    await loadInitialFeed()
    expect(first.result.current.notifications).toHaveLength(1)

    act(() => first.result.current.markRead(first.result.current.notifications[0]))
    expect(first.result.current.notifications).toHaveLength(0)
    expect(first.result.current.unreadCount).toBe(0)
    first.unmount()

    const reopened = renderHook(() => useNotifications(profile, profile.id))
    await loadInitialFeed()
    expect(reopened.result.current.notifications).toHaveLength(0)
  })

  test('does not repeat notification queries on every focus event', async () => {
    const profile = makeProfile()
    renderHook(() => useNotifications(profile, profile.id))
    await loadInitialFeed()

    act(() => window.dispatchEvent(new Event('focus')))
    expect(fetchNotificationFeed).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(NOTIFICATION_REFRESH_INTERVAL_MS)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await Promise.resolve()
    })
    expect(fetchNotificationFeed).toHaveBeenCalledTimes(2)
  })

  test('requests team availability for coaches', async () => {
    const profile = makeProfile({ is_player: false, is_coach: true })
    renderHook(() => useNotifications(profile, profile.id))
    await loadInitialFeed()

    expect(fetchNotificationFeed).toHaveBeenCalledWith(profile.id, true)
  })

  test('does not clear the profile reminder until the details are complete', async () => {
    const profile = makeProfile()
    const details = makeProfilePrivateDetails({ phone: null, birth_date: null })
    const reminder = renderHook(() => useNotifications(profile, profile.id, details))
    await loadInitialFeed()

    expect(reminder.result.current.notifications.some((item) => item.kind === 'profile')).toBe(true)
    act(() => reminder.result.current.markAllRead())
    expect(reminder.result.current.notifications).toHaveLength(1)
    expect(reminder.result.current.notifications[0].kind).toBe('profile')
  })
})
