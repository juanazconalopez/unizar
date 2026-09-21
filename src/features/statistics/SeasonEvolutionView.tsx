import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { formatDate, monthEnd, monthStart, offsetMonth, todayIso } from '../../lib/dates'
import { membershipCoversDate, membershipOverlapsSeasonRange } from '../../lib/selectors'
import { isPlayer } from '../../lib/permissions'
import type { Profile, ProvisionalAttendanceRecord, Season, SeasonPlayer } from '../../types'
import type { StatisticsSeasonData } from '../../services/trainingQueriesService'
import { monthlyAttendanceSummary, recordDate } from './statisticsSelectors'
import { PageHeader } from '../../components/ui/PageHeader'
import { Modal } from '../../components/ui/Modal'

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

type EvolutionChartDefinition = {
  id: string
  access: 'attendance' | 'tasks'
  title: string
  unit: string
} & ({
  kind: 'single'
  color: string
  fixedMax?: number
  labelFormatter: (value: number) => string
  points: EvolutionPoint[]
} | {
  kind: 'comparison'
  series: EvolutionSeries[]
})

export function SeasonEvolutionView({ data, season, memberships, profiles, provisionalAttendance = [], canViewAttendance, canViewTasks, onBack }: SeasonEvolutionViewProps) {
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null)
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
      attendanceAverage: monthIsAvailable && summary.average !== null ? Math.round(summary.average) : null,
      attendancePercentage: monthIsAvailable ? summary.percentage : null,
      attendancePerfectCount: monthIsAvailable ? attendanceThresholds.perfect : null,
      attendanceAtLeastHalfCount: monthIsAvailable ? attendanceThresholds.atLeastHalf : null,
      taskPlayerPercentage: monthIsAvailable && eligiblePlayerIds.size ? (completedPlayers / eligiblePlayerIds.size) * 100 : null,
      taskAverage: monthIsAvailable && eligiblePlayerIds.size ? results.length / eligiblePlayerIds.size : null,
    }
  })

  const latest = [...points].reverse().find((point) => point.available && (point.sessionCount || point.taskAverage !== null))
  const subtitle = `${season.name} · Evolución mensual de asistencia, tareas y carga de trabajo.`
  const chartDefinitions: EvolutionChartDefinition[] = [
    {
      access: 'attendance',
      color: '#4c8ca2',
      id: 'sessions',
      kind: 'single',
      labelFormatter: (value) => `${Math.round(value)}`,
      points: points.map((point) => ({ month: point.month, value: point.sessionCount })),
      title: 'Entrenamientos',
      unit: 'entrenamientos',
    },
    {
      access: 'attendance',
      color: '#1e6f5c',
      id: 'attendance-average',
      kind: 'single',
      labelFormatter: (value) => formatNumber(value),
      points: points.map((point) => ({ month: point.month, value: point.attendanceAverage })),
      title: 'Media de asistentes por entrenamiento',
      unit: 'personas',
    },
    {
      access: 'attendance',
      color: '#277d68',
      fixedMax: 100,
      id: 'attendance-percentage',
      kind: 'single',
      labelFormatter: (value) => `${Math.round(value)}%`,
      points: points.map((point) => ({ month: point.month, value: point.attendancePercentage })),
      title: '% asistencia de equipo',
      unit: 'porcentaje',
    },
    {
      access: 'attendance',
      id: 'attendance-thresholds',
      kind: 'comparison',
      series: [
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
      ],
      title: 'Jugadoras por porcentaje de asistencia',
      unit: 'jugadoras',
    },
    {
      access: 'tasks',
      color: '#b87b2c',
      fixedMax: 100,
      id: 'task-player-percentage',
      kind: 'single',
      labelFormatter: (value) => `${Math.round(value)}%`,
      points: points.map((point) => ({ month: point.month, value: point.taskPlayerPercentage })),
      title: 'Jugadoras con tareas completadas',
      unit: 'porcentaje',
    },
    {
      access: 'tasks',
      color: '#c05a50',
      id: 'task-average',
      kind: 'single',
      labelFormatter: (value) => formatNumber(value),
      points: points.map((point) => ({ month: point.month, value: point.taskAverage })),
      title: 'Media de tareas por jugadora',
      unit: 'tareas',
    },
  ]
  const visibleCharts = chartDefinitions.filter((chart) => chart.access === 'attendance' ? canViewAttendance : canViewTasks)
  const selectedChart = chartDefinitions.find((chart) => chart.id === selectedChartId)

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
        {visibleCharts.map((chart) => renderChart(chart, () => setSelectedChartId(chart.id)))}
      </section>

      {selectedChart && <Modal className="evolution-chart-dialog" labelledBy="evolution-chart-dialog-title" onClose={() => setSelectedChartId(null)}>
        <div className="evolution-chart-dialog-toolbar">
          <span className="eyebrow">EVOLUCIÓN AMPLIADA</span>
          <button aria-label="Cerrar gráfica ampliada" className="modal-close-button" onClick={() => setSelectedChartId(null)} type="button">×</button>
        </div>
        {renderChart(selectedChart, undefined, 'evolution-chart-dialog-title')}
      </Modal>}
    </div>
  )
}

