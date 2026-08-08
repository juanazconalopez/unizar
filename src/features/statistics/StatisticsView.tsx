import { useMemo, useState } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, mondayFor, todayIso, toIsoDate } from '../../lib/dates'
import { canUserCompleteTask } from '../../lib/tasks'
import type {
  AttendanceRecord,
  Profile,
  SeasonPlayer,
  TaskResult,
  TrainingSession,
  TrainingTask,
} from '../../types'

type StatisticsProps = {
  profiles: Profile[]
  sessions: TrainingSession[]
  attendance: AttendanceRecord[]
  memberships: SeasonPlayer[]
  tasks: TrainingTask[]
  results: TaskResult[]
}

export function StatisticsView({ profiles, sessions, attendance, memberships, tasks, results }: StatisticsProps) {
  const today = todayIso()
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`)
  const [selectedDate, setSelectedDate] = useState(today)
  const activePlayers = useMemo(
    () => profiles.filter((profile) => (
      profile.is_approved
      && profile.is_active
      && !profile.is_archived
      && !profile.is_owner
    )),
    [profiles],
  )
  const playerIds = useMemo(() => new Set(activePlayers.map((profile) => profile.id)), [activePlayers])
  const publishedTaskIds = new Set(tasks.filter((task) => task.status === 'published').map((task) => task.id))
  const playerAttendance = attendance.filter((record) => playerIds.has(record.player_id))
  const playerResults = results.filter((result) => (
    playerIds.has(result.player_id) && publishedTaskIds.has(result.task_id)
  ))
  const days = calendarDays(month)
  const monthPrefix = month.slice(0, 7)
  const monthSessions = sessions.filter((session) => session.session_date.startsWith(monthPrefix))
  const monthAttendance = playerAttendance.filter((record) => recordDate(record)?.startsWith(monthPrefix))
  const monthResults = playerResults.filter((result) => result.performed_on.startsWith(monthPrefix))
  const playersWithTasks = new Set(monthResults.map((result) => result.player_id)).size

  function changeMonth(offset: number) {
    const nextMonth = offsetMonth(month, offset)
    setMonth(nextMonth)
    setSelectedDate(nextMonth)
  }

  return (
    <div className="page statistics-page">
      <PageHeader
        eyebrow="RENDIMIENTO DEL EQUIPO"
        title="Resumen mensual"
        subtitle="Asistencia a campo y seguimiento de tareas del equipo."
      />

      <section className="statistics-summary" aria-label="Resumen del mes">
        <SummaryMetric label="Entrenamientos" value={monthSessions.length.toString()} />
        <SummaryMetric
          label="Asistencias"
          value={monthAttendance.length ? `${monthAttendance.filter((record) => record.attended).length}/${monthAttendance.length}` : '—'}
        />
        <SummaryMetric label="Jugadoras con tareas" value={playersWithTasks.toString()} />
      </section>

      <section className="calendar-panel">
        <div className="calendar-toolbar">
          <button aria-label="Mes anterior" onClick={() => changeMonth(-1)} type="button">‹</button>
          <div>
            <span className="eyebrow">MES</span>
            <h2>{formatDate(month, { month: 'long', year: 'numeric' })}</h2>
          </div>
          <button aria-label="Mes siguiente" onClick={() => changeMonth(1)} type="button">›</button>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="statistics-calendar">
          {days.map((date, index) => {
            if (!date) return <span className="calendar-empty" key={`empty-${index}`} />
            const dayAttendance = playerAttendance.filter((record) => recordDate(record) === date)
            const attended = dayAttendance.filter((record) => record.attended).length
            const taskPlayers = new Set(playerResults.filter((result) => result.performed_on === date).map((result) => result.player_id)).size
            const hasData = dayAttendance.length > 0 || taskPlayers > 0
            return (
              <button
                aria-label={`${formatDate(date, { day: 'numeric', month: 'long' })}: ${attended} asistencias y ${taskPlayers} jugadoras con tareas`}
                aria-pressed={selectedDate === date}
                className={`${hasData ? 'has-data ' : ''}${date === today ? 'today' : ''}`}
                key={date}
                onClick={() => setSelectedDate(date)}
                type="button"
              >
                <strong>{Number(date.slice(-2))}</strong>
                {dayAttendance.length > 0 && <small className="attendance-mark">A {attended}/{dayAttendance.length}</small>}
                {taskPlayers > 0 && <small className="task-mark">T {taskPlayers}</small>}
              </button>
            )
          })}
        </div>
        <div className="calendar-legend">
          <span><i className="attendance-dot" />A · Asistencia</span>
          <span><i className="task-dot" />T · Jugadoras con tareas</span>
        </div>
      </section>

      <DayDetail
        activePlayers={activePlayers}
        attendance={playerAttendance}
        date={selectedDate}
        memberships={memberships}
        results={playerResults}
        sessions={sessions}
        tasks={tasks}
      />
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <article><span>{label}</span><strong>{value}</strong></article>
}

function DayDetail({ activePlayers, attendance, date, memberships, results, sessions, tasks }: {
  activePlayers: Profile[]
  attendance: AttendanceRecord[]
  date: string
  memberships: SeasonPlayer[]
  results: TaskResult[]
  sessions: TrainingSession[]
  tasks: TrainingTask[]
}) {
  const weekStart = mondayFor(date)
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

  return (
    <section className="day-detail">
      <div className="day-detail-heading">
        <div>
          <span className="eyebrow">DETALLE DEL DÍA</span>
          <h2>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        </div>
        <span>{weeklyTasks.length} {weeklyTasks.length === 1 ? 'tarea publicada' : 'tareas publicadas'} esta semana</span>
      </div>

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

      <div className="statistics-player-list">
        {activePlayers.map((player) => {
          const assignedTasks = weeklyTasks.filter((task) => canUserCompleteTask(task, memberships, player.id))
          const assignedIds = new Set(assignedTasks.map((task) => task.id))
          const completedTasks = results.filter(
            (result) => result.player_id === player.id && assignedIds.has(result.task_id) && weeklyTaskIds.has(result.task_id),
          )
          const completedToday = completedTasks.filter((result) => result.performed_on === date).length
          const complete = assignedTasks.length > 0 && completedTasks.length === assignedTasks.length
          const dailyAttendance = attendance.find(
            (record) => record.player_id === player.id && recordDate(record) === date,
          )

          return (
            <article className={`statistics-player ${complete ? 'complete' : completedTasks.length ? 'partial' : ''}`} key={player.id}>
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
          )
        })}
        {!activePlayers.length && <p className="statistics-empty">No hay jugadoras activas para mostrar.</p>}
      </div>
    </section>
  )
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

function recordDate(record: AttendanceRecord) {
  return record.training_sessions?.session_date
}

function calendarDays(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstDay = new Date(year, monthNumber - 1, 1, 12)
  const offset = (firstDay.getDay() + 6) % 7
  const totalDays = new Date(year, monthNumber, 0, 12).getDate()
  return [
    ...Array.from<null>({ length: offset }).fill(null),
    ...Array.from({ length: totalDays }, (_, index) => toIsoDate(new Date(year, monthNumber - 1, index + 1, 12))),
  ]
}

function offsetMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  return toIsoDate(new Date(year, monthNumber - 1 + offset, 1, 12))
}
