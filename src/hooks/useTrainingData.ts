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
  const tasksRef = useRef<TrainingTask[]>([])
  const inFlightReload = useRef<Promise<void> | null>(null)
  const lastReloadAttempt = useRef(0)
  const pendingRangeLoads = useRef(0)
  const rangeRequestIds = useRef({ tasks: 0, statistics: 0, attendance: 0, matches: 0 })
  const loadedTaskRanges = useRef(new Map<string, { from: string; to: string }>())
  const loadedStatisticsMonth = useRef<string | null>(null)
  const loadedAttendanceDate = useRef<string | null>(null)
  const loadedMatchMonth = useRef<string | null>(null)
  const rangesUserId = useRef<string | undefined>(undefined)
  const userId = session?.user.id

  const beginRangeLoad = useCallback(() => {
    pendingRangeLoads.current += 1
    setLoadingRange(true)
  }, [])

  const endRangeLoad = useCallback(() => {
    pendingRangeLoads.current = Math.max(0, pendingRangeLoads.current - 1)
    if (pendingRangeLoads.current === 0) setLoadingRange(false)
  }, [])

  const loadTaskRange = useCallback(async (fromWeek: string, toWeek: string) => {
    if (!userId || !profile) return
    const requestId = ++rangeRequestIds.current.tasks
    beginRangeLoad()
    setErrorMessage('')
    try {
      const data = await fetchTaskWindow(userId, profile.is_owner || profile.is_collaborator, fromWeek, toWeek)
      if (rangeRequestIds.current.tasks !== requestId) return
      loadedTaskRanges.current.set(`${fromWeek}:${toWeek}`, { from: fromWeek, to: toWeek })
      setResults((currentResults) => mergeTaskWindow(
        tasksRef.current, currentResults, data, fromWeek, toWeek,
      ).results)
      setTasks((currentTasks) => replaceDateRange(currentTasks, data.tasks, 'week_start', fromWeek, toWeek))
    } catch (error) {
      if (rangeRequestIds.current.tasks === requestId) setErrorMessage(errorText(error))
      throw error
    } finally {
      endRangeLoad()
    }
  }, [beginRangeLoad, endRangeLoad, profile, userId])

  const loadStatisticsMonth = useCallback(async (month: string) => {
    if (!userId) return
    const requestId = ++rangeRequestIds.current.statistics
    beginRangeLoad()
    setErrorMessage('')
    try {
      const data = await fetchStatisticsWindow(month)
      if (rangeRequestIds.current.statistics !== requestId) return
      loadedStatisticsMonth.current = month
      setTasks(data.tasks)
      setResults(data.results)
      setTrainingSessions(data.trainingSessions)
      setAttendance(data.attendance)
    } catch (error) {
      if (rangeRequestIds.current.statistics === requestId) setErrorMessage(errorText(error))
      throw error
    } finally {
      endRangeLoad()
    }
  }, [beginRangeLoad, endRangeLoad, userId])

  const loadAttendanceDate = useCallback(async (date: string) => {
    if (!userId) return
    const requestId = ++rangeRequestIds.current.attendance
    beginRangeLoad()
    setErrorMessage('')
    try {
      const data = await fetchAttendanceDate(date)
      if (rangeRequestIds.current.attendance !== requestId) return data.attendance
      loadedAttendanceDate.current = date
      setTrainingSessions((current) => {
        const oldSessionIds = new Set(current.filter((sessionItem) => sessionItem.session_date === date).map((sessionItem) => sessionItem.id))
        const affectedIds = new Set([...oldSessionIds, ...data.trainingSessions.map((sessionItem) => sessionItem.id)])
        setAttendance((currentAttendance) => replaceRelated(currentAttendance, data.attendance, affectedIds, (item) => item.session_id, attendanceKey))
        return replaceDateRange(current, data.trainingSessions, 'session_date', date, date)
      })
      return data.attendance
    } catch (error) {
      if (rangeRequestIds.current.attendance === requestId) setErrorMessage(errorText(error))
      throw error
    } finally {
      endRangeLoad()
    }
  }, [beginRangeLoad, endRangeLoad, userId])

  const loadMatchMonth = useCallback(async (month: string) => {
    if (!userId) return
    const requestId = ++rangeRequestIds.current.matches
    beginRangeLoad()
    setErrorMessage('')
    try {
      const from = monthStart(month)
      const to = monthEnd(month)
      const data = await fetchMatchWindow(from, to)
      if (rangeRequestIds.current.matches !== requestId) return
      loadedMatchMonth.current = monthStart(month)
      setMatches((current) => {
        const oldMatchIds = new Set(current.filter((match) => match.match_date >= from && match.match_date <= to).map((match) => match.id))
        const affectedIds = new Set([...oldMatchIds, ...data.matches.map((match) => match.id)])
        setMatchAvailability((currentAvailability) => replaceRelated(currentAvailability, data.matchAvailability, affectedIds, (item) => item.match_id, availabilityKey))
        setMatchLineups((currentLineups) => replaceRelated(currentLineups, data.matchLineups, affectedIds, (item) => item.match_id, lineupKey))
        return replaceDateRange(current, data.matches, 'match_date', from, to)
      })
    } catch (error) {
      if (rangeRequestIds.current.matches === requestId) setErrorMessage(errorText(error))
      throw error
    } finally {
      endRangeLoad()
    }
  }, [beginRangeLoad, endRangeLoad, userId])

  const reload = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      return
    }

    if (rangesUserId.current !== userId) {
      rangesUserId.current = userId
      loadedTaskRanges.current.clear()
      loadedStatisticsMonth.current = null
      loadedAttendanceDate.current = null
      loadedMatchMonth.current = null
    }

    while (inFlightReload.current) await inFlightReload.current

    if (view === 'tasks') rangeRequestIds.current.tasks += 1
    if (view === 'statistics') rangeRequestIds.current.statistics += 1
    if (view === 'attendance') rangeRequestIds.current.attendance += 1
    if (view === 'matches') rangeRequestIds.current.matches += 1

    lastReloadAttempt.current = Date.now()
    const request = (async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        let data = await fetchTrainingData(userId, view)
        data = await restoreLoadedRanges(data, view, userId, {
          taskRanges: [...loadedTaskRanges.current.values()],
          statisticsMonth: loadedStatisticsMonth.current,
          attendanceDate: loadedAttendanceDate.current,
          matchMonth: loadedMatchMonth.current,
        })
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
    tasksRef.current = tasks
  }, [tasks])

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

