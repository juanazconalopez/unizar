import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildNotifications } from '../features/notifications/notifications'
import type { AppNotification, NotificationFeedData } from '../features/notifications/notifications'
import { todayIso } from '../lib/dates'
import { canManageSport } from '../lib/permissions'
import { fetchNotificationFeed } from '../services/notificationsService'
import type { Profile, ProfilePrivateDetails } from '../types'

const EMPTY_FEED: NotificationFeedData = { tasks: [], results: [], memberships: [], matches: [], availability: [], lineups: [] }
export const NOTIFICATION_REFRESH_INTERVAL_MS = 5 * 60 * 1000

export function useNotifications(profile: Profile | null, userId?: string, profileDetails?: ProfilePrivateDetails | null) {
  const [feed, setFeed] = useState<NotificationFeedData>(EMPTY_FEED)
  const [readState, setReadState] = useState<{ userId?: string; ids: Set<string> }>(() => ({
    userId,
    ids: readNotificationIds(userId),
  }))
  const lastReloadAt = useRef(0)
  const inFlightReload = useRef<Promise<void> | null>(null)
  const readIds = readState.userId === userId ? readState.ids : readNotificationIds(userId)

  const loadFeed = useCallback(async (force = false) => {
    if (!userId || !profile?.is_approved || profile.is_archived) return
    if (!force && Date.now() - lastReloadAt.current < NOTIFICATION_REFRESH_INTERVAL_MS) return
    if (inFlightReload.current) return inFlightReload.current
    lastReloadAt.current = Date.now()
    const request = (async () => {
      try {
        setFeed(await fetchNotificationFeed(userId, canManageSport(profile)))
      } catch {
        // Notifications are supplementary and must never block the application.
      }
    })()
    inFlightReload.current = request
    try { await request } finally { if (inFlightReload.current === request) inFlightReload.current = null }
  }, [profile, userId])

  const reload = useCallback(() => loadFeed(true), [loadFeed])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFeed(), 0)
    return () => window.clearTimeout(timer)
  }, [loadFeed])

  useEffect(() => {
    if (!userId) return
    const refresh = () => { if (document.visibilityState === 'visible') void loadFeed() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [loadFeed, userId])

  const allNotifications = useMemo(
    () => profile ? buildNotifications(feed, profile, todayIso(), profileDetails) : [],
    [feed, profile, profileDetails],
  )
  const notifications = useMemo(
    () => allNotifications.filter((notification) => notification.persistent || !readIds.has(notification.id)),
    [allNotifications, readIds],
  )

  function markRead(notification: AppNotification) {
    if (notification.persistent) return
    persistReadIds(userId, new Set(readIds).add(notification.id), setReadState)
  }

  function markAllRead() {
    const next = new Set(readIds)
    allNotifications.filter((notification) => !notification.persistent).forEach((notification) => next.add(notification.id))
    persistReadIds(userId, next, setReadState)
  }

  return {
    notifications,
    unreadCount: notifications.length,
    readIds,
    markRead,
    markAllRead,
    reload,
  }
}

function notificationStorageKey(userId?: string) {
  return userId ? `cdu-notifications-read:${userId}` : ''
}

function readNotificationIds(userId?: string) {
  if (!userId) return new Set<string>()
  try {
    const value = JSON.parse(localStorage.getItem(notificationStorageKey(userId)) ?? '[]') as unknown
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

function persistReadIds(
  userId: string | undefined,
  ids: Set<string>,
  update: (state: { userId?: string; ids: Set<string> }) => void,
) {
  const trimmed = new Set([...ids].slice(-200))
  update({ userId, ids: trimmed })
  if (userId) localStorage.setItem(notificationStorageKey(userId), JSON.stringify([...trimmed]))
}
