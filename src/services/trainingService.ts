import { addDays, mondayFor, todayIso } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type {
  AttendanceRecord,
  Match,
  MatchAvailability,
  MatchLineup,
  Profile,
  Season,
  SeasonPlayer,
  SeasonValues,
  TaskResult,
  TrainingSession,
  TrainingTask,
  ViewName,
} from '../types'

export type TrainingData = {
  profile: Profile
  seasons: Season[]
  memberships: SeasonPlayer[]
  profiles: Profile[]
  tasks: TrainingTask[]
  results: TaskResult[]
  trainingSessions: TrainingSession[]
  attendance: AttendanceRecord[]
  matches: Match[]
  matchAvailability: MatchAvailability[]
  matchLineups: MatchLineup[]
}

export function dataRequirementsFor(scope: ViewName, canManageTasks: boolean) {
  const tasks = scope === 'home' || scope === 'tasks' || scope === 'statistics'
  return {
    tasks,
    results: tasks,
    memberships: ['home', 'tasks', 'matches', 'statistics', 'settings'].includes(scope),
    profiles: scope === 'matches'
      || scope === 'statistics'
      || scope === 'attendance'
      || scope === 'settings'
      || (scope === 'tasks' && canManageTasks),
    attendance: scope === 'home' || scope === 'statistics' || scope === 'attendance',
    matches: scope === 'matches',
    seasons: scope !== 'competition' && scope !== 'attendance',
  }
}

