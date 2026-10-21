import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { addDays, monthEnd, monthStart, todayIso } from '../lib/dates'
import { withAuthRecovery } from '../lib/authRecovery'
import { errorText } from '../lib/errors'
import { canManageSport, canManageTrainingGroups } from '../lib/permissions'
import type { PermissionConfiguration } from '../services/permissionsService'
import type { PermissionKey } from '../lib/permissions'
import { fetchTrainingData, type TrainingData } from '../services/trainingDataService'
import { SessionQueryCache } from '../services/sessionQueryCache'
import { cachedTrainingGroupsApi } from '../services/trainingGroupsService'
import { canAccessView } from '../app/appAccess'
import { fetchAttendanceDate, fetchMatchWindow, fetchStatisticsWindow, fetchTaskWindow } from '../services/trainingQueriesService'
import type { MatchWindowData } from '../services/trainingQueriesService'
import type { AttendanceRecord, CalendarBirthday, LibraryItem, LibrarySettings, Match, MatchAvailability, MatchLineup, PlayerAbsence, PlayerAbsencePrivateNote, Profile, ProfilePrivateDetails, ProvisionalAttendanceRecord, ProvisionalPlayer, Season, SeasonBirthday, SeasonCompetition, SeasonPlayer, SeasonTeam, SeasonTeamCoach, TaskResult, TeamAnnouncement, TodayBirthday, TrainingSession, TrainingTask, ViewName } from '../types'
import { attendanceKey, availabilityKey, lineupKey, mergeTaskWindow, provisionalAttendanceKey, replaceDateRange, replaceRelated, restoreLoadedRanges } from './trainingDataCache'

export const AUTO_REFRESH_INTERVAL_MS = 60 * 1000
export const MATCH_WINDOW_CACHE_TTL_MS = 60 * 1000
const MAX_CACHED_MATCH_MONTHS = 6

