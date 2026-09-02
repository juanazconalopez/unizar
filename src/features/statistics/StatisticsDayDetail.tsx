import { Avatar } from '../../components/ui/Avatar'
import { addDays, formatDate, mondayFor } from '../../lib/dates'
import { membershipOverlapsSeasonRange } from '../../lib/selectors'
import { canUserCompleteTask } from '../../lib/tasks'
import type { AttendanceRecord, Profile, ProvisionalAttendanceRecord, ProvisionalPlayer, Season, SeasonBirthday, SeasonPlayer, TaskResult, TrainingSession, TrainingTask } from '../../types'
import { recordDate } from './statisticsSelectors'

export function StatisticsDayDetail({ players, provisionalPlayers = [], provisionalAttendance = [], attendance, date, memberships, results, seasons, sessions, tasks, birthdays }: {
  players: Profile[]
  provisionalPlayers?: ProvisionalPlayer[]
  provisionalAttendance?: ProvisionalAttendanceRecord[]
  attendance: AttendanceRecord[]
  date: string
  memberships: SeasonPlayer[]
  results: TaskResult[]
  seasons: Season[]
  sessions: TrainingSession[]
  tasks: TrainingTask[]
  birthdays: SeasonBirthday[]
}) {
  const weekStart = mondayFor(date)
  const weekEnd = addDays(weekStart, 6)
  const seasonsById = new Map(seasons.map((season) => [season.id, season]))
  const attendanceIds = new Set(attendance
    .filter((record) => recordDate(record) === date)
    .map((record) => record.player_id))
  const activePlayers = players.filter((player) => (
    attendanceIds.has(player.id)
    || memberships.some((membership) => (
      membership.player_id === player.id
      && membershipOverlapsSeasonRange(
        membership,
        seasonsById.get(membership.season_id),
        weekStart,
        weekEnd,
      )
    ))
  ))
  const weeklyTasks = tasks.filter((task) => task.week_start === weekStart && task.status === 'published')
  const weeklyTaskIds = new Set(weeklyTasks.map((task) => task.id))
  const hasSession = sessions.some((session) => session.session_date === date)
  const weeklyAssignments = activePlayers.flatMap((player) => (
    weeklyTasks
      .filter((task) => canUserCompleteTask(task, memberships, player.id))
      .map((task) => ({ playerId: player.id, taskId: task.id }))
  ))
  const completedAssignments = weeklyAssignments.filter((assignment) => results.some((result) => (
    result.player_id === assignment.playerId && result.task_id === assignment.taskId
  ))).length
  const weeklyCompletion = weeklyAssignments.length
    ? Math.round((completedAssignments / weeklyAssignments.length) * 100)
    : 0
  const playerRows = activePlayers.map((player) => {
    const assignedTasks = weeklyTasks.filter((task) => canUserCompleteTask(task, memberships, player.id))
    const assignedIds = new Set(assignedTasks.map((task) => task.id))
    const completedTasks = results.filter(
      (result) => result.player_id === player.id && assignedIds.has(result.task_id) && weeklyTaskIds.has(result.task_id),
    )
    const completedToday = completedTasks.filter((result) => result.performed_on === date).length
    return {
      player,
      assignedTasks,
      completedTasks,
      completedToday,
      complete: assignedTasks.length > 0 && completedTasks.length === assignedTasks.length,
      dailyAttendance: attendance.find((record) => record.player_id === player.id && recordDate(record) === date),
    }
  }).sort(comparePlayerDayRows)
  const visibleTaskRows = playerRows.filter((row) => row.completedToday > 0 || row.complete)
  const attendedRows = playerRows.filter((row) => row.dailyAttendance?.attended)
  const absentRows = playerRows.filter((row) => row.dailyAttendance?.attended === false)
  const provisionalNames = new Map(provisionalPlayers.map((player) => [player.id, player.display_name]))
  const guestRows = provisionalAttendance
    .filter((record) => record.training_sessions?.session_date === date)
    .flatMap((record) => {
      const displayName = provisionalNames.get(record.provisional_player_id)
      return displayName ? [{ id: record.provisional_player_id, displayName }] : []
    })
    .sort((first, second) => first.displayName.localeCompare(second.displayName, 'es'))
  const dayBirthdays = birthdays.filter((birthday) => birthday.birthday_on === date)

  return (
    <section className="day-detail">
      <div className="day-detail-heading">
        <div>
          <span className="eyebrow">DETALLE DEL DÍA</span>
          <h2>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        </div>
        <span>{weeklyTasks.length} {weeklyTasks.length === 1 ? 'tarea publicada' : 'tareas publicadas'} esta semana</span>
      </div>

      {dayBirthdays.length > 0 && <div className="birthday-day-detail" role="status">
        <span aria-hidden="true">🎂</span>
        <p><strong>Cumpleaños del día</strong>{dayBirthdays.map((birthday) => `${birthday.display_name} cumple ${birthday.age_turning} años`).join(' · ')}</p>
      </div>}

      <div className="weekly-team-summary">
        <div><span>CUMPLIMIENTO SEMANAL DEL EQUIPO</span><strong>{weeklyAssignments.length ? `${weeklyCompletion}%` : '—'}</strong></div>
        <p>{weeklyAssignments.length
          ? `${completedAssignments} de ${weeklyAssignments.length} tareas asignadas completadas por las jugadoras.`
          : 'No hay tareas asignadas a las jugadoras esta semana.'}</p>
      </div>

      <div className="day-badge-legend" aria-label="Leyenda del estado diario">
        {hasSession && <span><i className="present">A</i> Asistió</span>}
        {hasSession && <span><i className="absent">A</i> No asistió</span>}
        <span><i className="task">T</i> Tarea realizada ese día</span>
      </div>

      {hasSession ? <div className="statistics-player-groups">
        <PlayerDayGroup attendanceStatus="present" guestRows={guestRows} hasSession label="Asistieron" rows={attendedRows} />
        <PlayerDayGroup attendanceStatus="absent" hasSession label="No asistieron" rows={absentRows} />
      </div> : <div className="statistics-player-list">
        {visibleTaskRows.map((row) => <PlayerDayRow hasSession={false} key={row.player.id} row={row} />)}
        {!visibleTaskRows.length && <p className="statistics-empty">Ninguna jugadora hizo tareas este día ni tiene completa la semana.</p>}
      </div>}
    </section>
  )
}

