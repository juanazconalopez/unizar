import { addDays, mondayFor, monthEnd, monthStart, todayIso } from '../lib/dates'
import { canManageSport, canViewTeamData } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import type {
  AttendanceRecord, Match, MatchAvailability, MatchLineup, Profile, ProfilePrivateDetails, ProvisionalAttendanceRecord, ProvisionalPlayer,
  Season, SeasonBirthday, SeasonPlayer, TaskResult, TeamAnnouncement, TodayBirthday,
  TrainingSession, TrainingTask, ViewName,
} from '../types'
import { fetchActiveSeasonBirthdays, fetchTodayBirthdays } from './birthdayService'
import { fetchAllProvisionalAttendance, fetchUnlinkedProvisionalPlayers } from './provisionalPlayersService'
import {
  dataRequirementsFor, emptyAttendanceWindow, emptyMatchWindow, emptyTaskWindow,
  fetchAttendanceForSessions, fetchHomeAttention, fetchMatchWindow, fetchRecentAttendance,
  fetchStatisticsWindow, fetchTaskWindow,
} from './trainingQueriesService'

export type TrainingData = {
  profile: Profile
  ownProfileDetails: ProfilePrivateDetails | null
  profilePrivateDetails: ProfilePrivateDetails[]
  seasons: Season[]
  memberships: SeasonPlayer[]
  profiles: Profile[]
  tasks: TrainingTask[]
  results: TaskResult[]
  trainingSessions: TrainingSession[]
  attendance: AttendanceRecord[]
  provisionalPlayers: ProvisionalPlayer[]
  provisionalAttendance: ProvisionalAttendanceRecord[]
  matches: Match[]
  matchAvailability: MatchAvailability[]
  matchLineups: MatchLineup[]
  announcements?: TeamAnnouncement[]
  todayBirthdays: TodayBirthday[]
  seasonBirthdays: SeasonBirthday[]
}

