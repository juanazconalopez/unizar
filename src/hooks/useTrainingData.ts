import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { addDays, monthEnd, monthStart } from '../lib/dates'
import { withAuthRecovery } from '../lib/authRecovery'
import { errorText } from '../lib/errors'
import { canManageSport } from '../lib/permissions'
import { fetchTrainingData } from '../services/trainingDataService'
import { fetchAttendanceDate, fetchMatchWindow, fetchStatisticsWindow, fetchTaskWindow } from '../services/trainingQueriesService'
import type { AttendanceRecord, CalendarBirthday, Match, MatchAvailability, MatchLineup, Profile, ProfilePrivateDetails, ProvisionalAttendanceRecord, ProvisionalPlayer, Season, SeasonBirthday, SeasonPlayer, TaskResult, TeamAnnouncement, TodayBirthday, TrainingSession, TrainingTask, ViewName } from '../types'
import { attendanceKey, availabilityKey, lineupKey, mergeTaskWindow, provisionalAttendanceKey, replaceDateRange, replaceRelated, restoreLoadedRanges } from './trainingDataCache'

export const AUTO_REFRESH_INTERVAL_MS = 60 * 1000

export function useTrainingData(session: Session | null, view: ViewName = 'home') {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ownProfileDetails, setOwnProfileDetails] = useState<ProfilePrivateDetails | null>(null)
  const [profilePrivateDetails, setProfilePrivateDetails] = useState<ProfilePrivateDetails[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [memberships, setMemberships] = useState<SeasonPlayer[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [tasks, setTasks] = useState<TrainingTask[]>([])
  const [results, setResults] = useState<TaskResult[]>([])
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [provisionalPlayers, setProvisionalPlayers] = useState<ProvisionalPlayer[]>([])
  const [provisionalAttendance, setProvisionalAttendance] = useState<ProvisionalAttendanceRecord[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [matchAvailability, setMatchAvailability] = useState<MatchAvailability[]>([])
  const [matchLineups, setMatchLineups] = useState<MatchLineup[]>([])
  const [announcements, setAnnouncements] = useState<TeamAnnouncement[]>([])
  const [todayBirthdays, setTodayBirthdays] = useState<TodayBirthday[]>([])
  const [seasonBirthdays, setSeasonBirthdays] = useState<SeasonBirthday[]>([])
  const [calendarBirthdays, setCalendarBirthdays] = useState<CalendarBirthday[]>([])
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
      const data = await withAuthRecovery(() => fetchTaskWindow(userId, canManageSport(profile), fromWeek, toWeek))
      if (rangeRequestIds.current.tasks !== requestId) return
      loadedTaskRanges.current.set(`${fromWeek}:${toWeek}`, { from: fromWeek, to: toWeek })
      setResults((currentResults) => mergeTaskWindow(
        tasksRef.current, currentResults, data, fromWeek, toWeek,
      ).results)
      setTasks((currentTasks) => replaceDateRange(currentTasks, data.tasks, 'week_start', fromWeek, toWeek))
      setAnnouncements((current) => replaceDateRange(current, data.announcements ?? [], 'announcement_date', fromWeek, addDays(toWeek, 6)))
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
      const data = await withAuthRecovery(() => fetchStatisticsWindow(month))
      if (rangeRequestIds.current.statistics !== requestId) return
      loadedStatisticsMonth.current = month
      setTasks(data.tasks)
      setResults(data.results)
      setTrainingSessions(data.trainingSessions)
      setAttendance(data.attendance)
      setProvisionalAttendance(data.provisionalAttendance)
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
      const data = await withAuthRecovery(() => fetchAttendanceDate(date))
      if (rangeRequestIds.current.attendance !== requestId) return data
      loadedAttendanceDate.current = date
      setTrainingSessions((current) => {
        const oldSessionIds = new Set(current.filter((sessionItem) => sessionItem.session_date === date).map((sessionItem) => sessionItem.id))
        const affectedIds = new Set([...oldSessionIds, ...data.trainingSessions.map((sessionItem) => sessionItem.id)])
        setAttendance((currentAttendance) => replaceRelated(currentAttendance, data.attendance, affectedIds, (item) => item.session_id, attendanceKey))
        setProvisionalAttendance((currentAttendance) => replaceRelated(currentAttendance, data.provisionalAttendance, affectedIds, (item) => item.session_id, provisionalAttendanceKey))
        return replaceDateRange(current, data.trainingSessions, 'session_date', date, date)
      })
      return data
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
      const data = await withAuthRecovery(() => fetchMatchWindow(from, to))
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

    if (view === 'tasks' || view === 'calendar') rangeRequestIds.current.tasks += 1
    if (view === 'statistics') rangeRequestIds.current.statistics += 1
    if (view === 'attendance') rangeRequestIds.current.attendance += 1
    if (view === 'matches' || view === 'calendar') rangeRequestIds.current.matches += 1

    lastReloadAttempt.current = Date.now()
    const request = (async () => {
      setLoading(true)
      setErrorMessage('')

      try {
        let data = await withAuthRecovery(() => fetchTrainingData(userId, view))
        data = await restoreLoadedRanges(data, view, userId, {
          taskRanges: [...loadedTaskRanges.current.values()],
          statisticsMonth: loadedStatisticsMonth.current,
          attendanceDate: loadedAttendanceDate.current,
          matchMonth: loadedMatchMonth.current,
        })
        setProfile(data.profile)
        setOwnProfileDetails(data.ownProfileDetails)
        setProfilePrivateDetails(data.profilePrivateDetails)
        setSeasons(data.seasons)
        setTasks(data.tasks)
        setResults(data.results)
        setMemberships(data.memberships)
        setProfiles(data.profiles)
        setTrainingSessions(data.trainingSessions)
        setAttendance(data.attendance)
        setProvisionalPlayers(data.provisionalPlayers)
        setProvisionalAttendance(data.provisionalAttendance)
        setMatches(data.matches)
        setMatchAvailability(data.matchAvailability)
        setMatchLineups(data.matchLineups)
        setAnnouncements(data.announcements ?? [])
        setTodayBirthdays(data.todayBirthdays)
        setSeasonBirthdays(data.seasonBirthdays)
        setCalendarBirthdays(data.calendarBirthdays)
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
    ownProfileDetails,
    profilePrivateDetails,
    seasons,
    memberships,
    profiles,
    tasks,
    results,
    trainingSessions,
    attendance,
    provisionalPlayers,
    provisionalAttendance,
    matches,
    matchAvailability,
    matchLineups,
    announcements,
    todayBirthdays,
    seasonBirthdays,
    calendarBirthdays,
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
