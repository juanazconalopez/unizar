import { formatDate, monthEnd, monthStart, offsetMonth, todayIso } from '../../lib/dates'
import { membershipCoversDate, membershipOverlapsSeasonRange } from '../../lib/selectors'
import { isPlayer } from '../../lib/permissions'
import type { Profile, ProvisionalAttendanceRecord, Season, SeasonPlayer } from '../../types'
import type { StatisticsSeasonData } from '../../services/trainingQueriesService'
import { monthlyAttendanceSummary, recordDate } from './statisticsSelectors'
import { PageHeader } from '../../components/ui/PageHeader'

type EvolutionPoint = {
  month: string
  value: number | null
  detail?: string
}

type SeasonEvolutionViewProps = {
  data: StatisticsSeasonData
  season: Season
  memberships: SeasonPlayer[]
  profiles: Profile[]
  provisionalAttendance?: ProvisionalAttendanceRecord[]
  canViewAttendance: boolean
  canViewTasks: boolean
  onBack: () => void
}

export function SeasonEvolutionView({ data, season, memberships, profiles, provisionalAttendance = [], canViewAttendance, canViewTasks, onBack }: SeasonEvolutionViewProps) {
  const playerIds = new Set(profiles.filter(isPlayer).map((profile) => profile.id))
  const publishedTaskIds = new Set(data.tasks.filter((task) => task.status === 'published').map((task) => task.id))
  const months = seasonMonths(season)
  const currentMonth = todayIso().slice(0, 7)
  const points = months.map((month) => {
    const monthIsAvailable = month.slice(0, 7) <= currentMonth
    const monthFrom = monthStart(month)
    const monthTo = monthEnd(month)
    const eligiblePlayerIds = new Set(memberships
      .filter((membership) => (
        membershipOverlapsSeasonRange(membership, season, monthFrom, monthTo)
        && playerIds.has(membership.player_id)
      ))
      .map((membership) => membership.player_id))
    const sessions = data.trainingSessions.filter((session) => session.session_date.startsWith(month.slice(0, 7)))
    const attendance = data.attendance.filter((record) => recordDate(record)?.startsWith(month.slice(0, 7)))
    const summary = monthlyAttendanceSummary(sessions, attendance, provisionalAttendance, playerIds)
    const attendanceThresholds = attendanceThresholdCounts(sessions, attendance, memberships, season, eligiblePlayerIds)
    const results = data.results.filter((result) => (
      result.performed_on.startsWith(month.slice(0, 7))
      && publishedTaskIds.has(result.task_id)
      && eligiblePlayerIds.has(result.player_id)
    ))
    const completedPlayers = new Set(results.map((result) => result.player_id)).size

    return {
      month,
      available: monthIsAvailable,
      eligiblePlayerCount: eligiblePlayerIds.size,
      sessionCount: monthIsAvailable ? sessions.length : null,
      attendanceAverage: monthIsAvailable ? summary.average : null,
      attendancePercentage: monthIsAvailable ? summary.percentage : null,
      attendancePerfectCount: monthIsAvailable ? attendanceThresholds.perfect : null,
      attendanceAtLeastHalfCount: monthIsAvailable ? attendanceThresholds.atLeastHalf : null,
      taskPlayerPercentage: monthIsAvailable && eligiblePlayerIds.size ? (completedPlayers / eligiblePlayerIds.size) * 100 : null,
      taskAverage: monthIsAvailable && eligiblePlayerIds.size ? results.length / eligiblePlayerIds.size : null,
    }
  })

  const latest = [...points].reverse().find((point) => point.available && (point.sessionCount || point.taskAverage !== null))
  const subtitle = `${season.name} · Evolución mensual de asistencia, tareas y carga de trabajo.`

  return (
    <div className="page statistics-page season-evolution-page">
      <PageHeader
        action={<button className="secondary-button" onClick={onBack} type="button">Volver al resumen</button>}
        eyebrow="RENDIMIENTO DEL EQUIPO"
        subtitle={subtitle}
        title="Evolución de la temporada"
      />

      <div className="season-evolution-context">
        <span className="eyebrow">TEMPORADA</span>
        <strong>{formatDate(season.start_date, { day: 'numeric', month: 'long', year: 'numeric' })} – {formatDate(season.end_date, { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
        {latest && <small>Último mes con datos: {formatDate(latest.month, { month: 'long', year: 'numeric' })}</small>}
      </div>

      <section aria-label="Gráficas de evolución de la temporada" className="season-evolution-grid">
        {canViewAttendance && <EvolutionChart
          color="#1e6f5c"
          labelFormatter={(value) => formatNumber(value)}
          points={points.map((point) => ({ month: point.month, value: point.attendanceAverage, detail: point.sessionCount === null ? undefined : `${point.sessionCount} entrenamientos` }))}
          title="Media de asistentes"
          unit="personas"
        />}
        {canViewAttendance && <EvolutionChart
          color="#277d68"
          fixedMax={100}
          labelFormatter={(value) => `${Math.round(value)}%`}
          points={points.map((point) => ({ month: point.month, value: point.attendancePercentage }))}
          title="Porcentaje de asistencia"
          unit="porcentaje"
        />}
        {canViewAttendance && <EvolutionComparisonChart
          series={[
            {
              color: '#1e6f5c',
              label: '100% de asistencia',
              points: points.map((point) => ({ month: point.month, value: point.attendancePerfectCount })),
            },
            {
              color: '#d8892c',
              label: '50% o más',
              points: points.map((point) => ({ month: point.month, value: point.attendanceAtLeastHalfCount })),
            },
          ]}
          title="Jugadoras por porcentaje de asistencia"
          unit="jugadoras"
        />}
        {canViewAttendance && <EvolutionChart
          color="#4c8ca2"
          labelFormatter={(value) => `${Math.round(value)}`}
          points={points.map((point) => ({ month: point.month, value: point.sessionCount }))}
          title="Entrenamientos"
          unit="entrenamientos"
        />}
        {canViewTasks && <EvolutionChart
          color="#b87b2c"
          fixedMax={100}
          labelFormatter={(value) => `${Math.round(value)}%`}
          points={points.map((point) => ({ month: point.month, value: point.taskPlayerPercentage }))}
          title="Jugadoras con tareas completadas"
          unit="porcentaje"
        />}
        {canViewTasks && <EvolutionChart
          color="#c05a50"
          labelFormatter={(value) => formatNumber(value)}
          points={points.map((point) => ({ month: point.month, value: point.taskAverage }))}
          title="Media de tareas por jugadora"
          unit="tareas"
        />}
      </section>
    </div>
  )
}

type EvolutionSeries = {
  label: string
  color: string
  points: EvolutionPoint[]
}

function EvolutionComparisonChart({ title, series, unit }: { title: string; series: EvolutionSeries[]; unit: string }) {
  const width = 760
  const height = 230
  const left = 42
  const right = 15
  const top = 18
  const bottom = 45
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const points = series[0]?.points ?? []
  const values = series.flatMap((item) => item.points.map((point) => point.value)).filter((value): value is number => value !== null)
  const maxValue = niceMax(values)
  const x = (index: number) => points.length === 1 ? left + plotWidth / 2 : left + (index * plotWidth) / (points.length - 1)
  const y = (value: number) => top + plotHeight - (value / maxValue) * plotHeight
  const accessibleValues = series.map((item) => `${item.label}: ${item.points.map((point) => `${monthLabel(point.month)} ${point.value === null ? 'sin datos' : formatNumber(point.value)}`).join(', ')}`).join('. ')

  return (
    <article className="evolution-chart-card">
      <div className="evolution-chart-heading">
        <div><span className="eyebrow">EVOLUCIÓN MENSUAL</span><h2>{title}</h2></div>
        <div aria-label="Leyenda" className="evolution-chart-legend">
          {series.map((item) => <span key={item.label}><i style={{ backgroundColor: item.color }} />{item.label}</span>)}
        </div>
      </div>
      <svg aria-label={`${title}: ${accessibleValues}`} className="evolution-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
        {[0, .5, 1].map((ratio) => {
          const value = maxValue * ratio
          const lineY = y(value)
          return <g key={ratio}>
            <line stroke="#dce8e3" strokeDasharray={ratio === 0 ? undefined : '3 5'} x1={left} x2={width - right} y1={lineY} y2={lineY} />
            <text fill="#84938e" fontSize="10" textAnchor="end" x={left - 8} y={lineY + 4}>{formatNumber(value)}</text>
          </g>
        })}
        {series.map((item) => linePaths(item.points, x, y).map((path, index) => <path d={path} fill="none" key={`${item.label}-${index}`} stroke={item.color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />))}
        {series.map((item) => item.points.map((point, index) => point.value === null ? null : (
          <circle cx={x(index)} cy={y(point.value)} fill="white" key={`${item.label}-${point.month}`} r="5" stroke={item.color} strokeWidth="3">
            <title>{item.label} · {monthLabel(point.month)} · {formatNumber(point.value)}</title>
          </circle>
        )))}
        {points.map((point, index) => <text fill="#657872" fontSize="10" textAnchor="middle" x={x(index)} y={height - 15} key={`label-${point.month}`}>{monthLabel(point.month)}</text>)}
      </svg>
      <small className="evolution-chart-unit">{unit} · Los meses futuros aparecen sin datos hasta que termine el periodo.</small>
    </article>
  )
}

function EvolutionChart({ title, points, color, fixedMax, unit, labelFormatter }: {
  title: string
  points: EvolutionPoint[]
  color: string
  fixedMax?: number
  unit: string
  labelFormatter: (value: number) => string
}) {
  const width = 760
  const height = 230
  const left = 42
  const right = 15
  const top = 18
  const bottom = 45
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const values = points.map((point) => point.value).filter((value): value is number => value !== null)
  const maxValue = fixedMax ?? niceMax(values)
  const x = (index: number) => points.length === 1 ? left + plotWidth / 2 : left + (index * plotWidth) / (points.length - 1)
  const y = (value: number) => top + plotHeight - (value / maxValue) * plotHeight
  const paths = linePaths(points, x, y)
  const lastPoint = [...points].reverse().find((point) => point.value !== null)
  const accessibleValues = points.map((point) => `${monthLabel(point.month)}: ${point.value === null ? 'sin datos' : labelFormatter(point.value)}`).join(', ')

  return (
    <article className="evolution-chart-card">
      <div className="evolution-chart-heading">
        <div><span className="eyebrow">EVOLUCIÓN MENSUAL</span><h2>{title}</h2></div>
        {lastPoint && lastPoint.value !== null && <strong>{labelFormatter(lastPoint.value)}</strong>}
      </div>
      <svg aria-label={`${title}: ${accessibleValues}`} className="evolution-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
        {[0, .5, 1].map((ratio) => {
          const value = maxValue * ratio
          const lineY = y(value)
          return <g key={ratio}>
            <line stroke="#dce8e3" strokeDasharray={ratio === 0 ? undefined : '3 5'} x1={left} x2={width - right} y1={lineY} y2={lineY} />
            <text fill="#84938e" fontSize="10" textAnchor="end" x={left - 8} y={lineY + 4}>{labelFormatter(value)}</text>
          </g>
        })}
        {paths.map((path, index) => <path d={path} fill="none" key={index} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />)}
        {points.map((point, index) => point.value === null ? null : (
          <circle cx={x(index)} cy={y(point.value)} fill="white" key={point.month} r="5" stroke={color} strokeWidth="3">
            <title>{monthLabel(point.month)} · {labelFormatter(point.value)}{point.detail ? ` · ${point.detail}` : ''}</title>
          </circle>
        ))}
        {points.map((point, index) => <text fill="#657872" fontSize="10" textAnchor="middle" x={x(index)} y={height - 15} key={`label-${point.month}`}>{monthLabel(point.month)}</text>)}
      </svg>
      <small className="evolution-chart-unit">{unit} · Los meses futuros aparecen sin datos hasta que termine el periodo.</small>
    </article>
  )
}

function linePaths(points: EvolutionPoint[], x: (index: number) => number, y: (value: number) => number) {
  const paths: string[] = []
  let current: string[] = []
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length) paths.push(current.join(' '))
      current = []
      return
    }
    current.push(`${current.length ? 'L' : 'M'} ${x(index)} ${y(point.value)}`)
  })
  if (current.length) paths.push(current.join(' '))
  return paths
}

