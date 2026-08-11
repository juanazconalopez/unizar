import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildNotifications } from '../features/notifications/notifications'
import type { AppNotification, NotificationFeedData } from '../features/notifications/notifications'
import { todayIso } from '../lib/dates'
import { fetchNotificationFeed } from '../services/notificationsService'
import type { Profile } from '../types'

const EMPTY_FEED: NotificationFeedData = { tasks: [], results: [], memberships: [], matches: [], availability: [], lineups: [] }

export function useNotifications(profile: Profile | null, userId?: string) {
  const [feed, setFeed] = useState<NotificationFeedData>(EMPTY_FEED)
  const [readState, setReadState] = useState<{ userId?: string; ids: Set<string> }>(() => ({
    userId,
    ids: readNotificationIds(userId),
  }))
  const readIds = readState.userId === userId ? readState.ids : readNotificationIds(userId)

  const reload = useCallback(async () => {
    if (!userId || !profile?.is_approved || profile.is_archived) return
    try {
      setFeed(await fetchNotificationFeed(userId))
    } catch {
      // Notifications are supplementary and must never block the application.
    }
  }, [profile, userId])

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  useEffect(() => {
    if (!userId) return
    const refresh = () => { if (document.visibilityState === 'visible') void reload() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [reload, userId])

  const notifications = useMemo(
    () => profile ? buildNotifications(feed, profile, todayIso()) : [],
    [feed, profile],
  )

  function markRead(notification: AppNotification) {
    persistReadIds(userId, new Set(readIds).add(notification.id), setReadState)
  }

  function markAllRead() {
    const next = new Set(readIds)
    notifications.forEach((notification) => next.add(notification.id))
    persistReadIds(userId, next, setReadState)
  }

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !readIds.has(notification.id)).length,
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
