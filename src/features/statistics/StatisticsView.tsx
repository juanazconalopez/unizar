import { useMemo, useState, type ReactNode } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, monthEnd, monthStart, offsetMonth, todayIso, toIsoDate } from '../../lib/dates'
import { membershipOverlapsSeasonRange } from '../../lib/selectors'
import { isPlayer } from '../../lib/permissions'
import { SeasonAttendanceReport } from './SeasonAttendanceReport'
import { StatisticsDayDetail } from './StatisticsDayDetail'
import { monthlyAttendanceSummary, recordDate } from './statisticsSelectors'
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
  canViewAttendance?: boolean
  canViewTasks?: boolean
}

export function StatisticsView({ profiles = [], provisionalPlayers = [], provisionalAttendance = [], seasons = [], sessions = [], attendance = [], memberships = [], tasks = [], results = [], birthdays = [], loadingRange = false, canViewAttendance = true, canViewTasks = true, onLoadMonth, onLoadSeasonReport }: StatisticsProps) {
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
  const attendanceSummary = monthlyAttendanceSummary(monthSessions, monthAttendance, provisionalAttendance, playerIds)
  const attendanceRate = attendanceSummary.percentage
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
        subtitle={canViewAttendance && canViewTasks ? 'Asistencia a campo y seguimiento de tareas del equipo.' : canViewAttendance ? 'Asistencia a campo del equipo.' : 'Seguimiento de tareas del equipo.'}
      />

      <section className="statistics-summary" aria-label="Resumen del mes">
        {canViewAttendance && <SummaryMetric
          label="Entrenamientos"
          value={monthSessions.length.toString()}
          aside={attendanceSummary.maximum !== null ? (
            <div className="summary-attendance-range" aria-label={`Máxima asistencia ${attendanceSummary.maximum}, mínima asistencia ${attendanceSummary.minimum}`}>
              <div><span>Máx. A.</span><strong>{attendanceSummary.maximum}</strong></div>
              <div><span>Mín. A.</span><strong>{attendanceSummary.minimum}</strong></div>
            </div>
          ) : undefined}
        />}
        {canViewAttendance && <SummaryMetric
          label="Media asistencia"
          value={attendanceSummary.average === null ? '—' : formatAverage(attendanceSummary.average)}
          valueAside={attendanceSummary.percentage === null ? undefined : <span className="summary-percentage">({Math.round(attendanceSummary.percentage)}%)</span>}
        />}
        {canViewTasks && <SummaryMetric
          label="Media tareas realizadas"
          value={averageCompletedTasks === null ? '—' : formatAverage(averageCompletedTasks)}
        />}
        {canViewAttendance && onLoadSeasonReport && <SeasonAttendanceReport
          onLoad={onLoadSeasonReport}
          season={seasons.find((season) => season.start_date <= today && season.end_date >= today)}
        />}
      </section>
      {canViewAttendance && attendanceDrop >= 10 && (
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
            const hasData = (canViewAttendance && (dayAttendance.length > 0 || guestAttendance.length > 0)) || (canViewTasks && taskPlayers > 0) || dayBirthdays.length > 0
            const daySummary = [
              canViewAttendance ? `${attended} asistencias${guestAttendance.length ? `, ${guestAttendance.length} de invitadas` : ''}` : '',
              canViewTasks ? `${taskPlayers} jugadoras con tareas` : '',
              dayBirthdays.length ? `cumpleaños de ${dayBirthdays.map((birthday) => birthday.display_name).join(', ')}` : '',
            ].filter(Boolean).join(', ')
            return (
              <button
                aria-label={`${formatDate(date, { day: 'numeric', month: 'long' })}: ${daySummary || 'sin datos'}`}
                aria-pressed={selectedDate === date}
                className={`${hasData ? 'has-data ' : ''}${date === today ? 'today' : ''}`}
                key={date}
                onClick={() => setSelectedDate(date)}
                type="button"
              >
                <strong>{Number(date.slice(-2))}</strong>
                {canViewAttendance && (dayAttendance.length > 0 || guestAttendance.length > 0) && <small className="attendance-mark">A {attended}</small>}
                {canViewTasks && taskPlayers > 0 && <small className="task-mark">T {taskPlayers}</small>}
                {dayBirthdays.length > 0 && <small className="birthday-mark">🎂 {dayBirthdays.length}</small>}
              </button>
            )
          })}
        </div>
        <div className="calendar-legend">
          {canViewAttendance && <span><i className="attendance-dot" />A · Asistencia</span>}
          {canViewTasks && <span><i className="task-dot" />T · Jugadoras con tareas</span>}
        </div>
      </section>

      <StatisticsDayDetail
        players={historicalPlayers}
        provisionalAttendance={canViewAttendance ? provisionalAttendance : []}
        provisionalPlayers={provisionalPlayers}
        attendance={canViewAttendance ? playerAttendance : []}
        date={selectedDate}
        memberships={memberships}
        seasons={seasons}
        results={canViewTasks ? playerResults : []}
        sessions={canViewAttendance ? sessions : []}
        tasks={canViewTasks ? tasks : []}
        birthdays={birthdays}
      />
    </div>
  )
}

function SummaryMetric({ label, value, valueAside, aside }: { label: string; value: string; valueAside?: ReactNode; aside?: ReactNode }) {
  return <article className={aside || valueAside ? 'statistics-summary-horizontal' : undefined}>
    <div className="statistics-summary-content"><span>{label}</span><div className="statistics-summary-value"><strong>{value}</strong>{valueAside}</div></div>
    {aside}
  </article>
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
