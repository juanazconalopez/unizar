import { addDays, mondayFor, monthEnd, monthStart, offsetMonth, todayIso } from '../lib/dates'
import { canManageSport, canViewTeamData } from '../lib/permissions'
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
  TeamAnnouncement,
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
  announcements?: TeamAnnouncement[]
}

export function dataRequirementsFor(scope: ViewName, canManageTasks: boolean) {
  const tasks = scope === 'home' || scope === 'tasks' || scope === 'statistics'
  return {
    tasks,
    results: tasks,
    memberships: ['home', 'tasks', 'matches', 'statistics', 'attendance', 'settings'].includes(scope),
    profiles: scope === 'matches'
      || scope === 'statistics'
      || scope === 'attendance'
      || scope === 'settings'
      || (scope === 'tasks' && canManageTasks),
    attendance: scope === 'home' || scope === 'statistics' || scope === 'attendance',
    matches: scope === 'home' || scope === 'matches',
    announcements: scope === 'home' || scope === 'tasks',
    seasons: scope !== 'competition',
  }
}

type TaskWindowData = Pick<TrainingData, 'tasks' | 'results'> & { announcements?: TeamAnnouncement[] }
type AttendanceWindowData = Pick<TrainingData, 'trainingSessions' | 'attendance'>
type MatchWindowData = Pick<TrainingData, 'matches' | 'matchAvailability' | 'matchLineups'>

const emptyTaskWindow: TaskWindowData = { tasks: [], results: [], announcements: [] }
const emptyAttendanceWindow: AttendanceWindowData = { trainingSessions: [], attendance: [] }
const emptyMatchWindow: MatchWindowData = { matches: [], matchAvailability: [], matchLineups: [] }

/** Loads task results only for the tasks in the requested week window. */
export async function fetchTaskWindow(
  userId: string,
  canManageTasks: boolean,
  fromWeek: string,
  toWeek: string,
): Promise<TaskWindowData> {
  const [tasksResponse, announcementsResponse] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, season_id, week_start, title, description, training_type, status, created_by, created_at, seasons(name)')
      .gte('week_start', fromWeek)
      .lte('week_start', toWeek)
      .order('week_start', { ascending: false }),
    fetchAnnouncementWindow(fromWeek, addDays(toWeek, 6)),
  ])
  const { data: taskRows, error: tasksError } = tasksResponse
  if (tasksError) throw tasksError

  const tasks = taskRows ?? []
  if (!tasks.length) return { ...emptyTaskWindow, announcements: announcementsResponse }
  let resultsQuery = supabase.from('task_results').select('*').in('task_id', tasks.map((task) => task.id))
  if (!canManageTasks) resultsQuery = resultsQuery.eq('player_id', userId)
  const { data: resultRows, error: resultsError } = await resultsQuery
  if (resultsError) throw resultsError
  return { tasks, results: resultRows ?? [], announcements: announcementsResponse }
}

export async function fetchAnnouncementWindow(fromDate: string, toDate: string): Promise<TeamAnnouncement[]> {
  const { data, error } = await supabase
    .from('team_announcements')
    .select('*, seasons(name)')
    .gte('announcement_date', fromDate)
    .lte('announcement_date', toDate)
    .order('announcement_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

async function fetchHomeAttention(today: string, seasonEnd: string) {
  const [matchesResponse, announcementsResponse] = await Promise.all([
    supabase
      .from('matches')
      .select('*, seasons(name)')
      .eq('status', 'published')
      .gte('match_date', today)
      .order('match_date', { ascending: true })
      .limit(1),
    supabase
      .from('team_announcements')
      .select('*, seasons(name)')
      .eq('status', 'published')
      .gte('announcement_date', today)
      .lte('announcement_date', seasonEnd)
      .order('announcement_date', { ascending: true })
      .limit(4),
  ])
  if (matchesResponse.error) throw matchesResponse.error
  if (announcementsResponse.error) throw announcementsResponse.error
  return { matches: matchesResponse.data ?? [], announcements: announcementsResponse.data ?? [] }
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
  return { trainingSessions: sessionRows, attendance: data ?? [] }
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
  const attendanceData = await fetchAttendanceForSessions(sessionsResponse.data ?? [])
  return { ...taskData, ...attendanceData }
}

export async function fetchAttendanceDate(date: string): Promise<AttendanceWindowData> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('session_date', date)
    .order('session_date', { ascending: false })
  if (error) throw error
  return fetchAttendanceForSessions(data ?? [])
}

async function fetchRecentAttendance(): Promise<AttendanceWindowData> {
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*')
    .order('session_date', { ascending: false })
    .limit(5)
  if (error) throw error
  return fetchAttendanceForSessions(data ?? [])
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
  const matches = matchRows ?? []
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
    matchAvailability: availabilityResponse.data ?? [],
    matchLineups: lineupsResponse.data ?? [],
  }
}

