import { addDays, mondayFor, monthEnd, monthStart, offsetMonth, todayIso } from '../lib/dates'
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

type TaskWindowData = Pick<TrainingData, 'tasks' | 'results'>
type AttendanceWindowData = Pick<TrainingData, 'trainingSessions' | 'attendance'>
type MatchWindowData = Pick<TrainingData, 'matches' | 'matchAvailability' | 'matchLineups'>

const emptyTaskWindow: TaskWindowData = { tasks: [], results: [] }
const emptyAttendanceWindow: AttendanceWindowData = { trainingSessions: [], attendance: [] }
const emptyMatchWindow: MatchWindowData = { matches: [], matchAvailability: [], matchLineups: [] }

/** Loads task results only for the tasks in the requested week window. */
export async function fetchTaskWindow(
  userId: string,
  canManageTasks: boolean,
  fromWeek: string,
  toWeek: string,
): Promise<TaskWindowData> {
  const { data: taskRows, error: tasksError } = await supabase
    .from('tasks')
    .select('id, season_id, week_start, title, description, training_type, status, created_by, created_at, seasons(name)')
    .gte('week_start', fromWeek)
    .lte('week_start', toWeek)
    .order('week_start', { ascending: false })
  if (tasksError) throw tasksError

  const tasks = (taskRows ?? []) as unknown as TrainingTask[]
  if (!tasks.length) return emptyTaskWindow
  let resultsQuery = supabase.from('task_results').select('*').in('task_id', tasks.map((task) => task.id))
  if (!canManageTasks) resultsQuery = resultsQuery.eq('player_id', userId)
  const { data: resultRows, error: resultsError } = await resultsQuery
  if (resultsError) throw resultsError
  return { tasks, results: (resultRows ?? []) as TaskResult[] }
}

async function fetchAttendanceForSessions(sessionRows: TrainingSession[], playerId?: string): Promise<AttendanceWindowData> {
  if (!sessionRows.length) return emptyAttendanceWindow
  let query = supabase
    .from('training_attendance')
    .select('session_id, player_id, attended, marked_by, updated_at, training_sessions(session_date)')
    .in('session_id', sessionRows.map((session) => session.id))
    .order('updated_at', { ascending: false })
  if (playerId) query = query.eq('player_id', playerId)
  const { data, error } = await query
  if (error) throw error
  return { trainingSessions: sessionRows, attendance: (data ?? []) as unknown as AttendanceRecord[] }
}

/** Loads one calendar month plus the preceding month used by the comparison card. */
export async function fetchStatisticsWindow(month: string): Promise<TaskWindowData & AttendanceWindowData> {
  const fromDate = offsetMonth(monthStart(month), -1)
  const toDate = monthEnd(month)
  const [taskData, sessionsResponse] = await Promise.all([
    // Results are associated by task id, so completions near a month boundary are not lost.
    fetchTaskWindow('', true, mondayFor(fromDate), mondayFor(toDate)),
    supabase
      .from('training_sessions')
      .select('*')
      .gte('session_date', fromDate)
      .lte('session_date', toDate)
      .order('session_date', { ascending: false }),
  ])
  if (sessionsResponse.error) throw sessionsResponse.error
  const attendanceData = await fetchAttendanceForSessions((sessionsResponse.data ?? []) as TrainingSession[])
  return { ...taskData, ...attendanceData }
}

export async function fetchAttendanceDate(date: string): Promise<AttendanceWindowData> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('session_date', date)
    .order('session_date', { ascending: false })
  if (error) throw error
  return fetchAttendanceForSessions((data ?? []) as TrainingSession[])
}

async function fetchRecentAttendance(): Promise<AttendanceWindowData> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .order('session_date', { ascending: false })
    .limit(5)
  if (error) throw error
  return fetchAttendanceForSessions((data ?? []) as TrainingSession[])
}