function attendanceThresholdCounts(
  sessions: SeasonEvolutionSession[],
  attendance: SeasonEvolutionAttendance[],
  memberships: SeasonPlayer[],
  season: Season,
  eligiblePlayerIds: Set<string>,
) {
  if (!sessions.length) return { perfect: null, atLeastHalf: null }

  let perfect = 0
  let atLeastHalf = 0
  for (const playerId of eligiblePlayerIds) {
    const playerSessions = sessions.filter((session) => memberships.some((membership) => (
      membership.season_id === season.id
      && membership.player_id === playerId
      && membershipCoversDate(membership, session.session_date)
    )))
    if (!playerSessions.length) continue

    const playerSessionIds = new Set(playerSessions.map((session) => session.id))
    const attendedSessionIds = new Set(attendance
      .filter((record) => record.player_id === playerId && record.attended && playerSessionIds.has(record.session_id))
      .map((record) => record.session_id))
    const percentage = attendedSessionIds.size / playerSessions.length
    if (percentage === 1) perfect += 1
    if (percentage >= 0.5) atLeastHalf += 1
  }

  return { perfect, atLeastHalf }
}

type SeasonEvolutionSession = { id: string; session_date: string }
type SeasonEvolutionAttendance = { session_id: string; player_id: string; attended: boolean }

function seasonMonths(season: Season) {
  const first = monthStart(season.start_date)
  const last = monthStart(season.end_date)
  const months: string[] = []
  let month = first
  while (month <= last) {
    months.push(month)
    month = offsetMonth(month, 1)
  }
  return months
}

function monthLabel(month: string) {
  return formatDate(month, { month: 'short' }).replace('.', '')
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value)
}

function niceMax(values: number[]) {
  if (!values.length) return 1
  const max = Math.max(...values)
  return max <= 5 ? 5 : Math.ceil(max / 5) * 5
}
