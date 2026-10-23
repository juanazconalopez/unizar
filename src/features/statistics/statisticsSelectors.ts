import { madridDateTime } from '../../lib/trainingSchedule'
import type { AttendanceRecord, ProvisionalAttendanceRecord, SeasonCallupReportPlayer, TrainingSession } from '../../types'

export function recordDate(record: AttendanceRecord) {
  return record.training_sessions?.session_date
}

export function monthlyAttendanceSummary(
  sessions: TrainingSession[],
  attendance: AttendanceRecord[],
  provisionalAttendance: ProvisionalAttendanceRecord[],
  playerIds: Set<string>,
) {
  const today = madridDateTime().slice(0, 10)
  sessions = sessions.filter((session) => session.session_date <= today)
  const sessionIds = new Set(sessions.map((session) => session.id))
  attendance = attendance.filter((record) => sessionIds.has(record.session_id))
  provisionalAttendance = provisionalAttendance.filter((record) => sessionIds.has(record.session_id))
  if (!sessions.length) return { average: null, maximum: null, minimum: null, percentage: null }

  const attendanceBySession = new Map<string, number>()
  for (const record of attendance) {
    if (record.attended && playerIds.has(record.player_id)) {
      attendanceBySession.set(record.session_id, (attendanceBySession.get(record.session_id) ?? 0) + 1)
    }
  }
  for (const record of provisionalAttendance) {
    attendanceBySession.set(record.session_id, (attendanceBySession.get(record.session_id) ?? 0) + 1)
  }

  const counts = sessions.map((session) => attendanceBySession.get(session.id) ?? 0)
  const total = counts.reduce((sum, count) => sum + count, 0)
  const playerRecords = attendance.filter((record) => playerIds.has(record.player_id))
  const playerAttended = playerRecords.filter((record) => record.attended).length

  return {
    average: total / sessions.length,
    maximum: Math.max(...counts),
    minimum: Math.min(...counts),
    percentage: playerRecords.length ? (playerAttended / playerRecords.length) * 100 : null,
  }
}

export type AttendancePercentageGroup = {
  key: string
  percentage: number | null
  players: SeasonCallupReportPlayer[]
}

export function groupPlayersByAttendancePercentage(players: SeasonCallupReportPlayer[]): AttendancePercentageGroup[] {
  const groups = new Map<number | null, SeasonCallupReportPlayer[]>()
  for (const player of players) {
    const group = groups.get(player.attendancePercentage) ?? []
    group.push(player)
    groups.set(player.attendancePercentage, group)
  }

  return [...groups.entries()]
    .sort(([first], [second]) => (second ?? -1) - (first ?? -1))
    .map(([percentage, groupedPlayers]) => ({
      key: percentage === null ? 'sin-datos' : `porcentaje-${percentage}`,
      percentage,
      players: groupedPlayers,
    }))
}
