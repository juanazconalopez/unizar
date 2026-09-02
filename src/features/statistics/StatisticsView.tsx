import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, monthEnd, monthStart, offsetMonth, todayIso, toIsoDate } from '../../lib/dates'
import { membershipOverlapsSeasonRange } from '../../lib/selectors'
import { isPlayer } from '../../lib/permissions'
import { SeasonAttendanceReport } from './SeasonAttendanceReport'
import { StatisticsDayDetail } from './StatisticsDayDetail'
import { recordDate } from './statisticsSelectors'
import type {
  AttendanceRecord,
  ProvisionalAttendanceRecord,
  ProvisionalPlayer,
  Profile,
  Season,
  SeasonPlayer,
  TaskResult,
  TrainingSession,
  TrainingTask,
  SeasonCallupReport,
  SeasonBirthday,
} from '../../types'

type StatisticsProps = {
  profiles: Profile[]
  provisionalPlayers?: ProvisionalPlayer[]
  provisionalAttendance?: ProvisionalAttendanceRecord[]
  sessions: TrainingSession[]
  attendance: AttendanceRecord[]
  memberships: SeasonPlayer[]
  seasons: Season[]
  tasks: TrainingTask[]
  results: TaskResult[]
  loadingRange?: boolean
  onLoadMonth?: (month: string) => Promise<void>
  onLoadSeasonReport?: (seasonId: string) => Promise<SeasonCallupReport>
  birthdays?: SeasonBirthday[]
}