type LoadedRanges = {
  taskRanges: { from: string; to: string }[]
  statisticsMonth: string | null
  attendanceDate: string | null
  matchMonth: string | null
}

async function restoreLoadedRanges(
  base: Awaited<ReturnType<typeof fetchTrainingData>>,
  view: ViewName,
  userId: string,
  ranges: LoadedRanges,
) {
  if (view === 'tasks' && ranges.taskRanges.length) {
    let tasks = base.tasks
    let results = base.results
    const canManage = base.profile.is_owner || base.profile.is_collaborator
    const windows = await Promise.all(ranges.taskRanges.map(async ({ from, to }) => ({
      from,
      to,
      data: await fetchTaskWindow(userId, canManage, from, to),
    })))
    for (const window of windows) {
      const merged = mergeTaskWindow(tasks, results, window.data, window.from, window.to)
      tasks = merged.tasks
      results = merged.results
    }
    return { ...base, tasks, results }
  }

  if (view === 'statistics' && ranges.statisticsMonth) {
    const statistics = await fetchStatisticsWindow(ranges.statisticsMonth)
    return { ...base, ...statistics }
  }

  if (view === 'attendance' && ranges.attendanceDate) {
    let trainingSessions = base.trainingSessions
    let attendance = base.attendance
    const window = await fetchAttendanceDate(ranges.attendanceDate)
    const oldIds = new Set(trainingSessions
      .filter((session) => session.session_date === ranges.attendanceDate)
      .map((session) => session.id))
    const affectedIds = new Set([...oldIds, ...window.trainingSessions.map((session) => session.id)])
    trainingSessions = replaceDateRange(
      trainingSessions, window.trainingSessions, 'session_date', ranges.attendanceDate, ranges.attendanceDate,
    )
    attendance = replaceRelated(
      attendance, window.attendance, affectedIds, (item) => item.session_id, attendanceKey,
    )
    return { ...base, trainingSessions, attendance }
  }

  if (view === 'matches' && ranges.matchMonth) {
    let matches = base.matches
    let matchAvailability = base.matchAvailability
    let matchLineups = base.matchLineups
    const from = monthStart(ranges.matchMonth)
    const to = monthEnd(ranges.matchMonth)
    const window = await fetchMatchWindow(from, to)
    const oldIds = new Set(matches
      .filter((match) => match.match_date >= from && match.match_date <= to)
      .map((match) => match.id))
    const affectedIds = new Set([...oldIds, ...window.matches.map((match) => match.id)])
    matches = replaceDateRange(matches, window.matches, 'match_date', from, to)
    matchAvailability = replaceRelated(
      matchAvailability, window.matchAvailability, affectedIds, (item) => item.match_id, availabilityKey,
    )
    matchLineups = replaceRelated(
      matchLineups, window.matchLineups, affectedIds, (item) => item.match_id, lineupKey,
    )
    return { ...base, matches, matchAvailability, matchLineups }
  }

  return base
}

function mergeTaskWindow(
  tasks: TrainingTask[],
  results: TaskResult[],
  incoming: { tasks: TrainingTask[]; results: TaskResult[] },
  from: string,
  to: string,
) {
  const affectedIds = new Set([
    ...tasks.filter((task) => task.week_start >= from && task.week_start <= to).map((task) => task.id),
    ...incoming.tasks.map((task) => task.id),
  ])
  return {
    tasks: replaceDateRange(tasks, incoming.tasks, 'week_start', from, to),
    results: replaceRelated(results, incoming.results, affectedIds, (result) => result.task_id, resultKey),
  }
}