function renderChart(chart: EvolutionChartDefinition, onOpen?: () => void, titleId?: string) {
  if (chart.kind === 'comparison') return <EvolutionComparisonChart key={chart.id} onOpen={onOpen} series={chart.series} title={chart.title} titleId={titleId} unit={chart.unit} />
  return <EvolutionChart key={chart.id} color={chart.color} fixedMax={chart.fixedMax} labelFormatter={chart.labelFormatter} onOpen={onOpen} points={chart.points} title={chart.title} titleId={titleId} unit={chart.unit} />
}

type EvolutionSeries = {
  label: string
  color: string
  points: EvolutionPoint[]
}

function EvolutionComparisonChart({ onOpen, title, series, titleId, unit }: { onOpen?: () => void; title: string; series: EvolutionSeries[]; titleId?: string; unit: string }) {
  const width = 760
  const height = 270
  const left = 42
  const right = 15
  const top = 18
  const bottom = 85
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const points = series[0]?.points ?? []
  const values = series.flatMap((item) => item.points.map((point) => point.value)).filter((value): value is number => value !== null)
  const maxValue = niceMax(values)
  const x = (index: number) => points.length === 1 ? left + plotWidth / 2 : left + (index * plotWidth) / (points.length - 1)
  const y = (value: number) => top + plotHeight - (value / maxValue) * plotHeight
  const accessibleValues = series.map((item) => `${item.label}: ${item.points.map((point) => `${monthLabel(point.month)} ${point.value === null ? 'sin datos' : formatNumber(point.value)}`).join(', ')}`).join('. ')

  return (
    <article
      aria-label={onOpen ? `Abrir gráfica ${title}` : undefined}
      className={`evolution-chart-card${onOpen ? ' evolution-chart-card-interactive' : ''}`}
      onClick={onOpen}
      onKeyDown={onOpen ? (event: KeyboardEvent<HTMLElement>) => handleChartKeyDown(event, onOpen) : undefined}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
      <div className="evolution-chart-heading">
        <div><span className="eyebrow">EVOLUCIÓN MENSUAL</span><h2 id={titleId}>{title}</h2></div>
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
            <text fill="#6b7e78" fontSize="12" textAnchor="end" x={left - 8} y={lineY + 4}>{formatNumber(value)}</text>
          </g>
        })}
        {series.map((item) => linePaths(item.points, x, y).map((path, index) => <path d={path} fill="none" key={`${item.label}-${index}`} stroke={item.color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />))}
        {series.map((item) => item.points.map((point, index) => point.value === null ? null : (
          <circle cx={x(index)} cy={y(point.value)} fill="white" key={`${item.label}-${point.month}`} r="5" stroke={item.color} strokeWidth="3">
            <title>{item.label}: {formatNumber(point.value)}</title>
          </circle>
        )))}
        {points.map((point, index) => <g key={`label-${point.month}`}>
          <text fill={point.value === null ? '#b1beb9' : '#354e46'} fontSize="11" textAnchor="middle" x={x(index)} y={height - 7}>{point.value === null ? '—' : series.map((item) => {
            const seriesPoint = item.points[index]
            return seriesPoint?.value === null || seriesPoint === undefined ? '—' : formatNumber(seriesPoint.value)
          }).join(' / ')}</text>
          <text fill="#657872" fontSize="11" textAnchor="end" transform={`rotate(-90 ${x(index)} ${height - 50})`} x={x(index)} y={height - 50}>{monthLabel(point.month)}</text>
        </g>)}
      </svg>
      <small className="evolution-chart-unit">{unit}</small>
    </article>
  )
}

