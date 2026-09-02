import { addDays, monthEnd, monthStart } from '../lib/dates'
import { canManageSport } from '../lib/permissions'
import { fetchAttendanceDate, fetchMatchWindow, fetchStatisticsWindow, fetchTaskWindow } from '../services/trainingQueriesService'
import type { TrainingData } from '../services/trainingDataService'
import type { AttendanceRecord, MatchAvailability, MatchLineup, ProvisionalAttendanceRecord, TaskResult, TrainingTask, ViewName } from '../types'

export type LoadedRanges = {
  taskRanges: { from: string; to: string }[]
  statisticsMonth: string | null
  attendanceDate: string | null
  matchMonth: string | null
}

export function mergeByKey<T>(current: T[], incoming: T[], key: (item: T) => string) {
  const merged = new Map(current.map((item) => [key(item), item]))
  incoming.forEach((item) => merged.set(key(item), item))
  return [...merged.values()]
}

export function replaceDateRange<T, K extends keyof T>(current: T[], incoming: T[], field: K, from: string, to: string) {
  return [...current.filter((item) => {
    const value = String(item[field])
    return value < from || value > to
  }), ...incoming]
}

export function replaceRelated<T>(
  current: T[], incoming: T[], affectedIds: Set<string>, relationId: (item: T) => string, key: (item: T) => string,
) {
  return mergeByKey(current.filter((item) => !affectedIds.has(relationId(item))), incoming, key)
}

export const resultKey = (result: TaskResult) => `${result.task_id}:${result.player_id}`
export const attendanceKey = (record: AttendanceRecord) => `${record.session_id}:${record.player_id}`
export const provisionalAttendanceKey = (record: ProvisionalAttendanceRecord) => `${record.session_id}:${record.provisional_player_id}`
export const availabilityKey = (item: MatchAvailability) => `${item.match_id}:${item.player_id}`
export const lineupKey = (item: MatchLineup) => `${item.match_id}:${item.position}:${item.player_id}`

export async function restoreLoadedRanges(base: TrainingData, view: ViewName, userId: string, ranges: LoadedRanges) {
  if ((view === 'tasks' || view === 'calendar') && ranges.taskRanges.length) {
    let tasks = base.tasks
    let results = base.results
    let announcements = base.announcements ?? []
    const canManage = canManageSport(base.profile)
    const windows = await Promise.all(ranges.taskRanges.map(async ({ from, to }) => ({
      from, to, data: await fetchTaskWindow(userId, canManage, from, to),
    })))
    for (const window of windows) {
      const merged = mergeTaskWindow(tasks, results, window.data, window.from, window.to)
      tasks = merged.tasks
      results = merged.results
      announcements = replaceDateRange(announcements, window.data.announcements ?? [], 'announcement_date', window.from, addDays(window.to, 6))
    }
    base = { ...base, tasks, results, announcements }
    if (view === 'tasks') return base
  }

  if (view === 'statistics' && ranges.statisticsMonth) {
    return { ...base, ...await fetchStatisticsWindow(ranges.statisticsMonth) }
  }

  if (view === 'attendance' && ranges.attendanceDate) {
    let trainingSessions = base.trainingSessions
    let attendance = base.attendance
    let provisionalAttendance = base.provisionalAttendance
    const window = await fetchAttendanceDate(ranges.attendanceDate)
    const oldIds = new Set(trainingSessions.filter((session) => session.session_date === ranges.attendanceDate).map((session) => session.id))
    const affectedIds = new Set([...oldIds, ...window.trainingSessions.map((session) => session.id)])
    trainingSessions = replaceDateRange(trainingSessions, window.trainingSessions, 'session_date', ranges.attendanceDate, ranges.attendanceDate)
    attendance = replaceRelated(attendance, window.attendance, affectedIds, (item) => item.session_id, attendanceKey)
    provisionalAttendance = replaceRelated(provisionalAttendance, window.provisionalAttendance, affectedIds, (item) => item.session_id, provisionalAttendanceKey)
    return { ...base, trainingSessions, attendance, provisionalAttendance }
  }

  if ((view === 'matches' || view === 'calendar') && ranges.matchMonth) {
    let matches = base.matches
    let matchAvailability = base.matchAvailability
    let matchLineups = base.matchLineups
    const from = monthStart(ranges.matchMonth)
    const to = monthEnd(ranges.matchMonth)
    const window = await fetchMatchWindow(from, to)
    const oldIds = new Set(matches.filter((match) => match.match_date >= from && match.match_date <= to).map((match) => match.id))
    const affectedIds = new Set([...oldIds, ...window.matches.map((match) => match.id)])
    matches = replaceDateRange(matches, window.matches, 'match_date', from, to)
    matchAvailability = replaceRelated(matchAvailability, window.matchAvailability, affectedIds, (item) => item.match_id, availabilityKey)
    matchLineups = replaceRelated(matchLineups, window.matchLineups, affectedIds, (item) => item.match_id, lineupKey)
    return { ...base, matches, matchAvailability, matchLineups }
  }

  return base
}

export function mergeTaskWindow(
  tasks: TrainingTask[], results: TaskResult[], incoming: { tasks: TrainingTask[]; results: TaskResult[] }, from: string, to: string,
) {
  const affectedIds = new Set([
    ...tasks.filter((task) => task.week_start >= from && task.week_start <= to).map((task) => task.id),
    ...incoming.tasks.map((task) => task.id),
  ])
  return {
    tasks: replaceDateRange(tasks, incoming.tasks, 'week_start', from, to),
    results: replaceRelated(results, incoming.results, affectedIds, (result) => result.task_id, resultKey),
  }
}
