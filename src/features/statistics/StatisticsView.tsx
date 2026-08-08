import { useMemo, useState } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { PageHeader } from '../../components/ui/PageHeader'
import { addDays, formatDate, mondayFor, todayIso, toIsoDate } from '../../lib/dates'
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
    () => profiles.filter((profile) => profile.is_approved && profile.is_active && !profile.is_archived),
    [profiles],
  )
  const days = calendarDays(month)
  const monthPrefix = month.slice(0, 7)
  const monthSessions = sessions.filter((session) => session.session_date.startsWith(monthPrefix))
  const monthAttendance = attendance.filter((record) => recordDate(record)?.startsWith(monthPrefix))
  const monthResults = results.filter((result) => result.performed_on.startsWith(monthPrefix))
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
            const dayAttendance = attendance.filter((record) => recordDate(record) === date)
            const attended = dayAttendance.filter((record) => record.attended).length
            const taskPlayers = new Set(results.filter((result) => result.performed_on === date).map((result) => result.player_id)).size
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
        attendance={attendance}
        date={selectedDate}
        memberships={memberships}
        results={results}
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
  const weekEnd = addDays(weekStart, 6)
  const weeklyTasks = tasks.filter((task) => task.week_start === weekStart && task.status === 'published')
  const weeklyTaskIds = new Set(weeklyTasks.map((task) => task.id))
  const hasSession = sessions.some((session) => session.session_date === date)
  const saturday = isoDay(date) === 6
  const attendancePeriodEnd = saturday ? date : weekEnd
  const weeklySessions = sessions.filter((session) => session.session_date >= weekStart && session.session_date <= attendancePeriodEnd)
  const weeklyAttendance = attendance.filter((record) => {
    const recordDay = recordDate(record)
    return recordDay && recordDay >= weekStart && recordDay <= attendancePeriodEnd
  })
  const weeklyAttended = weeklyAttendance.filter((record) => record.attended).length

  return (
    <section className="day-detail">
      <div className="day-detail-heading">
        <div>
          <span className="eyebrow">DETALLE DEL DÍA</span>
          <h2>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        </div>
        <span>{weeklyTasks.length} {weeklyTasks.length === 1 ? 'tarea publicada' : 'tareas publicadas'} esta semana</span>
      </div>

      {saturday && (
        <div className="weekly-attendance-summary">
          <div><span>ACUMULADO SEMANAL</span><strong>{weeklyAttendance.length ? `${weeklyAttended}/${weeklyAttendance.length}` : '—'}</strong></div>
          <p>{weeklySessions.length
            ? `${weeklySessions.length} ${weeklySessions.length === 1 ? 'entrenamiento registrado' : 'entrenamientos registrados'} entre el lunes y el sábado.`
            : 'No hay entrenamientos de campo registrados esta semana.'}</p>
        </div>
      )}

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
          const playerWeeklyAttendance = weeklyAttendance.filter((record) => record.player_id === player.id)
          const playerWeeklyAttended = playerWeeklyAttendance.filter((record) => record.attended).length

          return (
            <article className={`statistics-player ${complete ? 'complete' : completedTasks.length ? 'partial' : ''}`} key={player.id}>
              <div className="statistics-player-name">
                <Avatar name={player.display_name} />
                <div><strong>{player.display_name}</strong><span>{attendanceLabel(hasSession, dailyAttendance)}</span></div>
              </div>
              <div className="statistics-player-metrics">
                <PlayerMetric label="Tareas semana" tone={complete ? 'good' : completedTasks.length ? 'partial' : ''} value={`${completedTasks.length}/${assignedTasks.length}`} />
                <PlayerMetric label="Hechas este día" value={completedToday.toString()} />
                {saturday && (
                  <PlayerMetric
                    label="Asistencia semana"
                    tone={playerWeeklyAttendance.length && playerWeeklyAttended === playerWeeklyAttendance.length ? 'good' : ''}
                    value={playerWeeklyAttendance.length ? `${playerWeeklyAttended}/${playerWeeklyAttendance.length}` : '—'}
                  />
                )}
              </div>
            </article>
          )
        })}
        {!activePlayers.length && <p className="statistics-empty">No hay jugadoras activas para mostrar.</p>}
      </div>
    </section>
  )
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

function isoDay(value: string) {
  return new Date(`${value}T12:00:00`).getDay()
}
