import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { errorText } from '../lib/errors'
import { fetchTrainingData } from '../services/trainingService'
import type { AttendanceRecord, Match, MatchAvailability, MatchLineup, Profile, Season, SeasonPlayer, TaskResult, TrainingSession, TrainingTask } from '../types'

export function useTrainingData(session: Session | null) {
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

  const reload = useCallback(async () => {
    if (!session?.user) {
      setProfile(null)
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const data = await fetchTrainingData(session.user.id)
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
    } catch (error) {
      setErrorMessage(errorText(error))
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(timer)
  }, [reload])

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
    reload,
  }
}