type PlayerDayRowData = {
  player: Profile
  assignedTasks: TrainingTask[]
  completedTasks: TaskResult[]
  completedToday: number
  complete: boolean
  dailyAttendance?: AttendanceRecord
}

function comparePlayerDayRows(first: PlayerDayRowData, second: PlayerDayRowData) {
  const firstPriority = first.completedToday > 0 ? 0 : first.complete ? 1 : 2
  const secondPriority = second.completedToday > 0 ? 0 : second.complete ? 1 : 2
  return firstPriority - secondPriority || first.player.display_name.localeCompare(second.player.display_name, 'es')
}

function PlayerDayGroup({ attendanceStatus, guestRows = [], hasSession, label, rows }: { attendanceStatus: 'present' | 'absent'; guestRows?: { id: string; displayName: string }[]; hasSession: boolean; label: string; rows: PlayerDayRowData[] }) {
  const total = rows.length + guestRows.length
  return <section aria-label={`${label}: ${total} jugadoras`} className="statistics-player-group">
    <div className={`statistics-player-group-heading ${attendanceStatus}`}><h3>{label}</h3><span><strong>{total}</strong> {total === 1 ? 'jugadora' : 'jugadoras'}{guestRows.length > 0 && <small>{rows.length} del equipo · {guestRows.length} {guestRows.length === 1 ? 'invitada' : 'invitadas'}</small>}</span></div>
    <div className="statistics-player-list">
      {rows.map((row) => <PlayerDayRow hasSession={hasSession} key={row.player.id} row={row} />)}
      {guestRows.map((guest) => <GuestDayRow guest={guest} key={guest.id} />)}
      {!total && <p className="statistics-empty">No hay jugadoras en este grupo.</p>}
    </div>
  </section>
}

function GuestDayRow({ guest }: { guest: { id: string; displayName: string } }) {
  return <article className="statistics-player provisional">
    <div className="statistics-player-name">
      <Avatar name={guest.displayName} />
      <div><div className="statistics-player-title"><strong>{guest.displayName}</strong><small className="provisional-player-badge">Invitada</small></div><span>Asistió como invitada</span></div>
    </div>
  </article>
}

function PlayerDayRow({ hasSession, row }: { hasSession: boolean; row: PlayerDayRowData }) {
  const { assignedTasks, completedTasks, completedToday, complete, dailyAttendance, player } = row
  return <article className={`statistics-player ${complete ? 'complete' : completedTasks.length ? 'partial' : ''}`}>
    <div className="statistics-player-name">
      <Avatar name={player.display_name} />
      <div>
        <div className="statistics-player-title">
          <strong>{player.display_name}</strong>
          <div className="day-status-badges" aria-label={`Estado de ${player.display_name}`}>
            {hasSession && <DayStatusBadge status={attendanceBadgeStatus(dailyAttendance)} type="attendance" />}
            {completedToday > 0 && <DayStatusBadge count={completedToday} status="done" type="task" />}
          </div>
        </div>
        <span>{attendanceLabel(hasSession, dailyAttendance)}</span>
      </div>
    </div>
    <div className="statistics-player-metrics">
      <PlayerMetric label="Tareas semana" tone={complete ? 'good' : completedTasks.length ? 'partial' : ''} value={`${completedTasks.length}/${assignedTasks.length}`} />
      <PlayerMetric label="Hechas este día" value={completedToday.toString()} />
    </div>
  </article>
}

function DayStatusBadge({ type, status, count }: {
  type: 'attendance' | 'task'
  status: 'present' | 'absent' | 'unregistered' | 'done'
  count?: number
}) {
  const label = type === 'task'
    ? `${count ?? 1} ${count === 1 ? 'tarea realizada' : 'tareas realizadas'} este día`
    : status === 'present'
      ? 'Asistió al entrenamiento de campo'
      : status === 'absent'
        ? 'No asistió al entrenamiento de campo'
        : 'Asistencia sin registrar'

  return (
    <span aria-label={label} className={`day-status-badge ${type} ${status}`} title={label}>
      {type === 'attendance' ? 'A' : 'T'}
    </span>
  )
}

function attendanceBadgeStatus(record?: AttendanceRecord) {
  if (!record) return 'unregistered' as const
  return record.attended ? 'present' as const : 'absent' as const
}

function PlayerMetric({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return <div className={tone}><span>{label}</span><strong>{value}</strong></div>
}

function attendanceLabel(hasSession: boolean, record?: AttendanceRecord) {
  if (!hasSession) return 'Sin entrenamiento de campo'
  if (!record) return 'Asistencia sin registrar'
  return record.attended ? 'Asistió al entrenamiento' : 'No asistió al entrenamiento'
}