export async function fetchTrainingData(userId: string, scope: ViewName = 'home'): Promise<TrainingData> {
  const { data: ownProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, is_approved, is_active, is_player, is_coach, is_viewer, is_owner, is_archived, created_at')
    .eq('id', userId)
    .single()

  if (profileError) throw profileError
  const profile = ownProfile
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
    announcements: [],
  }
  if (!profile.is_approved || profile.is_archived) return emptyData

  const canManageTasks = canManageSport(profile)
  const requirements = dataRequirementsFor(scope, canManageTasks)
  const currentWeek = mondayFor(new Date())

  const emptyResponse = Promise.resolve({ data: [], error: null })
  const [seasonsResponse, membershipsResponse, profilesResponse] = await Promise.all([
    requirements.seasons ? supabase.from('seasons').select('*').order('start_date', { ascending: false }) : emptyResponse,
    requirements.memberships ? supabase.from('season_players').select('*') : emptyResponse,
    requirements.profiles
      ? supabase
        .from('profiles')
        .select('id, display_name, is_approved, is_active, is_player, is_coach, is_viewer, is_owner, is_archived, created_at')
        .order('display_name')
      : emptyResponse,
  ])

  if (seasonsResponse.error) throw seasonsResponse.error
  if (membershipsResponse.error) throw membershipsResponse.error
  if (profilesResponse.error) throw profilesResponse.error

  const seasons = seasonsResponse.data ?? []
  let taskData = emptyTaskWindow
  let attendanceData = emptyAttendanceWindow
  let matchData = emptyMatchWindow

  if (scope === 'home') {
    taskData = await fetchTaskWindow(userId, false, currentWeek, currentWeek)
    const activeSeason = seasons.find((season) => season.start_date <= todayIso() && season.end_date >= todayIso())
    if (activeSeason) {
      const attention = await fetchHomeAttention(todayIso(), activeSeason.end_date)
      taskData.announcements = attention.announcements
      matchData = { ...emptyMatchWindow, matches: attention.matches }
    }
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
      attendanceData = await fetchAttendanceForSessions(data ?? [], userId)
    }
  } else if (scope === 'tasks') {
    const start = addDays(currentWeek, -14)
    const activeSeason = seasons.find((season) => season.start_date <= todayIso() && season.end_date >= todayIso())
    const managerEnd = activeSeason?.end_date && activeSeason.end_date >= currentWeek
      ? mondayFor(activeSeason.end_date)
      : addDays(currentWeek, 84)
    taskData = await fetchTaskWindow(userId, canManageTasks, start, canManageTasks ? managerEnd : currentWeek)
  } else if (scope === 'statistics' && canViewTeamData(profile)) {
    const statisticsData = await fetchStatisticsWindow(monthStart(todayIso()))
    taskData = statisticsData
    attendanceData = statisticsData
  } else if (scope === 'attendance' && canManageSport(profile)) {
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
    memberships: membershipsResponse.data ?? [],
    profiles: profilesResponse.data ?? [],
    trainingSessions: attendanceData.trainingSessions,
    attendance: attendanceData.attendance,
    matches: matchData.matches,
    matchAvailability: matchData.matchAvailability,
    matchLineups: matchData.matchLineups,
    announcements: taskData.announcements,
  }
}

export async function createSeason(values: SeasonValues, userId: string) {
  await validateSeasonChange(values)
  const { error } = await supabase.from('seasons').insert({
    ...values,
    name: values.name.trim(),
    created_by: userId,
  })
  if (error) throw error
}