function EvolutionChart({ title, points, color, fixedMax, unit, labelFormatter, onOpen, titleId }: {
  title: string
  points: EvolutionPoint[]
  color: string
  fixedMax?: number
  unit: string
  labelFormatter: (value: number) => string
  onOpen?: () => void
  titleId?: string
}) {
  const width = 760
  const height = 270
  const left = 42
  const right = 15
  const top = 18
  const bottom = 85
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
    <article
      aria-label={onOpen ? `Abrir gráfica ${title}` : undefined}
      className={`evolution-chart-card${onOpen ? ' evolution-chart-card-interactive' : ''}`}
      onClick={onOpen}
      onKeyDown={onOpen ? (event: KeyboardEvent<HTMLElement>) => handleChartKeyDown(event, onOpen) : undefined}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
      <div className="evolution-chart-heading">
        <div><span className="eyebrow">EVOLUCIÓN MENSUAL</span><h2 id={titleId}>{title}</h2></div>
        {lastPoint && lastPoint.value !== null && <div className="evolution-chart-latest"><strong>{labelFormatter(lastPoint.value)}</strong><small>Último dato · {formatDate(lastPoint.month, { month: 'long', year: 'numeric' })}</small></div>}
      </div>
      <svg aria-label={`${title}: ${accessibleValues}`} className="evolution-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
        {[0, .5, 1].map((ratio) => {
          const value = maxValue * ratio
          const lineY = y(value)
          return <g key={ratio}>
            <line stroke="#dce8e3" strokeDasharray={ratio === 0 ? undefined : '3 5'} x1={left} x2={width - right} y1={lineY} y2={lineY} />
            <text fill="#6b7e78" fontSize="12" textAnchor="end" x={left - 8} y={lineY + 4}>{labelFormatter(value)}</text>
          </g>
        })}
        {paths.map((path, index) => <path d={path} fill="none" key={index} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />)}
        {points.map((point, index) => point.value === null ? null : (
          <circle cx={x(index)} cy={y(point.value)} fill="white" key={point.month} r="5" stroke={color} strokeWidth="3">
            <title>{labelFormatter(point.value)}</title>
          </circle>
        ))}
        {points.map((point, index) => <g key={`label-${point.month}`}>
          <text fill={point.value === null ? '#b1beb9' : '#354e46'} fontSize="11" textAnchor="middle" x={x(index)} y={height - 7}>{point.value === null ? '—' : labelFormatter(point.value)}</text>
          <text fill="#657872" fontSize="11" textAnchor="end" transform={`rotate(-90 ${x(index)} ${height - 50})`} x={x(index)} y={height - 50}>{monthLabel(point.month)}</text>
        </g>)}
      </svg>
      <small className="evolution-chart-unit">{unit}</small>
    </article>
  )
}

function handleChartKeyDown(event: KeyboardEvent<HTMLElement>, onOpen: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  onOpen()
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