/** Loads availability and lineups only for matches in the requested date range. */
export async function fetchMatchWindow(fromDate: string, toDate?: string): Promise<MatchWindowData> {
  let query = supabase
    .from('matches')
    .select('*, seasons(name)')
    .gte('match_date', fromDate)
    .order('match_date', { ascending: true })
  if (toDate) query = query.lte('match_date', toDate)
  const { data: matchRows, error: matchesError } = await query
  if (matchesError) throw matchesError
  const matches = (matchRows ?? []) as unknown as Match[]
  if (!matches.length) return emptyMatchWindow
  const matchIds = matches.map((match) => match.id)
  const [availabilityResponse, lineupsResponse] = await Promise.all([
    supabase.from('match_availability').select('*').in('match_id', matchIds),
    supabase.from('match_lineup').select('*').in('match_id', matchIds).order('sort_order'),
  ])
  if (availabilityResponse.error) throw availabilityResponse.error
  if (lineupsResponse.error) throw lineupsResponse.error
  return {
    matches,
    matchAvailability: (availabilityResponse.data ?? []) as MatchAvailability[],
    matchLineups: (lineupsResponse.data ?? []) as MatchLineup[],
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
  const currentWeek = mondayFor(new Date())

  const emptyResponse = Promise.resolve({ data: [], error: null })
  const [seasonsResponse, membershipsResponse, profilesResponse] = await Promise.all([
    requirements.seasons ? supabase.from('seasons').select('*').order('start_date', { ascending: false }) : emptyResponse,
    requirements.memberships ? supabase.from('season_players').select('*') : emptyResponse,
    requirements.profiles
      ? supabase
        .from('profiles')
        .select('id, display_name, is_approved, is_active, is_collaborator, is_owner, is_archived, created_at')
        .order('display_name')
      : emptyResponse,
  ])

  if (seasonsResponse.error) throw seasonsResponse.error
  if (membershipsResponse.error) throw membershipsResponse.error
  if (profilesResponse.error) throw profilesResponse.error

  const seasons = (seasonsResponse.data ?? []) as Season[]
  let taskData = emptyTaskWindow
  let attendanceData = emptyAttendanceWindow
  let matchData = emptyMatchWindow

  if (scope === 'home') {
    taskData = await fetchTaskWindow(userId, false, currentWeek, currentWeek)
    // The home percentage is seasonal, not a lifetime download across every season.
    const dashboardSeason = seasons.find((season) => season.start_date <= todayIso() && season.end_date >= todayIso()) ?? seasons[0]
    if (dashboardSeason) {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .gte('session_date', dashboardSeason.start_date)
        .lte('session_date', dashboardSeason.end_date)
        .order('session_date', { ascending: false })
      if (error) throw error
      attendanceData = await fetchAttendanceForSessions((data ?? []) as TrainingSession[], userId)
    }
  } else if (scope === 'tasks') {
    const start = addDays(currentWeek, -14)
    const activeSeason = seasons.find((season) => season.start_date <= todayIso() && season.end_date >= todayIso())
    const managerEnd = activeSeason?.end_date && activeSeason.end_date >= currentWeek
      ? mondayFor(activeSeason.end_date)
      : addDays(currentWeek, 84)
    taskData = await fetchTaskWindow(userId, canManageTasks, start, canManageTasks ? managerEnd : currentWeek)
  } else if (scope === 'statistics' && profile.is_owner) {
    const statisticsData = await fetchStatisticsWindow(monthStart(todayIso()))
    taskData = statisticsData
    attendanceData = statisticsData
  } else if (scope === 'attendance' && profile.is_owner) {
    attendanceData = await fetchRecentAttendance()
  } else if (scope === 'matches') {
    // Keep the list useful while excluding completed seasons; older months load on demand.
    matchData = await fetchMatchWindow(monthStart(todayIso()))
  }

  return {
    profile,
    seasons,
    tasks: taskData.tasks,
    results: taskData.results,
    memberships: (membershipsResponse.data ?? []) as SeasonPlayer[],
    profiles: (profilesResponse.data ?? []) as Profile[],
    trainingSessions: attendanceData.trainingSessions,
    attendance: attendanceData.attendance,
    matches: matchData.matches,
    matchAvailability: matchData.matchAvailability,
    matchLineups: matchData.matchLineups,
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