export async function updateSeason(seasonId: string, values: SeasonValues) {
  await validateSeasonChange(values, seasonId)
  const [tasksResponse, matchesResponse, sessionsResponse, announcementsResponse] = await Promise.all([
    supabase
      .from('tasks')
      .select('title, week_start')
      .eq('season_id', seasonId)
      .or(`week_start.lt.${values.start_date},week_start.gt.${addDays(values.end_date, -6)}`)
      .limit(1),
    supabase
      .from('matches')
      .select('opponent, match_date')
      .eq('season_id', seasonId)
      .or(`match_date.lt.${values.start_date},match_date.gt.${values.end_date}`)
      .limit(1),
    supabase
      .from('training_sessions')
      .select('session_date')
      .eq('season_id', seasonId)
      .or(`session_date.lt.${values.start_date},session_date.gt.${values.end_date}`)
      .limit(1),
    supabase
      .from('team_announcements')
      .select('title, announcement_date')
      .eq('season_id', seasonId)
      .or(`announcement_date.lt.${values.start_date},announcement_date.gt.${values.end_date}`)
      .limit(1),
  ])
  if (tasksResponse.error) throw tasksResponse.error
  if (matchesResponse.error) throw matchesResponse.error
  if (sessionsResponse.error) throw sessionsResponse.error
  if (announcementsResponse.error) throw announcementsResponse.error
  const invalidTask = tasksResponse.data?.[0]
  const invalidMatch = matchesResponse.data?.[0]
  const invalidSession = sessionsResponse.data?.[0]
  const invalidAnnouncement = announcementsResponse.data?.[0]
  if (invalidTask) {
    throw new Error(`No se pueden aplicar esas fechas porque la tarea “${invalidTask.title}” está programada el ${invalidTask.week_start}.`)
  }
  if (invalidMatch) {
    throw new Error(`No se pueden aplicar esas fechas porque el partido contra ${invalidMatch.opponent} está programado el ${invalidMatch.match_date}.`)
  }
  if (invalidSession) {
    throw new Error(`No se pueden aplicar esas fechas porque hay un entrenamiento de campo registrado el ${invalidSession.session_date}.`)
  }
  if (invalidAnnouncement) {
    throw new Error(`No se pueden aplicar esas fechas porque el aviso “${invalidAnnouncement.title}” está programado el ${invalidAnnouncement.announcement_date}.`)
  }

  const { error } = await supabase
    .from('seasons')
    .update({
      name: values.name.trim(),
      start_date: values.start_date,
      end_date: values.end_date,
    })
    .eq('id', seasonId)
  if (error) throw error
}

export async function deleteSeason(seasonId: string) {
  const { error } = await supabase.from('seasons').delete().eq('id', seasonId)
  if (error) throw error
}

async function validateSeasonChange(values: SeasonValues, excludedSeasonId?: string) {
  if (!values.name.trim()) throw new Error('Escribe un nombre para la temporada.')
  if (!values.start_date || !values.end_date) throw new Error('Indica las fechas de inicio y finalización.')
  if (values.end_date < values.start_date) throw new Error('La fecha de finalización no puede ser anterior a la de inicio.')

  let overlapQuery = supabase
    .from('seasons')
    .select('id, name')
    .lte('start_date', values.end_date)
    .gte('end_date', values.start_date)
    .limit(1)
  if (excludedSeasonId) overlapQuery = overlapQuery.neq('id', excludedSeasonId)
  const { data, error } = await overlapQuery
  if (error) throw error
  if (data?.length) throw new Error(`Las fechas se solapan con “${data[0].name}”. Solo puede haber una temporada activa en cada fecha.`)
}

export async function updateProfilePermissions(profile: Profile) {
  const { error } = await supabase
    .from('profiles')
    .update({
      is_approved: profile.is_approved,
      is_active: profile.is_active,
      is_player: profile.is_player,
      is_coach: profile.is_coach,
      is_viewer: profile.is_viewer,
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
) {
  const { error } = await supabase.rpc('save_training_attendance', {
    attendance_date: attendanceDate,
    checked_player_ids: playerIds,
    attended_player_ids: attendedPlayerIds,
  })
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
    const candidateEnd = todayIso() < existing.active_from ? existing.active_from : todayIso()
    const activeUntil = candidateEnd > season.end_date ? season.end_date : candidateEnd
    const { error } = await supabase
      .from('season_players')
      .update({ active_until: activeUntil })
      .eq('id', existing.id)
    if (error) throw error
  }
}