export async function fetchTrainingData(userId: string, scope: ViewName = 'home'): Promise<TrainingData> {
  const [profileResponse, ownDetailsResponse] = await Promise.all([
    supabase.from('profiles').select('id, display_name, avatar_path, is_approved, is_active, is_player, is_coach, is_viewer, is_owner, is_archived, created_at').eq('id', userId).single(),
    supabase.from('profile_private_details').select('profile_id, email, phone, birth_date').eq('profile_id', userId).maybeSingle(),
  ])
  if (profileResponse.error) throw profileResponse.error
  if (ownDetailsResponse.error) throw ownDetailsResponse.error
  const profile = profileResponse.data
  const emptyData: TrainingData = {
    profile, ownProfileDetails: ownDetailsResponse.data, profilePrivateDetails: [], seasons: [], memberships: [], profiles: [],
    tasks: [], results: [], trainingSessions: [], attendance: [], provisionalPlayers: [], provisionalAttendance: [], matches: [], matchAvailability: [], matchLineups: [],
    announcements: [], todayBirthdays: [], seasonBirthdays: [],
  }
  if (!profile.is_approved || profile.is_archived) return emptyData

  const canManageTasks = canManageSport(profile)
  const canViewTeam = canViewTeamData(profile)
  const requirements = dataRequirementsFor(scope, canViewTeam)
  const currentWeek = mondayFor(new Date())
  const emptyResponse = Promise.resolve({ data: [], error: null })
  const [seasonsResponse, membershipsResponse, profilesResponse, privateDetailsResponse, provisionalPlayers, settingsProvisionalAttendance] = await Promise.all([
    requirements.seasons ? supabase.from('seasons').select('*').order('start_date', { ascending: false }) : emptyResponse,
    requirements.memberships ? supabase.from('season_players').select('*') : emptyResponse,
    requirements.profiles
      ? supabase.from('profiles').select('id, display_name, avatar_path, is_approved, is_active, is_player, is_coach, is_viewer, is_owner, is_archived, created_at').order('display_name')
      : emptyResponse,
    scope === 'settings' ? supabase.from('profile_private_details').select('profile_id, email, phone, birth_date').order('profile_id') : emptyResponse,
    requirements.provisionalPlayers ? fetchUnlinkedProvisionalPlayers() : Promise.resolve([]),
    scope === 'settings' ? fetchAllProvisionalAttendance() : Promise.resolve([]),
  ])
  if (seasonsResponse.error) throw seasonsResponse.error
  if (membershipsResponse.error) throw membershipsResponse.error
  if (profilesResponse.error) throw profilesResponse.error
  if (privateDetailsResponse.error) throw privateDetailsResponse.error

  const seasons = seasonsResponse.data ?? []
  let taskData = emptyTaskWindow
  let attendanceData = emptyAttendanceWindow
  let matchData = emptyMatchWindow
  let todayBirthdays: TodayBirthday[] = []
  let seasonBirthdays: SeasonBirthday[] = []

  if (scope === 'home') {
    todayBirthdays = await fetchTodayBirthdays(userId, todayIso())
    taskData = await fetchTaskWindow(userId, canViewTeam, currentWeek, currentWeek)
    const activeSeason = seasons.find((season) => season.start_date <= todayIso() && season.end_date >= todayIso())
    if (activeSeason) {
      const attention = await fetchHomeAttention(todayIso(), activeSeason.end_date)
      taskData.announcements = attention.announcements
      matchData = { ...emptyMatchWindow, matches: attention.matches }
    }
    const dashboardSeason = activeSeason ?? seasons[0]
    if (dashboardSeason) {
      const { data, error } = await supabase.from('training_sessions').select('*').gte('session_date', dashboardSeason.start_date).lte('session_date', dashboardSeason.end_date).order('session_date', { ascending: false })
      if (error) throw error
      attendanceData = await fetchAttendanceForSessions(data ?? [], userId)
    }
  } else if (scope === 'tasks' || scope === 'calendar') {
    const start = addDays(currentWeek, -14)
    const activeSeason = seasons.find((season) => season.start_date <= todayIso() && season.end_date >= todayIso())
    const managerEnd = activeSeason?.end_date && activeSeason.end_date >= currentWeek ? mondayFor(activeSeason.end_date) : addDays(currentWeek, 84)
    taskData = await fetchTaskWindow(userId, canManageTasks, start, canManageTasks ? managerEnd : currentWeek)
    if (scope === 'calendar') matchData = await fetchMatchWindow(monthStart(todayIso()), monthEnd(todayIso()))
  } else if (scope === 'statistics' && canViewTeam) {
    const statistics = await fetchStatisticsWindow(monthStart(todayIso()))
    taskData = statistics
    attendanceData = statistics
    const activeSeason = seasons.find((season) => season.start_date <= todayIso() && season.end_date >= todayIso())
    if (profile.is_owner && activeSeason) seasonBirthdays = await fetchActiveSeasonBirthdays(activeSeason.id, todayIso())
  } else if (scope === 'attendance' && canManageTasks) {
    attendanceData = await fetchRecentAttendance()
  } else if (scope === 'matches') {
    matchData = await fetchMatchWindow(monthStart(todayIso()))
  }

  return {
    profile, ownProfileDetails: ownDetailsResponse.data, profilePrivateDetails: privateDetailsResponse.data ?? [], seasons,
    memberships: membershipsResponse.data ?? [], profiles: profilesResponse.data ?? [], tasks: taskData.tasks,
    results: taskData.results, trainingSessions: attendanceData.trainingSessions, attendance: attendanceData.attendance,
    provisionalPlayers, provisionalAttendance: scope === 'settings' ? settingsProvisionalAttendance : attendanceData.provisionalAttendance,
    matches: matchData.matches, matchAvailability: matchData.matchAvailability, matchLineups: matchData.matchLineups,
    announcements: taskData.announcements, todayBirthdays, seasonBirthdays,
  }
}
