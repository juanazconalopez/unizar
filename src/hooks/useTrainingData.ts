import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { errorText } from '../lib/errors'
import { fetchTrainingData } from '../services/trainingService'
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
  const [errorMessage, setErrorMessage] = useState('')
  const [loadedView, setLoadedView] = useState<ViewName | null>(null)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const inFlightReload = useRef<Promise<void> | null>(null)
  const lastReloadAttempt = useRef(0)
  const userId = session?.user.id

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
    errorMessage,
    loadedView,
    loadedUserId,
    reload,
  }
}