export function useTrainingData(session: Session | null, view: ViewName = 'home') {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ownProfileDetails, setOwnProfileDetails] = useState<ProfilePrivateDetails | null>(null)
  const [profilePrivateDetails, setProfilePrivateDetails] = useState<ProfilePrivateDetails[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [seasonCompetitions, setSeasonCompetitions] = useState<SeasonCompetition[]>([])
  const [seasonTeams, setSeasonTeams] = useState<SeasonTeam[]>([])
  const [seasonTeamCoaches, setSeasonTeamCoaches] = useState<SeasonTeamCoach[]>([])
  const [playerAbsences, setPlayerAbsences] = useState<PlayerAbsence[]>([])
  const [playerAbsencePrivateNotes, setPlayerAbsencePrivateNotes] = useState<PlayerAbsencePrivateNote[]>([])
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
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([])
  const [librarySettings, setLibrarySettings] = useState<LibrarySettings | null>(null)
  const [permissionKeys, setPermissionKeys] = useState<PermissionKey[]>([])
  const [permissionConfiguration, setPermissionConfiguration] = useState<PermissionConfiguration>({ definitions: [], grants: [] })
  const [loading, setLoading] = useState(false)
  const [loadingRange, setLoadingRange] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [loadedView, setLoadedView] = useState<ViewName | null>(null)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [accessRevision, setAccessRevision] = useState(0)
  const tasksRef = useRef<TrainingTask[]>([])
  const sectionCache = useRef(new Map<ViewName, { data: TrainingData; loadedAt: number }>())
  const sectionRequests = useRef(new Map<ViewName, Promise<void>>())
  const sharedCache = useRef(new SessionQueryCache())
  const generation = useRef(0)
  const accessSignature = useRef<string | null>(null)
  const activeView = useRef(view)
  const lastReloadAttempt = useRef(0)
  const pendingRangeLoads = useRef(0)
  const rangeRequestIds = useRef({ tasks: 0, statistics: 0, attendance: 0 })
  const matchRequestIds = useRef(new Map<string, number>())
  const loadedTaskRanges = useRef(new Map<string, { from: string; to: string }>())
  const loadedStatisticsMonth = useRef<string | null>(null)
  const loadedAttendanceDate = useRef<string | null>(null)
  const loadedMatchMonth = useRef<string | null>(null)
  const matchWindowCache = useRef(new Map<string, { loadedAt: number; data: MatchWindowData }>())
  const rangesUserId = useRef<string | undefined>(undefined)
  const userId = session?.user.id
  const groupQueries = useMemo(() => ({ userId, cache: new SessionQueryCache() }), [userId])
  const trainingGroupsApi = useMemo(() => cachedTrainingGroupsApi(groupQueries.cache), [groupQueries])

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
    const requestGeneration = generation.current
    const requestView = activeView.current
    const requestId = ++rangeRequestIds.current.tasks
    beginRangeLoad()
    setErrorMessage('')
    try {
      const data = await withAuthRecovery(() => fetchTaskWindow(userId, canManageSport(profile, permissionKeys), fromWeek, toWeek))
      if (generation.current !== requestGeneration || activeView.current !== requestView || rangeRequestIds.current.tasks !== requestId) return
      loadedTaskRanges.current.set(`${fromWeek}:${toWeek}`, { from: fromWeek, to: toWeek })
      setResults((currentResults) => mergeTaskWindow(
        tasksRef.current, currentResults, data, fromWeek, toWeek,
      ).results)
      setTasks((currentTasks) => replaceDateRange(currentTasks, data.tasks, 'week_start', fromWeek, toWeek))
      setAnnouncements((current) => replaceDateRange(current, data.announcements ?? [], 'announcement_date', fromWeek, addDays(toWeek, 6)))
    } catch (error) {
      if (generation.current === requestGeneration && activeView.current === requestView && rangeRequestIds.current.tasks === requestId) setErrorMessage(errorText(error))
      throw error
    } finally {
      endRangeLoad()
    }
  }, [beginRangeLoad, endRangeLoad, permissionKeys, profile, userId])

  const loadStatisticsMonth = useCallback(async (month: string) => {
    if (!userId) return
    const requestGeneration = generation.current
    const requestView = activeView.current
    const requestId = ++rangeRequestIds.current.statistics
    beginRangeLoad()
    setErrorMessage('')
    try {
      const data = await withAuthRecovery(() => fetchStatisticsWindow(month, {
        tasks: Boolean(profile && permissionKeys.includes('statistics.tasks')),
        attendance: Boolean(profile && permissionKeys.includes('statistics.attendance')),
      }))
      if (generation.current !== requestGeneration || activeView.current !== requestView || rangeRequestIds.current.statistics !== requestId) return
      loadedStatisticsMonth.current = month
      setTasks(data.tasks)
      setResults(data.results)
      setTrainingSessions(data.trainingSessions)
      setAttendance(data.attendance)
      setProvisionalAttendance(data.provisionalAttendance)
    } catch (error) {
      if (generation.current === requestGeneration && activeView.current === requestView && rangeRequestIds.current.statistics === requestId) setErrorMessage(errorText(error))
      throw error
    } finally {
      endRangeLoad()
    }
  }, [beginRangeLoad, endRangeLoad, permissionKeys, profile, userId])

  const loadAttendanceDate = useCallback(async (date: string) => {
    if (!userId) return
    const requestGeneration = generation.current
    const requestView = activeView.current
    const requestId = ++rangeRequestIds.current.attendance
    beginRangeLoad()
    setErrorMessage('')
    try {
      const data = await withAuthRecovery(() => fetchAttendanceDate(date))
      if (generation.current !== requestGeneration || activeView.current !== requestView || rangeRequestIds.current.attendance !== requestId) return data
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
      if (generation.current === requestGeneration && activeView.current === requestView && rangeRequestIds.current.attendance === requestId) setErrorMessage(errorText(error))
      throw error
    } finally {
      endRangeLoad()
    }
  }, [beginRangeLoad, endRangeLoad, userId])

  const applyMatchWindow = useCallback((from: string, to: string, data: MatchWindowData) => {
    setMatches((current) => {
      const oldMatchIds = new Set(current.filter((match) => match.match_date >= from && match.match_date <= to).map((match) => match.id))
      const affectedIds = new Set([...oldMatchIds, ...data.matches.map((match) => match.id)])
      setMatchAvailability((currentAvailability) => replaceRelated(currentAvailability, data.matchAvailability, affectedIds, (item) => item.match_id, availabilityKey))
      setMatchLineups((currentLineups) => replaceRelated(currentLineups, data.matchLineups, affectedIds, (item) => item.match_id, lineupKey))
      return replaceDateRange(current, data.matches, 'match_date', from, to)
    })
  }, [])

  const cacheMatchWindow = useCallback((month: string, data: MatchWindowData) => {
    const cache = matchWindowCache.current
    cache.delete(month)
    cache.set(month, { loadedAt: Date.now(), data })
    while (cache.size > MAX_CACHED_MATCH_MONTHS) cache.delete(cache.keys().next().value as string)
  }, [])

  const loadMatchMonth = useCallback(async (month: string, options: { force?: boolean } = {}) => {
    if (!userId) return
    const requestGeneration = generation.current
    const requestView = activeView.current
    beginRangeLoad()
    setErrorMessage('')
    try {
      const from = monthStart(month)
      const to = monthEnd(month)
      const requestId = (matchRequestIds.current.get(from) ?? 0) + 1
      matchRequestIds.current.set(from, requestId)
      const cached = matchWindowCache.current.get(from)
      if (cached && !options.force) {
        applyMatchWindow(from, to, cached.data)
        if (Date.now() - cached.loadedAt < MATCH_WINDOW_CACHE_TTL_MS) return
      }
      const data = await withAuthRecovery(() => fetchMatchWindow(from, to))
      if (generation.current !== requestGeneration || activeView.current !== requestView || matchRequestIds.current.get(from) !== requestId) return
      loadedMatchMonth.current = monthStart(month)
      cacheMatchWindow(from, data)
      applyMatchWindow(from, to, data)
    } catch (error) {
      if (generation.current === requestGeneration && activeView.current === requestView) setErrorMessage(errorText(error))
      throw error
    } finally {
      endRangeLoad()
    }
  }, [applyMatchWindow, beginRangeLoad, cacheMatchWindow, endRangeLoad, userId])

  const invalidateMatchMonths = useCallback((...dates: string[]) => {
    dates.forEach((date) => matchWindowCache.current.delete(monthStart(date)))
  }, [])

  const applyData = useCallback((data: TrainingData, target: ViewName, accountId: string) => {
    setProfile(data.profile)
    setOwnProfileDetails(data.ownProfileDetails)
    setProfilePrivateDetails(data.profilePrivateDetails)
    setSeasons(data.seasons)
    setSeasonCompetitions(data.seasonCompetitions)
    setSeasonTeams(data.seasonTeams)
    setSeasonTeamCoaches(data.seasonTeamCoaches)
    setPlayerAbsences(data.playerAbsences)
    setPlayerAbsencePrivateNotes(data.playerAbsencePrivateNotes)
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
    setLibraryItems(data.libraryItems)
    setLibrarySettings(data.librarySettings)
    setPermissionKeys(data.permissionKeys)
    setPermissionConfiguration(data.permissionConfiguration)
    setLoadedView(target)
    setLoadedUserId(accountId)
  }, [])

  // A new account invalidates snapshots, queued requests and private shared data.
  useLayoutEffect(() => {
    activeView.current = view
    if (rangesUserId.current === userId) return
    rangesUserId.current = userId
    generation.current += 1
    accessSignature.current = null
    sectionCache.current.clear()
    sectionRequests.current.clear()
    sharedCache.current = new SessionQueryCache()
    loadedTaskRanges.current.clear()
    loadedStatisticsMonth.current = null
    loadedAttendanceDate.current = null
    loadedMatchMonth.current = null
    matchWindowCache.current.clear()
    matchRequestIds.current.clear()
    rangeRequestIds.current = { tasks: 0, statistics: 0, attendance: 0 }
  }, [userId, view])

  const loadSection = useCallback((target: ViewName): Promise<void> => {
    if (!userId) return Promise.resolve()
    const pending = sectionRequests.current.get(target)
    if (pending) return pending
    let requestGeneration = generation.current
    const isCurrent = () => generation.current === requestGeneration && rangesUserId.current === userId
    const isVisible = () => isCurrent() && activeView.current === target
    if (isVisible()) { setLoading(true); setErrorMessage('') }
    lastReloadAttempt.current = Date.now()
    const request = (async () => {
      try {
        let data = await withAuthRecovery(() => fetchTrainingData(userId, target, sharedCache.current))
        if (!isCurrent()) return
        const identity = data.profile
        const signature = JSON.stringify([identity.id, identity.is_approved, identity.is_active, identity.is_archived, identity.is_owner, identity.is_coach, identity.is_viewer, identity.is_player, [...data.permissionKeys].sort()])
        if (accessSignature.current !== null && accessSignature.current !== signature) {
          // A refreshed permission/role must never be replaced by another
          // section's older snapshot or by an already queued response.
          generation.current += 1
          requestGeneration = generation.current
          sectionCache.current.clear()
          sectionRequests.current.clear()
          sharedCache.current = new SessionQueryCache()
          groupQueries.cache.clear()
          matchWindowCache.current.clear()
          setAccessRevision((revision) => revision + 1)
          if (!isVisible()) { setProfile(identity); setPermissionKeys(data.permissionKeys) }
        }
        accessSignature.current = signature
        if (target === 'training-groups' && canAccessView(data.profile, target, data.permissionKeys)) {
          const today = todayIso()
          const season = data.seasons.find((item) => item.start_date <= today && item.end_date >= today)
            ?? [...data.seasons].sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
          if (season) {
            const { fetchGroupState } = await import('../features/trainingGroups/trainingGroupState')
            await fetchGroupState(trainingGroupsApi, season, canManageTrainingGroups(data.profile, data.permissionKeys))
          }
        }
        // Only the visible section restores extra ranges; preloading stays small.
        if (isVisible()) data = await restoreLoadedRanges(data, target, userId, {
          taskRanges: [...loadedTaskRanges.current.values()],
          statisticsMonth: loadedStatisticsMonth.current,
          attendanceDate: loadedAttendanceDate.current,
          matchMonth: loadedMatchMonth.current,
        })
        if (!isCurrent()) return
        sectionCache.current.set(target, { data, loadedAt: Date.now() })
        if (isVisible()) applyData(data, target, userId)
      } catch (error) {
        if (isVisible()) setErrorMessage(errorText(error))
      } finally {
        if (isVisible()) setLoading(false)
      }
    })()
    sectionRequests.current.set(target, request)
    void request.finally(() => {
      if (isCurrent() && sectionRequests.current.get(target) === request) sectionRequests.current.delete(target)
    })
    return request
  }, [applyData, groupQueries, trainingGroupsApi, userId])

  // Explicit reload follows a write or a stale focus event: invalidate other
  // sections too, so an older snapshot cannot undo a saved result or permission.
  const reload = useCallback(async () => {
    generation.current += 1
    sectionCache.current.clear()
    sectionRequests.current.clear()
    sharedCache.current = new SessionQueryCache()
    groupQueries.cache.clear()
    matchWindowCache.current.clear()
    rangeRequestIds.current.tasks += 1
    rangeRequestIds.current.statistics += 1
    rangeRequestIds.current.attendance += 1
    matchRequestIds.current.clear()
    if (!userId) { setProfile(null); return }
    await loadSection(view)
  }, [groupQueries, loadSection, userId, view])

  // Restore before painting: revisiting a prepared section does not flash a
  // full-page skeleton. Its refresh can run behind the already visible data.
  useLayoutEffect(() => {
    if (!userId) return
    const cached = sectionCache.current.get(view)
    if (cached) { applyData(cached.data, view, userId); setLoading(false); setErrorMessage('') }
  }, [applyData, userId, view])

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    if (!profile || !loadedView || loadedUserId !== userId) return
    const cached = sectionCache.current.get(loadedView)
    if (!cached) return
    cached.data = { profile, ownProfileDetails, profilePrivateDetails, seasons, seasonCompetitions, seasonTeams, seasonTeamCoaches, playerAbsences, playerAbsencePrivateNotes, memberships, profiles, tasks, results, trainingSessions, attendance, provisionalPlayers, provisionalAttendance, matches, matchAvailability, matchLineups, announcements, todayBirthdays, seasonBirthdays, calendarBirthdays, libraryItems, librarySettings, permissionKeys, permissionConfiguration }
  }, [profile, ownProfileDetails, profilePrivateDetails, seasons, seasonCompetitions, seasonTeams, seasonTeamCoaches, playerAbsences, playerAbsencePrivateNotes, memberships, profiles, tasks, results, trainingSessions, attendance, provisionalPlayers, provisionalAttendance, matches, matchAvailability, matchLineups, announcements, todayBirthdays, seasonBirthdays, calendarBirthdays, libraryItems, librarySettings, permissionKeys, permissionConfiguration, loadedUserId, loadedView, userId])

  useEffect(() => {
    if (!userId) return
    const cached = sectionCache.current.get(view)
    if (cached && Date.now() - cached.loadedAt < AUTO_REFRESH_INTERVAL_MS) return
    const timer = window.setTimeout(() => void loadSection(view), 0)
    return () => window.clearTimeout(timer)
  }, [accessRevision, loadSection, userId, view])

  useEffect(() => {
    if (!profile || loadedUserId !== userId) return
    const targets: ViewName[] = ['home', 'calendar', 'matches', 'attendance', 'training-groups']
    // Prepare only accessible common sections, two at a time. No Supabase
    // queries for settings/private management or whole-season histories.
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        const allowed = targets.filter((target) => target !== view && canAccessView(profile, target, permissionKeys))
        for (let index = 0; index < allowed.length && !cancelled; index += 2) {
          await Promise.all(allowed.slice(index, index + 2).map((target) => {
            const cached = sectionCache.current.get(target)
            return cached && Date.now() - cached.loadedAt < AUTO_REFRESH_INTERVAL_MS ? undefined : loadSection(target)
          }))
        }
      })()
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [loadSection, loadedUserId, permissionKeys, profile, userId, view])

  useEffect(() => {
    if (!userId) return

    function refreshIfStale() {
      if (document.visibilityState !== 'visible' || sectionRequests.current.has(view)) return
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
  }, [reload, userId, view])

  return {
    profile,
    ownProfileDetails,
    profilePrivateDetails,
    seasons,
    seasonCompetitions,
    seasonTeams,
    seasonTeamCoaches,
    playerAbsences,
    playerAbsencePrivateNotes,
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
    libraryItems,
    librarySettings,
    permissionKeys,
    permissionConfiguration,
    loading,
    loadingRange,
    errorMessage,
    loadedView,
    loadedUserId,
    reload,
    trainingGroupsApi,
    loadTaskRange,
    loadStatisticsMonth,
    loadAttendanceDate,
    loadMatchMonth,
    invalidateMatchMonths,
  }
}
