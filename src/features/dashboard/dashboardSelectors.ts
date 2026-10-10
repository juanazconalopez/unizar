import { addDays, mondayFor } from '../../lib/dates'
import { activePlayers, membershipCoversDate } from '../../lib/selectors'
import { compareTaskOrder } from '../../lib/taskOrder'
import { canUserCompleteTask } from '../../lib/tasks'
import type { AttendanceRecord, Match, Profile, Season, SeasonPlayer, TaskResult, TeamAnnouncement, TrainingSession, TrainingTask } from '../../types'

export type DashboardData = {
  isTeamDashboard: boolean
  today: string
  userId: string
  profiles: Profile[]
  memberships: SeasonPlayer[]
  tasks: TrainingTask[]
  results: TaskResult[]
  attendance: AttendanceRecord[]
  trainingSessions: TrainingSession[]
  announcements: TeamAnnouncement[]
  matches: Match[]
  season?: Season
}

export function selectDashboardSummary(data: DashboardData) {
  const currentMonday = mondayFor(data.today)
  const ownMemberships = data.isTeamDashboard ? [] : data.memberships.filter((membership) => membership.player_id === data.userId)
  const weekTasks = data.tasks.filter((task) => (
    task.week_start === currentMonday
    && task.status === 'published'
    && (data.isTeamDashboard || canUserCompleteTask(task, ownMemberships, data.userId))
  )).sort(compareTaskOrder)
  const taskIds = new Set(weekTasks.map((task) => task.id))
  const weekResults = data.results.filter((result) => taskIds.has(result.task_id))
  const ownResultsByTask = new Map<string, TaskResult>()
  for (const result of weekResults) {
    if (result.player_id === data.userId && !ownResultsByTask.has(result.task_id)) ownResultsByTask.set(result.task_id, result)
  }

  return {
    weekTasks,
    ownResultsByTask,
    team: data.isTeamDashboard ? selectTeamProgress(data, weekTasks, weekResults) : null,
    personal: data.isTeamDashboard ? null : selectPersonalProgress(data, ownMemberships, weekTasks, ownResultsByTask),
    ...selectAgenda(data, currentMonday),
  }
}

function selectPersonalProgress(data: DashboardData, ownMemberships: SeasonPlayer[], weekTasks: TrainingTask[], ownResultsByTask: Map<string, TaskResult>) {
  const completed = weekTasks.filter((task) => ownResultsByTask.has(task.id)).length
  const completion = weekTasks.length ? Math.round(completed / weekTasks.length * 100) : 0
  const seasonMemberships = ownMemberships.filter((membership) => membership.season_id === data.season?.id)
  const eligibleSessions = data.season ? data.trainingSessions.filter((session) => (
    session.season_id === data.season?.id
    && session.session_date <= data.today
    && seasonMemberships.some((membership) => membershipCoversDate(membership, session.session_date))
  )) : []
  const eligibleSessionIds = new Set(eligibleSessions.map((session) => session.id))
  const attendedSessions = data.attendance.filter((record) => (
    record.player_id === data.userId && record.attended && eligibleSessionIds.has(record.session_id)
  )).length
  const attendanceTotal = eligibleSessions.length
  const attendanceRate = attendanceTotal ? Math.round(attendedSessions / attendanceTotal * 100) : 0
  return { completed, completion, attendedSessions, attendanceTotal, attendanceRate }
}

function selectTeamProgress(data: DashboardData, weekTasks: TrainingTask[], weekResults: TaskResult[]) {
  const membershipsByPlayer = new Map<string, SeasonPlayer[]>()
  for (const membership of data.memberships) {
    const memberships = membershipsByPlayer.get(membership.player_id)
    if (memberships) memberships.push(membership)
    else membershipsByPlayer.set(membership.player_id, [membership])
  }
  const players = activePlayers(data.profiles)
  const eligiblePlayerIdsByTask = new Map(weekTasks.map((task) => [task.id, new Set(players.filter((player) => (
    canUserCompleteTask(task, membershipsByPlayer.get(player.id) ?? [], player.id)
  )).map((player) => player.id))]))
  const eligiblePlayerIds = new Set([...eligiblePlayerIdsByTask.values()].flatMap((ids) => [...ids]))
  const validResults = weekResults.filter((result) => eligiblePlayerIdsByTask.get(result.task_id)?.has(result.player_id))
  const activePlayerCount = new Set(validResults.map((result) => result.player_id)).size
  const expectedResults = [...eligiblePlayerIdsByTask.values()].reduce((total, ids) => total + ids.size, 0)
  const completion = expectedResults ? Math.round(validResults.length / expectedResults * 100) : 0
  return {
    eligiblePlayerIdsByTask,
    eligiblePlayerCount: eligiblePlayerIds.size,
    activePlayerCount,
    validResults,
    expectedResults,
    completion,
    insight: teamProgressInsight(weekTasks, eligiblePlayerIdsByTask, validResults, eligiblePlayerIds.size, activePlayerCount),
  }
}

function selectAgenda(data: DashboardData, currentMonday: string) {
  const agendaEnd = addDays(currentMonday, 13)
  let nextMatch: Match | undefined
  for (const match of data.matches) {
    if (match.status === 'published' && match.match_date >= data.today && (!nextMatch || match.match_date < nextMatch.match_date)) nextMatch = match
  }
  const nextAnnouncements = data.announcements.filter((announcement) => (
    announcement.status === 'published'
    && announcement.announcement_date >= data.today
    && announcement.announcement_date <= agendaEnd
  )).sort((first, second) => first.announcement_date.localeCompare(second.announcement_date)).slice(0, 4)
  return { nextMatch, nextAnnouncements, attentionCount: Number(Boolean(nextMatch)) + nextAnnouncements.length }
}

function teamProgressInsight(tasks: TrainingTask[], eligiblePlayerIdsByTask: Map<string, Set<string>>, results: TaskResult[], eligiblePlayers: number, activePlayerCount: number) {
  if (!tasks.length) return { title: 'Semana todavía sin tareas', text: 'Cuando se publique una tarea aparecerá aquí el seguimiento del equipo.' }
  if (!eligiblePlayers) return { title: 'Sin jugadoras asignadas', text: 'Las tareas están publicadas, pero no hay jugadoras activas asignadas a esta semana.' }

  const resultCountByTask = new Map<string, number>()
  results.forEach((result) => resultCountByTask.set(result.task_id, (resultCountByTask.get(result.task_id) ?? 0) + 1))
  const lowestParticipationTask = tasks.filter((task) => (eligiblePlayerIdsByTask.get(task.id)?.size ?? 0) > 0).sort((first, second) => (
    (resultCountByTask.get(first.id) ?? 0) / eligiblePlayerIdsByTask.get(first.id)!.size
    - (resultCountByTask.get(second.id) ?? 0) / eligiblePlayerIdsByTask.get(second.id)!.size
  ))[0]
  const taskResponses = resultCountByTask.get(lowestParticipationTask.id) ?? 0
  const taskEligiblePlayers = eligiblePlayerIdsByTask.get(lowestParticipationTask.id)?.size ?? 0
  const pendingPlayers = eligiblePlayers - activePlayerCount
  return {
    title: pendingPlayers
      ? `${pendingPlayers} ${pendingPlayers === 1 ? 'jugadora todavía no ha' : 'jugadoras todavía no han'} comenzado`
      : 'Todo el equipo ha comenzado las tareas',
    text: `“${lowestParticipationTask.title}” es la tarea con menor participación: ${taskResponses}/${taskEligiblePlayers} respuestas.`,
  }
}
