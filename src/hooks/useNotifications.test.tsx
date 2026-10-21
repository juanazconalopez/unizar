import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchNotificationFeed } from '../services/notificationsService'
import { makeAnnouncement, makeProfile, makeProfilePrivateDetails } from '../test/fixtures'
import { NOTIFICATION_REFRESH_INTERVAL_MS, useNotifications } from './useNotifications'
import type { PermissionKey } from '../lib/permissions'

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

  test.each(['QuotaExceededError', 'SecurityError'])('keeps notifications usable when storage throws %s', async (name) => {
    const profile = makeProfile()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Almacenamiento no disponible', name) })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Almacenamiento no disponible', name) })
    const notifications = renderHook(() => useNotifications(profile, profile.id))
    await loadInitialFeed()

    act(() => notifications.result.current.markRead(notifications.result.current.notifications[0]))
    expect(notifications.result.current.unreadCount).toBe(0)
    act(() => notifications.result.current.markAllRead())
    expect(notifications.result.current.notifications).toHaveLength(0)
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

    expect(fetchNotificationFeed).toHaveBeenCalledWith(profile.id, true, false)
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

  test('hides the previous account immediately and reloads without inheriting its refresh delay', async () => {
    const first = makeProfile()
    const second = makeProfile({ id: 'player-2' })
    const { result, rerender } = renderHook(({ profile, userId }) => useNotifications(profile, userId), {
      initialProps: { profile: first, userId: first.id },
    })
    await loadInitialFeed()
    expect(result.current.notifications).toHaveLength(1)
    rerender({ profile: first, userId: second.id })
    expect(result.current.notifications).toEqual([])
    await loadInitialFeed()
    expect(fetchNotificationFeed).toHaveBeenCalledTimes(1)
    vi.mocked(fetchNotificationFeed).mockResolvedValue({ tasks: [], results: [], memberships: [], matches: [], availability: [], lineups: [] })
    rerender({ profile: second, userId: second.id })
    await loadInitialFeed()
    expect(fetchNotificationFeed).toHaveBeenCalledTimes(2)
    expect(result.current.notifications).toEqual([])
  })

  test('ignores a previous account request that finishes after the new feed', async () => {
    let finishOldFeed!: (value: Awaited<ReturnType<typeof fetchNotificationFeed>>) => void
    vi.mocked(fetchNotificationFeed).mockReturnValueOnce(new Promise((resolve) => { finishOldFeed = resolve }))
    const first = makeProfile()
    const second = makeProfile({ id: 'player-2' })
    const { result, rerender } = renderHook(({ profile }) => useNotifications(profile, profile.id), { initialProps: { profile: first } })
    await loadInitialFeed()
    rerender({ profile: second })
    await loadInitialFeed()
    expect(result.current.notifications).toHaveLength(1)
    await act(async () => finishOldFeed({ tasks: [], results: [], memberships: [], matches: [], availability: [], lineups: [] }))
    expect(result.current.notifications).toHaveLength(1)
  })

  test('removes notifications and cancels pending results when access is revoked', async () => {
    const profile = makeProfile()
    const { result, rerender } = renderHook(({ profile }) => useNotifications(profile, profile.id), { initialProps: { profile } })
    await loadInitialFeed()
    rerender({ profile: { ...profile, is_active: false } })
    expect(result.current.notifications).toEqual([])
    await loadInitialFeed()
    expect(fetchNotificationFeed).toHaveBeenCalledOnce()
  })

  test('invalidates the team feed when configurable permissions change without changing roles', async () => {
    const profile = makeProfile({ is_coach: true })
    const { result, rerender } = renderHook(({ permissions }: { permissions: PermissionKey[] }) => useNotifications(profile, profile.id, undefined, permissions), {
      initialProps: { permissions: ['calendar.view_manage', 'tasks.view_team'] },
    })
    await loadInitialFeed()
    expect(result.current.notifications).toHaveLength(1)
    expect(fetchNotificationFeed).toHaveBeenLastCalledWith(profile.id, true, false)
    rerender({ permissions: [] })
    expect(result.current.notifications).toEqual([])
    await loadInitialFeed()
    expect(fetchNotificationFeed).toHaveBeenLastCalledWith(profile.id, false, false)
    expect(result.current.notifications).toEqual([])
  })
})
