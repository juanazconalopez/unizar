import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Modal } from '../../components/ui/Modal'
import { formatDate, todayIso } from '../../lib/dates'
import { canViewTeamData, isPlayer } from '../../lib/permissions'
import { canUserCompleteTask } from '../../lib/tasks'
import type { AttendanceRecord, Match, PlayerSeasonSummary, Profile, ResultValues, Season, SeasonPlayer, TaskResult, TeamAnnouncement, TodayBirthday, TrainingSession, TrainingTask } from '../../types'
import { PlayerSeasonSummaryDialog } from '../matches/PlayerSeasonSummaryDialog'
import { TaskCard } from '../tasks/TaskCard'
import { TaskResultsSummary } from '../tasks/TaskResultsSummary'
import type { PendingSurvey } from '../../services/surveysService'
import { SurveyResponseDialog } from '../surveys/SurveyResponseDialog'
import { selectDashboardSummary } from './dashboardSelectors'

const EMPTY_ITEMS: never[] = []

export function Dashboard({ profile, profiles = EMPTY_ITEMS, memberships, tasks, announcements = EMPTY_ITEMS, matches = EMPTY_ITEMS, results, attendance, trainingSessions = EMPTY_ITEMS, season, todayBirthdays = EMPTY_ITEMS, userId, onGoToTasks, onOpenMatch, onOpenAnnouncement, onLoadSeasonSummary, onLoadPendingSurveys, onSaveResult }: {
  profile: Profile
  profiles?: Profile[]
  memberships: SeasonPlayer[]
  tasks: TrainingTask[]
  results: TaskResult[]
  attendance: AttendanceRecord[]
  trainingSessions?: TrainingSession[]
  announcements?: TeamAnnouncement[]
  matches?: Match[]
  season?: Season
  todayBirthdays?: TodayBirthday[]
  userId: string
  onGoToTasks?: () => void
  onOpenMatch?: (match: Match) => void
  onOpenAnnouncement?: (announcement: TeamAnnouncement) => void
  onLoadSeasonSummary?: (seasonId: string, playerId: string) => Promise<PlayerSeasonSummary>
  onLoadPendingSurveys?: () => Promise<PendingSurvey[]>
  onSaveResult?: (task: TrainingTask, values: ResultValues) => Promise<void>
}) {
  const [motivationVariant] = useState(() => Math.random())
  const [seasonSummary, setSeasonSummary] = useState<PlayerSeasonSummary | null>(null)
  const [seasonSummaryUnavailable, setSeasonSummaryUnavailable] = useState(false)
  const [showSeasonSummary, setShowSeasonSummary] = useState(false)
  const [pendingSurveys, setPendingSurveys] = useState<PendingSurvey[]>([])
  const [showPendingSurveys, setShowPendingSurveys] = useState(false)
  const [respondingSurvey, setRespondingSurvey] = useState<PendingSurvey | null>(null)
  const today = todayIso()
  const isTeamDashboard = canViewTeamData(profile)
  const { weekTasks, ownResultsByTask, personal, team, nextMatch, nextAnnouncements, attentionCount } = useMemo(() => selectDashboardSummary({
    isTeamDashboard, today, userId, profiles, memberships, tasks, results, attendance, trainingSessions, announcements, matches, season,
  }), [isTeamDashboard, today, userId, profiles, memberships, tasks, results, attendance, trainingSessions, announcements, matches, season])
  const motivation = personal ? playerMotivation({
    attendanceRate: personal.attendanceRate,
    attendanceTotal: personal.attendanceTotal,
    completedTasks: personal.completed,
    totalTasks: weekTasks.length,
    variant: motivationVariant,
  }) : undefined

  useEffect(() => {
    let active = true
    if (isTeamDashboard || !season || !onLoadSeasonSummary) return () => { active = false }
    void onLoadSeasonSummary(season.id, userId)
      .then((summary) => { if (active) setSeasonSummary(summary) })
      .catch(() => { if (active) setSeasonSummaryUnavailable(true) })
    return () => { active = false }
  }, [isTeamDashboard, onLoadSeasonSummary, season, userId])

  useEffect(() => {
    let active = true
    if (!onLoadPendingSurveys) return () => { active = false }
    void onLoadPendingSurveys().then((surveys) => {
      if (!active) return
      const unanswered = surveys.filter((survey) => !survey.responded)
      setPendingSurveys(surveys)
      setShowPendingSurveys(unanswered.length > 0)
      setRespondingSurvey(unanswered.length === 1 ? unanswered[0] : null)
    }).catch(() => undefined)
    return () => { active = false }
  }, [onLoadPendingSurveys])

  return (
    <div className="page">
      <PageHeader
        eyebrow={isTeamDashboard ? 'PANEL DEL EQUIPO' : 'PANEL PERSONAL'}
        title={`Hola, ${profile.display_name.split(' ')[0]}`}
        subtitle={isTeamDashboard ? 'Este es el seguimiento de las tareas publicadas para esta semana.' : 'Este es el resumen de tu semana y de la temporada.'}
      />
      {todayBirthdays.length > 0 && <div className="birthday-today-banner" role="status">
        <span aria-hidden="true">🎂</span>
        <p><strong>{birthdayHeading(todayBirthdays)}</strong><small>¡Que pase un día estupendo!</small></p>
      </div>}
      <section className={`dashboard-stats-grid${isTeamDashboard ? ' staff-dashboard-stats' : ''}`}>
        {team ? <>
          <StatCard label="Jugadoras activas" value={`${team.activePlayerCount}/${team.eligiblePlayerCount}`} note="Han realizado al menos una tarea" tone="blue" />
          <TeamProgressCard completed={team.validResults.length} completion={team.completion} total={team.expectedResults} />
        </> : personal && <>
          <WeekProgressCard completed={personal.completed} completion={personal.completion} total={weekTasks.length} />
          <StatCard label="Asistencia a campo" value={personal.attendanceTotal ? `${personal.attendedSessions}/${personal.attendanceTotal}` : '—'} note={personal.attendanceTotal ? `${personal.attendanceRate}% esta temporada` : 'Sin entrenamientos realizados'} tone="lime" />
        </>}
        {!isTeamDashboard && season && onLoadSeasonSummary && <button className="stat-card season dashboard-season-card" disabled={!seasonSummary} onClick={() => setShowSeasonSummary(true)} type="button">
          <span>Mi temporada</span>
          <strong>{seasonSummary ? seasonSummary.callups.official + seasonSummary.callups.friendly : '—'}</strong>
          <small>{seasonSummary ? `${seasonSummary.callups.official} oficiales · ${seasonSummary.callups.friendly} amistosas` : seasonSummaryUnavailable ? 'Resumen no disponible' : 'Cargando convocatorias…'}</small>
          {seasonSummary && <em>Ver resumen <Icon name="arrow" size={14} /></em>}
        </button>}
      </section>
      {showSeasonSummary && season && onLoadSeasonSummary && seasonSummary && <PlayerSeasonSummaryDialog initialSummary={seasonSummary} onClose={() => setShowSeasonSummary(false)} onLoad={onLoadSeasonSummary} playerId={userId} season={season} />}
      {showPendingSurveys && !respondingSurvey && <Modal labelledBy="pending-surveys-title" onClose={() => setShowPendingSurveys(false)}>
        <div className="panel-form-heading"><div><span className="eyebrow">ENCUESTAS PENDIENTES</span><h2 id="pending-surveys-title">Tu opinión cuenta</h2></div><div className="modal-later-actions"><button aria-label="Responder más tarde y cerrar encuestas pendientes" className="primary-button compact" onClick={() => setShowPendingSurveys(false)} type="button">Responder más tarde</button></div></div>
        <p>Responde las encuestas activas antes de su fecha límite.</p>
          <div className="dashboard-next-list">{pendingSurveys.filter((survey) => !survey.responded).map((survey) => <button key={survey.id} onClick={() => setRespondingSurvey(survey)} type="button"><span className="dashboard-next-icon survey">Q</span><span><strong>{survey.title}</strong><small>{survey.description ? `${survey.description} · ` : ''}Hasta el {formatDate(survey.endsOn, { day: 'numeric', month: 'long' })}</small></span><span className="secondary-button compact">Responder</span></button>)}</div>
      </Modal>}
      {respondingSurvey && <SurveyResponseDialog onClose={() => { setRespondingSurvey(null); setShowPendingSurveys(false) }} onDone={async () => { const surveys = await onLoadPendingSurveys?.() ?? []; const unanswered = surveys.filter((survey) => !survey.responded); setPendingSurveys(surveys); setRespondingSurvey(null); setShowPendingSurveys(unanswered.length > 0) }} surveyId={respondingSurvey.id} />}
      <section className={`motivation-card${isTeamDashboard ? ' team-insight-card' : ''}`}>
        <span><Icon name="spark" size={22} /></span>
        <div><strong>{team?.insight.title ?? motivation?.title}</strong><p>{team?.insight.text ?? motivation?.text}</p></div>
      </section>
      {attentionCount > 0 && (
        <details className="dashboard-next dashboard-attention">
          <summary><span><span className="eyebrow">AGENDA</span><strong>Para tener en cuenta</strong></span><small>{attentionCount} {attentionCount === 1 ? 'elemento' : 'elementos'}</small><Icon name="arrow" size={16} /></summary>
          <div className="dashboard-next-list">
            {nextMatch && <button onClick={() => onOpenMatch?.(nextMatch)} type="button"><span className="dashboard-next-icon match"><Icon name="calendar" size={17} /></span><span><strong>Próximo partido · {nextMatch.opponent}</strong><small>{formatDate(nextMatch.match_date, { weekday: 'long', day: 'numeric', month: 'long' })}</small></span><Icon name="arrow" size={16} /></button>}
            {nextAnnouncements.map((announcement) => <button key={announcement.id} onClick={() => onOpenAnnouncement?.(announcement)} type="button"><span className="dashboard-next-icon announcement"><Icon name="bell" size={17} /></span><span><strong>{announcement.title}</strong><small>{formatDate(announcement.announcement_date, { weekday: 'long', day: 'numeric', month: 'long' })}</small></span><Icon name="arrow" size={16} /></button>)}
          </div>
        </details>
      )}
      <section className="section-block">
        <div className="section-heading">
          <div><span className="eyebrow">SEMANA ACTUAL</span><h2>{isTeamDashboard ? 'Entrenamientos del equipo' : 'Tus entrenamientos'}</h2></div>
          {onGoToTasks && <button className="text-button" onClick={onGoToTasks}>Ver todas <Icon name="arrow" size={17} /></button>}
        </div>
        {weekTasks.length ? (
          <div className="task-list">
            {weekTasks.slice(0, 4).map((task) => (
              <TaskCard
                key={task.id}
                managementSummary={team ? <TaskResultsSummary
                  eligibleCount={team.eligiblePlayerIdsByTask.get(task.id)?.size ?? 0}
                  profiles={profiles}
                  results={team.validResults}
                  task={task}
                /> : undefined}
                result={ownResultsByTask.get(task.id)}
                task={task}
                onSave={isPlayer(profile) && canUserCompleteTask(task, memberships, userId) ? onSaveResult : undefined}
              />
            ))}
          </div>
        ) : <EmptyState title="Semana despejada" text="Todavía no hay entrenamientos publicados para esta semana." />}
      </section>
    </div>
  )
}

