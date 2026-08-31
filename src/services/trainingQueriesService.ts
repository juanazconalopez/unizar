import { addDays, mondayFor, monthEnd, monthStart, offsetMonth } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type {
  AttendanceRecord,
  Match,
  MatchAvailability,
  MatchLineup,
  TaskResult,
  TeamAnnouncement,
  TrainingSession,
  TrainingTask,
  ViewName,
} from '../types'

export type TaskWindowData = { tasks: TrainingTask[]; results: TaskResult[]; announcements?: TeamAnnouncement[] }
export type AttendanceWindowData = { trainingSessions: TrainingSession[]; attendance: AttendanceRecord[] }
export type MatchWindowData = { matches: Match[]; matchAvailability: MatchAvailability[]; matchLineups: MatchLineup[] }

export const emptyTaskWindow: TaskWindowData = { tasks: [], results: [], announcements: [] }
export const emptyAttendanceWindow: AttendanceWindowData = { trainingSessions: [], attendance: [] }
export const emptyMatchWindow: MatchWindowData = { matches: [], matchAvailability: [], matchLineups: [] }

export function dataRequirementsFor(scope: ViewName, canViewTeam: boolean) {
  const tasks = scope === 'home' || scope === 'calendar' || scope === 'tasks' || scope === 'statistics'
  return {
    tasks,
    results: tasks,
    memberships: ['home', 'calendar', 'tasks', 'matches', 'statistics', 'attendance', 'settings'].includes(scope),
    profiles: scope === 'calendar'
      || scope === 'matches'
      || scope === 'statistics'
      || scope === 'attendance'
      || scope === 'settings'
      || ((scope === 'home' || scope === 'tasks') && canViewTeam),
    attendance: scope === 'home' || scope === 'statistics' || scope === 'attendance',
    matches: scope === 'home' || scope === 'calendar' || scope === 'matches',
    announcements: scope === 'home' || scope === 'calendar' || scope === 'tasks',
    seasons: scope !== 'competition',
  }
}

export async function fetchTaskWindow(userId: string, canManageTasks: boolean, fromWeek: string, toWeek: string): Promise<TaskWindowData> {
  const [tasksResponse, announcements] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, season_id, week_start, title, description, training_type, sort_order, status, created_by, created_at, seasons(name)')
      .gte('week_start', fromWeek)
      .lte('week_start', toWeek)
      .order('week_start', { ascending: false }),
    fetchAnnouncementWindow(fromWeek, addDays(toWeek, 6)),
  ])
  if (tasksResponse.error) throw tasksResponse.error
  const tasks = tasksResponse.data ?? []
  if (!tasks.length) return { ...emptyTaskWindow, announcements }
  let resultsQuery = supabase.from('task_results').select('*').in('task_id', tasks.map((task) => task.id))
  if (!canManageTasks) resultsQuery = resultsQuery.eq('player_id', userId)
  const { data, error } = await resultsQuery
  if (error) throw error
  return { tasks, results: data ?? [], announcements }
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

export async function fetchHomeAttention(today: string, seasonEnd: string) {
  const announcementEnd = homeAgendaEnd(today, seasonEnd)
  const [matchesResponse, announcementsResponse] = await Promise.all([
    supabase.from('matches').select('*, seasons(name)').eq('status', 'published').gte('match_date', today).order('match_date', { ascending: true }).limit(1),
    supabase.from('team_announcements').select('*, seasons(name)').eq('status', 'published').gte('announcement_date', today).lte('announcement_date', announcementEnd).order('announcement_date', { ascending: true }).limit(4),
  ])
  if (matchesResponse.error) throw matchesResponse.error
  if (announcementsResponse.error) throw announcementsResponse.error
  return { matches: matchesResponse.data ?? [], announcements: announcementsResponse.data ?? [] }
}

export function homeAgendaEnd(today: string, seasonEnd: string) {
  const endOfNextWeek = addDays(mondayFor(today), 13)
  return seasonEnd < endOfNextWeek ? seasonEnd : endOfNextWeek
}

export async function fetchAttendanceForSessions(sessionRows: TrainingSession[], playerId?: string): Promise<AttendanceWindowData> {
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

export async function fetchStatisticsWindow(month: string): Promise<TaskWindowData & AttendanceWindowData> {
  const fromDate = offsetMonth(monthStart(month), -1)
  const toDate = monthEnd(month)
  const [taskData, sessionsResponse] = await Promise.all([
    fetchTaskWindow('', true, mondayFor(fromDate), mondayFor(toDate)),
    supabase.from('training_sessions').select('*').gte('session_date', fromDate).lte('session_date', toDate).order('session_date', { ascending: false }),
  ])
  if (sessionsResponse.error) throw sessionsResponse.error
  return { ...taskData, ...await fetchAttendanceForSessions(sessionsResponse.data ?? []) }
}

export async function fetchAttendanceDate(date: string): Promise<AttendanceWindowData> {
  const { data, error } = await supabase.from('training_sessions').select('*').eq('session_date', date).order('session_date', { ascending: false })
  if (error) throw error
  return fetchAttendanceForSessions(data ?? [])
}

export async function fetchRecentAttendance(): Promise<AttendanceWindowData> {
  const { data, error } = await supabase.from('training_sessions').select('*').order('session_date', { ascending: false }).limit(5)
  if (error) throw error
  return fetchAttendanceForSessions(data ?? [])
}

export async function fetchMatchWindow(fromDate: string, toDate?: string): Promise<MatchWindowData> {
  let query = supabase.from('matches').select('*, seasons(name)').gte('match_date', fromDate).order('match_date', { ascending: true })
  if (toDate) query = query.lte('match_date', toDate)
  const { data, error } = await query
  if (error) throw error
  const matches = data ?? []
  if (!matches.length) return emptyMatchWindow
  const matchIds = matches.map((match) => match.id)
  const [availabilityResponse, lineupsResponse] = await Promise.all([
    supabase.from('match_availability').select('*').in('match_id', matchIds),
    supabase.from('match_lineup').select('*').in('match_id', matchIds).order('sort_order'),
  ])
  if (availabilityResponse.error) throw availabilityResponse.error
  if (lineupsResponse.error) throw lineupsResponse.error
  return { matches, matchAvailability: availabilityResponse.data ?? [], matchLineups: lineupsResponse.data ?? [] }
}