export function StatisticsView({ profiles = [], provisionalPlayers = [], provisionalAttendance = [], seasons = [], sessions = [], attendance = [], memberships = [], tasks = [], results = [], birthdays = [], loadingRange = false, onLoadMonth, onLoadSeasonReport }: StatisticsProps) {
  const today = todayIso()
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`)
  const [selectedDate, setSelectedDate] = useState(today)
  const historicalPlayers = useMemo(() => profiles.filter(isPlayer), [profiles])
  const playerIds = useMemo(() => new Set(historicalPlayers.map((profile) => profile.id)), [historicalPlayers])
  const publishedTaskIds = new Set(tasks.filter((task) => task.status === 'published').map((task) => task.id))
  const playerAttendance = attendance.filter((record) => playerIds.has(record.player_id))
  const playerResults = results.filter((result) => (
    playerIds.has(result.player_id) && publishedTaskIds.has(result.task_id)
  ))
  const days = calendarDays(month)
  const monthPrefix = month.slice(0, 7)
  const monthFrom = monthStart(month)
  const monthTo = monthEnd(month)
  const seasonsById = new Map(seasons.map((season) => [season.id, season]))
  const eligibleMonthPlayerIds = new Set(memberships
    .filter((membership) => (
      membershipOverlapsSeasonRange(membership, seasonsById.get(membership.season_id), monthFrom, monthTo)
      && playerIds.has(membership.player_id)
    ))
    .map((membership) => membership.player_id))
  const monthSessions = sessions.filter((session) => session.session_date.startsWith(monthPrefix))
  const monthAttendance = playerAttendance.filter((record) => recordDate(record)?.startsWith(monthPrefix))
  const monthResults = playerResults.filter((result) => result.performed_on.startsWith(monthPrefix))
  const attendanceRate = attendancePercentage(monthAttendance)
  const averageCompletedTasks = eligibleMonthPlayerIds.size
    ? monthResults.length / eligibleMonthPlayerIds.size
    : null
  const previousMonthPrefix = offsetMonth(month, -1).slice(0, 7)
  const previousAttendance = playerAttendance.filter((record) => recordDate(record)?.startsWith(previousMonthPrefix))
  const previousAttendanceRate = attendancePercentage(previousAttendance)
  const attendanceDrop = attendanceRate !== null && previousAttendanceRate !== null
    ? Math.round(previousAttendanceRate - attendanceRate)
    : 0

  async function changeMonth(offset: number) {
    const nextMonth = offsetMonth(month, offset)
    if (onLoadMonth) {
      try {
        await onLoadMonth(nextMonth)
      } catch {
        return
      }
    }
    setMonth(nextMonth)
    setSelectedDate(nextMonth)
  }

  async function goToCurrentMonth() {
    const currentMonth = `${today.slice(0, 7)}-01`
    if (onLoadMonth) {
      try { await onLoadMonth(currentMonth) } catch { return }
    }
    setMonth(currentMonth)
    setSelectedDate(today)
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
          label="Media asistencia"
          value={attendanceRate === null ? '—' : `${Math.round(attendanceRate)}%`}
          note={attendanceRate !== null && previousAttendanceRate !== null
            ? `${Math.round(attendanceRate - previousAttendanceRate) >= 0 ? '+' : ''}${Math.round(attendanceRate - previousAttendanceRate)} ptos. vs. mes anterior`
            : undefined}
        />
        <SummaryMetric
          label="Media tareas realizadas"
          value={averageCompletedTasks === null ? '—' : formatAverage(averageCompletedTasks)}
        />
        {onLoadSeasonReport && <SeasonAttendanceReport
          onLoad={onLoadSeasonReport}
          season={seasons.find((season) => season.start_date <= today && season.end_date >= today)}
        />}
      </section>
      {attendanceDrop >= 10 && (
        <div className="monthly-alert" role="status">
          <strong>La asistencia ha bajado {attendanceDrop} puntos</strong>
          <span>Comparación con el mes anterior. Puede ser útil revisar lesiones, carga y disponibilidad.</span>
        </div>
      )}

      {month !== `${today.slice(0, 7)}-01` && <div className="planning-current-action"><button className="secondary-button compact" disabled={loadingRange} onClick={() => void goToCurrentMonth()} type="button">Volver a este mes</button></div>}

      <section className="calendar-panel">
        <div className="calendar-toolbar">
          <button aria-label="Mes anterior" disabled={loadingRange} onClick={() => void changeMonth(-1)} type="button">‹</button>
          <div>
            <span className="eyebrow">MES</span>
            <h2>{formatDate(month, { month: 'long', year: 'numeric' })}</h2>
          </div>
          <button aria-label="Mes siguiente" disabled={loadingRange} onClick={() => void changeMonth(1)} type="button">›</button>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="statistics-calendar">
          {days.map((date, index) => {
            if (!date) return <span className="calendar-empty" key={`empty-${index}`} />
            const dayAttendance = playerAttendance.filter((record) => recordDate(record) === date)
            const guestAttendance = provisionalAttendance.filter((record) => record.training_sessions?.session_date === date)
            const teamAttended = dayAttendance.filter((record) => record.attended).length
            const attended = teamAttended + guestAttendance.length
            const taskPlayers = new Set(playerResults.filter((result) => result.performed_on === date).map((result) => result.player_id)).size
            const dayBirthdays = birthdays.filter((birthday) => birthday.birthday_on === date)
            const hasData = dayAttendance.length > 0 || guestAttendance.length > 0 || taskPlayers > 0 || dayBirthdays.length > 0
            return (
              <button
                aria-label={`${formatDate(date, { day: 'numeric', month: 'long' })}: ${attended} asistencias${guestAttendance.length ? `, ${guestAttendance.length} de invitadas` : ''}, ${taskPlayers} jugadoras con tareas${dayBirthdays.length ? ` y cumpleaños de ${dayBirthdays.map((birthday) => birthday.display_name).join(', ')}` : ''}`}
                aria-pressed={selectedDate === date}
                className={`${hasData ? 'has-data ' : ''}${date === today ? 'today' : ''}`}
                key={date}
                onClick={() => setSelectedDate(date)}
                type="button"
              >
                <strong>{Number(date.slice(-2))}</strong>
                {(dayAttendance.length > 0 || guestAttendance.length > 0) && <small className="attendance-mark">A {attended}</small>}
                {taskPlayers > 0 && <small className="task-mark">T {taskPlayers}</small>}
                {dayBirthdays.length > 0 && <small className="birthday-mark">🎂 {dayBirthdays.length}</small>}
              </button>
            )
          })}
        </div>
        <div className="calendar-legend">
          <span><i className="attendance-dot" />A · Asistencia</span>
          <span><i className="task-dot" />T · Jugadoras con tareas</span>
        </div>
      </section>

      <StatisticsDayDetail
        players={historicalPlayers}
        provisionalAttendance={provisionalAttendance}
        provisionalPlayers={provisionalPlayers}
        attendance={playerAttendance}
        date={selectedDate}
        memberships={memberships}
        seasons={seasons}
        results={playerResults}
        sessions={sessions}
        tasks={tasks}
        birthdays={birthdays}
      />
    </div>
  )
}

function SummaryMetric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <article><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>
}

function formatAverage(value: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value)
}

function attendancePercentage(records: AttendanceRecord[]) {
  if (!records.length) return null
  return (records.filter((record) => record.attended).length / records.length) * 100
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