function birthdayHeading(birthdays: TodayBirthday[]) {
  const names = birthdays.map((birthday) => birthday.display_name)
  if (names.length === 1) return `Hoy es el cumpleaños de ${names[0]}`
  return `Hoy es el cumpleaños de ${new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(names)}`
}

function playerMotivation({ attendanceRate, attendanceTotal, completedTasks, totalTasks, variant }: {
  attendanceRate: number
  attendanceTotal: number
  completedTasks: number
  totalTasks: number
  variant: number
}) {
  const messages = [
    { title: 'Cada paso cuenta', text: 'Entrenar con el equipo y dedicar unos minutos a tus tareas te ayuda a seguir creciendo.' },
    { title: 'Tu esfuerzo suma', text: 'Cada entrenamiento y cada tarea completada aportan al progreso de todo el equipo.' },
    { title: 'Seguimos avanzando juntas', text: 'La próxima sesión y la siguiente tarea son nuevas oportunidades para mejorar.' },
  ]

  if (!attendanceTotal) {
    messages.push({ title: 'El equipo te espera', text: 'Ven al próximo entrenamiento y empieza a construir tu constancia junto al equipo.' })
  } else if (attendanceRate >= 90) {
    messages.push({ title: 'Tu constancia empuja al equipo', text: `Has estado en el ${attendanceRate}% de los entrenamientos. ¡Sigue así!` })
  } else if (attendanceRate >= 60) {
    messages.push({ title: 'Vas por muy buen camino', text: `Llevas un ${attendanceRate}% de asistencia. Cada sesión te hace más fuerte.` })
  } else {
    messages.push({ title: 'El próximo entrenamiento cuenta', text: 'Cada vez que vienes, avanzas tú y ayudas a crecer al equipo.' })
  }

  if (totalTasks > 0 && completedTasks === totalTasks) {
    messages.push({ title: '¡Semana completada!', text: `Has realizado las ${totalTasks} ${totalTasks === 1 ? 'tarea' : 'tareas'} de esta semana. Gran trabajo.` })
  } else if (totalTasks > completedTasks) {
    const pendingTasks = totalTasks - completedTasks
    messages.push({ title: 'Un pequeño paso para hoy', text: `Completa ${pendingTasks === 1 ? 'la tarea que tienes pendiente' : `una de tus ${pendingTasks} tareas pendientes`} y sigue sumando a tu semana.` })
  }

  return messages[Math.min(Math.floor(variant * messages.length), messages.length - 1)]
}

function StatCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return <article className={`stat-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

function WeekProgressCard({ completed, total, completion }: { completed: number; total: number; completion: number }) {
  const pending = Math.max(0, total - completed)
  return <article className="stat-card green week-progress-card"><span>Esta semana</span><div><strong>{completed}/{total}</strong><b>{completion}%</b></div><div aria-label={`${completion}% completado`} className="week-progress-track"><i style={{ width: `${completion}%` }} /></div><small>{pending ? `${pending} ${pending === 1 ? 'tarea pendiente' : 'tareas pendientes'}` : total ? 'Semana completada' : 'Sin tareas asignadas'}</small></article>
}

function TeamProgressCard({ completed, total, completion }: { completed: number; total: number; completion: number }) {
  const pending = Math.max(0, total - completed)
  return <article className="stat-card green week-progress-card"><span>Progreso del equipo</span><div><strong>{completed}/{total}</strong><b>{completion}%</b></div><div aria-label={`${completion}% completado`} className="week-progress-track"><i style={{ width: `${completion}%` }} /></div><small>{pending ? `${pending} ${pending === 1 ? 'realización pendiente' : 'realizaciones pendientes'}` : total ? 'Todas las tareas completadas' : 'Sin realizaciones esperadas'}</small></article>
}