export async function fetchTrainingData(userId: string, scope: ViewName = 'home'): Promise<TrainingData> {
  const { data: ownProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, is_approved, is_active, is_collaborator, is_owner, is_archived, created_at')
    .eq('id', userId)
    .single()

  if (profileError) throw profileError
  const profile = ownProfile as Profile
  const emptyData = {
    profile,
    seasons: [],
    memberships: [],
    profiles: [],
    tasks: [],
    results: [],
    trainingSessions: [],
    attendance: [],
    matches: [],
    matchAvailability: [],
    matchLineups: [],
  }
  if (!profile.is_approved || profile.is_archived) return emptyData

  const canManageTasks = profile.is_owner || profile.is_collaborator
  const requirements = dataRequirementsFor(scope, canManageTasks)
  const needsSessions = profile.is_owner && (scope === 'statistics' || scope === 'attendance')
  const currentWeek = mondayFor(new Date())

  let tasksQuery = supabase
      .from('tasks')
      .select('id, season_id, week_start, title, description, training_type, status, created_by, created_at, seasons(name)')
      .order('week_start', { ascending: false })
  if (scope === 'home') tasksQuery = tasksQuery.eq('week_start', currentWeek)

  let resultsQuery = supabase.from('task_results').select('*')
  if (scope === 'home' || !canManageTasks) resultsQuery = resultsQuery.eq('player_id', userId)
  if (scope === 'home') resultsQuery = resultsQuery.gte('performed_on', currentWeek).lte('performed_on', addDays(currentWeek, 6))

  let attendanceQuery = supabase
      .from('training_attendance')
      .select('session_id, player_id, attended, marked_by, updated_at, training_sessions(session_date)')
      .order('updated_at', { ascending: false })
  if (scope === 'home') attendanceQuery = attendanceQuery.eq('player_id', userId)

  const emptyResponse = Promise.resolve({ data: [], error: null })
  const [seasonsResponse, tasksResponse, resultsResponse, membershipsResponse, attendanceResponse, matchesResponse, availabilityResponse, lineupsResponse, profilesResponse, sessionsResponse] = await Promise.all([
    requirements.seasons ? supabase.from('seasons').select('*').order('start_date', { ascending: false }) : emptyResponse,
    requirements.tasks ? tasksQuery : emptyResponse,
    requirements.results ? resultsQuery : emptyResponse,
    requirements.memberships ? supabase.from('season_players').select('*') : emptyResponse,
    requirements.attendance ? attendanceQuery : emptyResponse,
    requirements.matches ? supabase.from('matches').select('*, seasons(name)').order('match_date', { ascending: true }) : emptyResponse,
    requirements.matches ? supabase.from('match_availability').select('*') : emptyResponse,
    requirements.matches ? supabase.from('match_lineup').select('*').order('sort_order') : emptyResponse,
    requirements.profiles
      ? supabase
        .from('profiles')
        .select('id, display_name, is_approved, is_active, is_collaborator, is_owner, is_archived, created_at')
        .order('display_name')
      : emptyResponse,
    needsSessions ? supabase.from('training_sessions').select('*').order('session_date', { ascending: false }) : emptyResponse,
  ])

  if (seasonsResponse.error) throw seasonsResponse.error
  if (tasksResponse.error) throw tasksResponse.error
  if (resultsResponse.error) throw resultsResponse.error
  if (membershipsResponse.error) throw membershipsResponse.error
  if (attendanceResponse.error) throw attendanceResponse.error
  if (matchesResponse.error) throw matchesResponse.error
  if (availabilityResponse.error) throw availabilityResponse.error
  if (lineupsResponse.error) throw lineupsResponse.error
  if (profilesResponse.error) throw profilesResponse.error
  if (sessionsResponse.error) throw sessionsResponse.error

  return {
    profile,
    seasons: (seasonsResponse.data ?? []) as Season[],
    tasks: (tasksResponse.data ?? []) as unknown as TrainingTask[],
    results: (resultsResponse.data ?? []) as TaskResult[],
    memberships: (membershipsResponse.data ?? []) as SeasonPlayer[],
    profiles: (profilesResponse.data ?? []) as Profile[],
    trainingSessions: (sessionsResponse.data ?? []) as TrainingSession[],
    attendance: (attendanceResponse.data ?? []) as unknown as AttendanceRecord[],
    matches: (matchesResponse.data ?? []) as unknown as Match[],
    matchAvailability: (availabilityResponse.data ?? []) as MatchAvailability[],
    matchLineups: (lineupsResponse.data ?? []) as MatchLineup[],
  }
}

export async function createSeason(values: SeasonValues, userId: string) {
  const { error } = await supabase.from('seasons').insert({
    ...values,
    name: values.name.trim(),
    created_by: userId,
  })
  if (error) throw error
}

export async function updateProfilePermissions(profile: Profile) {
  const { error } = await supabase
    .from('profiles')
    .update({
      is_approved: profile.is_approved,
      is_active: profile.is_active,
      is_collaborator: profile.is_collaborator,
      is_owner: profile.is_owner,
      is_archived: profile.is_archived,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
  if (error) throw error
}

export async function saveTrainingAttendance(
  attendanceDate: string,
  playerIds: string[],
  attendedPlayerIds: string[],
  userId: string,
) {
  const now = new Date().toISOString()
  const { data: session, error: sessionError } = await supabase
    .from('training_sessions')
    .upsert(
      { session_date: attendanceDate, created_by: userId, updated_at: now },
      { onConflict: 'session_date' },
    )
    .select('id')
    .single()

  if (sessionError) throw sessionError
  if (!playerIds.length) return

  const attended = new Set(attendedPlayerIds)
  const rows = playerIds.map((playerId) => ({
    session_id: session.id,
    player_id: playerId,
    attended: attended.has(playerId),
    marked_by: userId,
    updated_at: now,
  }))
  const { error } = await supabase
    .from('training_attendance')
    .upsert(rows, { onConflict: 'session_id,player_id' })
  if (error) throw error
}

export async function setSeasonMembership(
  season: Season,
  player: Profile,
  active: boolean,
  existing?: SeasonPlayer,
) {
  if (active) {
    if (existing) return
    const activeFrom = todayIso() < season.start_date ? season.start_date : todayIso() > season.end_date ? season.end_date : todayIso()
    const activeUntil = todayIso() > season.end_date ? season.end_date : null
    const { error } = await supabase.from('season_players').insert({
      season_id: season.id,
      player_id: player.id,
      active_from: activeFrom,
      active_until: activeUntil,
    })
    if (error) throw error
    return
  }

  if (!active && existing) {
    const activeUntil = todayIso() < existing.active_from ? existing.active_from : todayIso()
    const { error } = await supabase
      .from('season_players')
      .update({ active_until: activeUntil })
      .eq('id', existing.id)
    if (error) throw error
  }
}
