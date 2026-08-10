import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { monthEnd, monthStart } from '../lib/dates'
import { errorText } from '../lib/errors'
import {
  fetchAttendanceDate,
  fetchMatchWindow,
  fetchStatisticsWindow,
  fetchTaskWindow,
  fetchTrainingData,
} from '../services/trainingService'
import type { AttendanceRecord, Match, MatchAvailability, MatchLineup, Profile, Season, SeasonPlayer, TaskResult, TrainingSession, TrainingTask, ViewName } from '../types'

export const AUTO_REFRESH_INTERVAL_MS = 60 * 1000

export function useTrainingData(session: Session | null, view: ViewName = 'home') {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [seasons, setSeasons] = useState<Season[]>([])
  const [memberships, setMemberships] = useState<SeasonPlayer[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [tasks, setTasks] = useState<TrainingTask[]>([])
  const [results, setResults] = useState<TaskResult[]>([])
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [matchAvailability, setMatchAvailability] = useState<MatchAvailability[]>([])
  const [matchLineups, setMatchLineups] = useState<MatchLineup[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingRange, setLoadingRange] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [loadedView, setLoadedView] = useState<ViewName | null>(null)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const inFlightReload = useRef<Promise<void> | null>(null)
  const lastReloadAttempt = useRef(0)
  const userId = session?.user.id

  const loadTaskRange = useCallback(async (fromWeek: string, toWeek: string) => {
    if (!userId || !profile) return
    setLoadingRange(true)
    setErrorMessage('')
    try {
      const data = await fetchTaskWindow(userId, profile.is_owner || profile.is_collaborator, fromWeek, toWeek)
      setTasks((current) => replaceDateRange(current, data.tasks, 'week_start', fromWeek, toWeek))
      setResults((current) => replaceRelated(current, data.results, new Set([
        ...current.filter((result) => tasks.some((task) => task.id === result.task_id && task.week_start >= fromWeek && task.week_start <= toWeek)).map((result) => result.task_id),
        ...data.tasks.map((task) => task.id),
      ]), (result) => result.task_id, resultKey))
    } catch (error) {
      setErrorMessage(errorText(error))
      throw error
    } finally {
      setLoadingRange(false)
    }
  }, [profile, tasks, userId])

  const loadStatisticsMonth = useCallback(async (month: string) => {
    if (!userId) return
    setLoadingRange(true)
    setErrorMessage('')
    try {
      const data = await fetchStatisticsWindow(month)
      setTasks(data.tasks)
      setResults(data.results)
      setTrainingSessions(data.trainingSessions)
      setAttendance(data.attendance)
    } catch (error) {
      setErrorMessage(errorText(error))
      throw error
    } finally {
      setLoadingRange(false)
    }
  }, [userId])

  const loadAttendanceDate = useCallback(async (date: string) => {
    if (!userId) return
    setLoadingRange(true)
    setErrorMessage('')
    try {
      const data = await fetchAttendanceDate(date)
      const oldSessionIds = new Set(trainingSessions.filter((sessionItem) => sessionItem.session_date === date).map((sessionItem) => sessionItem.id))
      const affectedIds = new Set([...oldSessionIds, ...data.trainingSessions.map((sessionItem) => sessionItem.id)])
      setTrainingSessions((current) => mergeByKey(current, data.trainingSessions, (item) => item.id))
      setAttendance((current) => replaceRelated(current, data.attendance, affectedIds, (item) => item.session_id, attendanceKey))
      return data.attendance
    } catch (error) {
      setErrorMessage(errorText(error))
      throw error
    } finally {
      setLoadingRange(false)
    }
  }, [trainingSessions, userId])

  const loadMatchMonth = useCallback(async (month: string) => {
    if (!userId) return
    setLoadingRange(true)
    setErrorMessage('')
    try {
      const from = monthStart(month)
      const to = monthEnd(month)
      const data = await fetchMatchWindow(from, to)
      const oldMatchIds = new Set(matches.filter((match) => match.match_date >= from && match.match_date <= to).map((match) => match.id))
      const affectedIds = new Set([...oldMatchIds, ...data.matches.map((match) => match.id)])
      setMatches((current) => replaceDateRange(current, data.matches, 'match_date', from, to))
      setMatchAvailability((current) => replaceRelated(current, data.matchAvailability, affectedIds, (item) => item.match_id, availabilityKey))
      setMatchLineups((current) => replaceRelated(current, data.matchLineups, affectedIds, (item) => item.match_id, lineupKey))
    } catch (error) {
      setErrorMessage(errorText(error))
      throw error
    } finally {
      setLoadingRange(false)
    }
  }, [matches, userId])

  const reload = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      return
    }

    while (inFlightReload.current) await inFlightReload.current

    lastReloadAttempt.current = Date.now()
    const request = (async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        const data = await fetchTrainingData(userId, view)
        setProfile(data.profile)
        setSeasons(data.seasons)
        setTasks(data.tasks)
        setResults(data.results)
        setMemberships(data.memberships)
        setProfiles(data.profiles)
        setTrainingSessions(data.trainingSessions)
        setAttendance(data.attendance)
        setMatches(data.matches)
        setMatchAvailability(data.matchAvailability)
        setMatchLineups(data.matchLineups)
        setLoadedView(view)
        setLoadedUserId(userId)
      } catch (error) {
        setErrorMessage(errorText(error))
      } finally {
        setLoading(false)
      }
    })()

    inFlightReload.current = request
    try {
      await request
    } finally {
      if (inFlightReload.current === request) inFlightReload.current = null
    }
  }, [userId, view])

  useEffect(() => {
    lastReloadAttempt.current = Date.now()
    const timer = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  useEffect(() => {
    if (!userId) return

    function refreshIfStale() {
      if (document.visibilityState !== 'visible' || inFlightReload.current) return
      if (Date.now() - lastReloadAttempt.current < AUTO_REFRESH_INTERVAL_MS) return
      void reload()
    }

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') refreshIfStale()
    }

    window.addEventListener('focus', refreshIfStale)
    window.addEventListener('online', refreshIfStale)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshIfStale)
      window.removeEventListener('online', refreshIfStale)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [reload, userId])

  return {
    profile,
    seasons,
    memberships,
    profiles,
    tasks,
    results,
    trainingSessions,
    attendance,
    matches,
    matchAvailability,
    matchLineups,
    loading,
    loadingRange,
    errorMessage,
    loadedView,
    loadedUserId,
    reload,
    loadTaskRange,
    loadStatisticsMonth,
    loadAttendanceDate,
    loadMatchMonth,
  }
}

function mergeByKey<T>(current: T[], incoming: T[], key: (item: T) => string) {
  const merged = new Map(current.map((item) => [key(item), item]))
  incoming.forEach((item) => merged.set(key(item), item))
  return [...merged.values()]
}

function replaceDateRange<T, K extends keyof T>(current: T[], incoming: T[], field: K, from: string, to: string) {
  return [...current.filter((item) => {
    const value = String(item[field])
    return value < from || value > to
  }), ...incoming]
}

function replaceRelated<T>(
  current: T[],
  incoming: T[],
  affectedIds: Set<string>,
  relationId: (item: T) => string,
  key: (item: T) => string,
) {
  return mergeByKey(current.filter((item) => !affectedIds.has(relationId(item))), incoming, key)
}

const resultKey = (result: TaskResult) => `${result.task_id}:${result.player_id}`
const attendanceKey = (record: AttendanceRecord) => `${record.session_id}:${record.player_id}`
const availabilityKey = (item: MatchAvailability) => `${item.match_id}:${item.player_id}`
const lineupKey = (item: MatchLineup) => `${item.match_id}:${item.position}:${item.player_id}`
