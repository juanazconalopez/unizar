import type { SavedReportEvent } from '../../services/matchReportService'
import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, formatWeek, mondayFor, monthEnd, monthStart, todayIso } from '../../lib/dates'
import { useSeasonHolidayDates } from '../../hooks/useSeasonHolidayDates'
import { activePlayers, membershipCoversDate, seasonForDate } from '../../lib/selectors'
import { compareTaskOrder } from '../../lib/taskOrder'
import { compareMatches } from '../../lib/seasonCompetitions'
import type {
  AnnouncementValues,
  AvailabilityStatus,
  Match,
  MatchAvailability,
  MatchLineup,
  MatchValues,
  PlayerSeasonSummary,
  Profile,
  Season,
  SeasonCompetition,
  SeasonTeam,
  SeasonCallupReport,
  SeasonBirthday,
  SeasonPlayer,
  TaskResult,
  TaskStatus,
  TaskValues,
  TeamAnnouncement,
  TrainingPlanCalendarItem,
  TrainingTask,
} from '../../types'
import { MatchAvailabilityDialog } from '../matches/MatchAvailabilityDialog'
import { MatchCard } from '../matches/MatchCard'
import { MatchDetailDialog } from '../matches/MatchDetailDialog'
import { InternalFixtureReviewDialog } from '../matches/InternalFixtureReviewDialog'
import { visibleFixtureMatches } from '../matches/internalFixtures'
import { MatchForm } from '../matches/MatchForm'
import { MatchLineupDialog } from '../matches/MatchLineupDialog'
import { SeasonCallupReportView } from '../matches/SeasonCallupReportView'
import { SurveyClosureCards } from '../surveys/SurveyClosureCards'
import { HolidayDayContext } from './HolidayDayContext'
import { AnnouncementCard } from '../tasks/AnnouncementCard'
import { AnnouncementForm } from '../tasks/AnnouncementForm'
import { TaskAlerts } from '../tasks/TaskAlerts'
import { TaskCard } from '../tasks/TaskCard'
import { TaskForm } from '../tasks/TaskForm'
import { TaskPlanningCalendar } from '../tasks/TaskPlanningCalendar'
import { TaskResultsSummary } from '../tasks/TaskResultsSummary'
import { StatusControl } from '../tasks/StatusControl'
import type { CalendarSurvey } from '../tasks/calendarSurveys'

type CalendarViewProps = {
  permissions?: {
    taskCreate: boolean; taskEdit: boolean; taskDelete: boolean; taskPublish: boolean; taskReorder: boolean; taskResults: boolean
    announcementCreate: boolean; announcementEdit: boolean; announcementDelete: boolean; announcementPublish: boolean
    matchCreate: boolean; matchEdit: boolean; matchDelete: boolean; availabilityEdit: boolean
    lineupEdit: boolean; lineupPublish: boolean; lineupUnlock: boolean; report: boolean
  }
  announcements: TeamAnnouncement[]
  availability: MatchAvailability[]
  birthdays?: SeasonBirthday[]
  lineups: MatchLineup[]
  matches: Match[]
  memberships: SeasonPlayer[]
  profiles: Profile[]
  isOwner?: boolean
  results: TaskResult[]
  seasons: Season[]
  seasonCompetitions?: SeasonCompetition[]
  seasonTeams?: SeasonTeam[]
  tasks: TrainingTask[]
  focusedDate?: string
  focusedAnnouncementId?: string
  onCreateTask: (values: TaskValues) => Promise<void>
  onDeleteTask: (task: TrainingTask) => Promise<void>
  onUpdateTask: (task: TrainingTask, values: TaskValues) => Promise<void>
  onLoadTaskRange: (fromWeek: string, toWeek: string) => Promise<void>
  onReorderTasks?: (taskIds: string[]) => Promise<void>
  onTaskStatusChange: (taskId: string, status: TaskStatus) => Promise<void>
  onSaveAnnouncement: (announcement: TeamAnnouncement | undefined, values: AnnouncementValues) => Promise<void>
  onDeleteAnnouncement: (announcement: TeamAnnouncement) => Promise<void>
  onAnnouncementStatusChange: (id: string, status: TaskStatus) => Promise<void>
  onDeleteMatch: (match: Match) => Promise<void>
  onLoadMatchMonth: (month: string, options?: { force?: boolean }) => Promise<void>
  onSavePlayerAvailability: (match: Match, playerId: string, status: AvailabilityStatus, comment: string) => Promise<void>
  onSaveLineup: (match: Match, entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) => Promise<void>
  onSaveMatch: (match: Match | undefined, values: MatchValues) => Promise<void>
  onSaveReport?: (match: Match, file: File, scores: { team: number; opponent: number }, duration: number, events: SavedReportEvent[], reviewed: boolean) => Promise<void>
  onUnlockLineup: (match: Match) => Promise<void>
  onFinalizeInternal?: (match: Match) => Promise<void>
  onLoadCallupReport: (seasonId: string) => Promise<SeasonCallupReport>
  onLoadPlayerSeasonSummary: (seasonId: string, playerId: string) => Promise<PlayerSeasonSummary>
  onLoadTrainingPlans: (fromDate: string, toDate: string) => Promise<TrainingPlanCalendarItem[]>
  onOpenTrainingPlan: (trainingPlanId: string) => void
  onEditTrainingPlan?: (trainingPlanId: string) => void
  holidays?: string[]
  onLoadSurveyClosures?: (from: string, until: string) => Promise<CalendarSurvey[]>
  onOpenSurveyResults?: (surveyId: string) => void
}

export function CalendarView(props: CalendarViewProps) {
  const access = props.permissions ?? {
    taskCreate: true, taskEdit: true, taskDelete: true, taskPublish: true, taskReorder: true, taskResults: true,
    announcementCreate: true, announcementEdit: true, announcementDelete: true, announcementPublish: true,
    matchCreate: true, matchEdit: true, matchDelete: true, availabilityEdit: true,
    lineupEdit: true, lineupPublish: true, lineupUnlock: true, report: true,
  }
  const { focusedDate, onLoadMatchMonth, onLoadTaskRange, onLoadTrainingPlans, onLoadSurveyClosures, onOpenSurveyResults } = props
  const today = todayIso()
  const [selectedDate, setSelectedDate] = useState(props.focusedDate ?? today)
  const [month, setMonth] = useState(`${(props.focusedDate ?? today).slice(0, 7)}-01`)
  const [reportOpen, setReportOpen] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [taskForm, setTaskForm] = useState<{ task?: TrainingTask; template?: TrainingTask } | null>(null)
  const [announcementForm, setAnnouncementForm] = useState<TeamAnnouncement | null | undefined>(undefined)
  const [matchForm, setMatchForm] = useState<Match | null | undefined>(undefined)
  const [reorderingTaskId, setReorderingTaskId] = useState<string | null>(null)
  const [lineupMatch, setLineupMatch] = useState<{ match: Match; editable: boolean } | null>(null)
  const [detailMatch, setDetailMatch] = useState<Match | null>(null)
  const [reviewFixtureId, setReviewFixtureId] = useState<string | null>(null)
  const [availabilityMatch, setAvailabilityMatch] = useState<Match | null>(null)
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlanCalendarItem[]>([])
  const [surveyClosures, setSurveyClosures] = useState<CalendarSurvey[]>([])
  const holidays = useSeasonHolidayDates(props.seasons.map((season) => season.id), props.holidays)
  const selectedWeek = mondayFor(selectedDate)
  const selectedTasks = props.tasks
    .filter((task) => task.week_start === selectedWeek)
    .sort(compareTaskOrder)
  const selectedAnnouncements = props.announcements.filter((announcement) => announcement.announcement_date === selectedDate)
  const selectedMatches = visibleFixtureMatches(props.matches)
    .filter((match) => match.match_date === selectedDate)
    .sort(compareMatches)
  const selectedTrainingPlans = trainingPlans.filter((plan) => plan.session_date === selectedDate)
  const selectedBirthdays = (props.birthdays ?? []).filter((birthday) => birthday.birthday_on === selectedDate)
  const selectedSurveyClosures = surveyClosures.filter((survey) => survey.result_date === selectedDate)
  const hasSelectedDayContent = selectedBirthdays.length + selectedAnnouncements.length + selectedMatches.length + selectedTrainingPlans.length + selectedSurveyClosures.length > 0 || holidays.includes(selectedDate)
  const activeSeason = seasonForDate(props.seasons, today)

  const loadTrainingPlans = useCallback(async (targetMonth: string) => {
    try {
      setTrainingPlans(await onLoadTrainingPlans(monthStart(targetMonth), monthEnd(targetMonth)))
    } catch {
      setTrainingPlans([])
    }
  }, [onLoadTrainingPlans])
  const loadSurveyClosures = useCallback(async (targetMonth: string) => {
    if (!onLoadSurveyClosures) return
    try { setSurveyClosures(await onLoadSurveyClosures(monthStart(targetMonth), monthEnd(targetMonth))) } catch { setSurveyClosures([]) }
  }, [onLoadSurveyClosures])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTrainingPlans(month), 0)
    return () => window.clearTimeout(timer)
  }, [loadTrainingPlans, month])
  useEffect(() => { const timer = window.setTimeout(() => void loadSurveyClosures(month), 0); return () => window.clearTimeout(timer) }, [loadSurveyClosures, month])

  useEffect(() => {
    if (!focusedDate) return
    const focusedMonth = `${focusedDate.slice(0, 7)}-01`
    void Promise.all([
      onLoadTaskRange(mondayFor(monthStart(focusedMonth)), mondayFor(monthEnd(focusedMonth))),
      onLoadMatchMonth(focusedMonth, { force: true }),
    ]).catch(() => undefined)
  }, [focusedDate, onLoadMatchMonth, onLoadTaskRange])

  async function changeMonth(nextMonth: string) {
    setMonth(nextMonth)
    await Promise.all([
      props.onLoadTaskRange(mondayFor(monthStart(nextMonth)), mondayFor(monthEnd(nextMonth))),
      props.onLoadMatchMonth(nextMonth),
      loadTrainingPlans(nextMonth),
    ]).catch(() => undefined)
  }

  function goToToday() {
    setSelectedDate(today)
    const currentMonth = `${today.slice(0, 7)}-01`
    if (currentMonth !== month) void changeMonth(currentMonth)
  }

  async function refreshDate(date: string) {
    await Promise.all([
      props.onLoadTaskRange(mondayFor(date), mondayFor(date)),
      props.onLoadMatchMonth(`${date.slice(0, 7)}-01`),
      loadTrainingPlans(`${date.slice(0, 7)}-01`),
    ])
  }

  function taskActions(task: TrainingTask) {
    const ordered = props.tasks.filter((item) => item.week_start === task.week_start).sort(compareTaskOrder)
    const index = ordered.findIndex((item) => item.id === task.id)
    return <>
      {access.taskReorder && props.onReorderTasks && ordered.length > 1 && <div aria-label={`Ordenar ${task.title}`} className="task-order-actions" role="group">
        <button aria-label={`Subir ${task.title}`} className="secondary-button compact" disabled={index <= 0 || reorderingTaskId !== null} onClick={() => void moveTask(task, -1)} title="Mover antes" type="button">↑</button>
        <button aria-label={`Bajar ${task.title}`} className="secondary-button compact" disabled={index < 0 || index >= ordered.length - 1 || reorderingTaskId !== null} onClick={() => void moveTask(task, 1)} title="Mover después" type="button">↓</button>
      </div>}
      {access.taskPublish && <StatusControl status={task.status} onChange={async (status) => {
        await props.onTaskStatusChange(task.id, status)
        await props.onLoadTaskRange(task.week_start, task.week_start)
      }} />}
      {access.taskEdit && <button className="secondary-button compact" onClick={() => setTaskForm({ task })} type="button">Editar tarea</button>}
      {access.taskCreate && <button className="secondary-button compact" onClick={() => setTaskForm({ template: task })} type="button">Copiar</button>}
    </>
  }

  async function moveTask(task: TrainingTask, offset: -1 | 1) {
    if (!props.onReorderTasks) return
    const ordered = props.tasks.filter((item) => item.week_start === task.week_start).sort(compareTaskOrder)
    const index = ordered.findIndex((item) => item.id === task.id)
    const target = index + offset
    if (index < 0 || target < 0 || target >= ordered.length) return
    const next = [...ordered]
    ;[next[index], next[target]] = [next[target], next[index]]
    setReorderingTaskId(task.id)
    try {
      await props.onReorderTasks(next.map((item) => item.id))
      await props.onLoadTaskRange(task.week_start, task.week_start)
    } finally {
      setReorderingTaskId(null)
    }
  }

  function announcementActions(announcement: TeamAnnouncement) {
    return access.announcementEdit ? <button aria-label={`Editar aviso ${announcement.title}`} className="announcement-edit-button" onClick={() => setAnnouncementForm(announcement)} title="Editar aviso" type="button">✎</button> : undefined
  }

  function renderMatch(match: Match) {
    const eligiblePlayerCount = activePlayers(props.profiles).filter((profile) => props.memberships.some((membership) => (
      membership.player_id === profile.id
      && membership.season_id === match.season_id
      && membershipCoversDate(membership, match.match_date)
    ))).length
    return <MatchCard
      availability={props.availability.filter((item) => item.match_id === match.id)}
      canEditMatch={access.matchEdit}
      canViewAvailability
      eligiblePlayerCount={eligiblePlayerCount}
      isPlayer={false}
      key={match.id}
      match={match}
      onOpen={() => setDetailMatch(match)}
      onSaveAvailability={async () => undefined}
      onViewAvailability={() => setAvailabilityMatch(match)}
    />
  }

  const hasSelectedContent = selectedBirthdays.length + selectedAnnouncements.length + selectedMatches.length + selectedTrainingPlans.length + selectedTasks.length + selectedSurveyClosures.length > 0

  return <div className="page">
    <PageHeader
      action={access.report && <button className={reportOpen ? 'primary-button' : 'secondary-button'} onClick={() => setReportOpen((open) => !open)} type="button"><Icon name="statistics" size={18} />{reportOpen ? 'Volver al calendario' : 'Resumen de convocatorias'}</button>}
      eyebrow="PLANIFICACIÓN"
      subtitle="Organiza tareas, avisos, partidos y entrenamientos desde una única vista."
      title="Calendario"
    />

    {reportOpen ? <SeasonCallupReportView key={activeSeason?.id ?? 'no-active-season'} onLoad={props.onLoadCallupReport} onLoadPlayer={props.onLoadPlayerSeasonSummary} season={activeSeason} /> : <>
      <TaskAlerts currentWeek={mondayFor(today)} profiles={props.profiles} results={props.results} showFatigue={false} tasks={props.tasks} />
      <div className="task-calendar-view">
        <div className="planning-current-action"><button className="secondary-button compact" onClick={goToToday} type="button"><Icon name="calendar" size={16} />Ir a la semana actual</button></div>
        <TaskPlanningCalendar
          announcements={props.announcements}
          birthdays={props.birthdays}
          holidays={holidays}
          matches={visibleFixtureMatches(props.matches)}
          month={month}
          selectedDate={selectedDate}
          showLegend={false}
          tasks={props.tasks}
          trainingPlans={trainingPlans}
          surveys={surveyClosures}
          onMonthChange={(nextMonth) => void changeMonth(nextMonth)}
          onSelectDate={setSelectedDate}
        />
        <section className="selected-planning-week">
          {hasSelectedDayContent && <div className="selected-day-date"><h2>{formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>}
          {holidays.includes(selectedDate) && <HolidayDayContext />}
          {selectedBirthdays.length > 0 && <div className="birthday-day-detail" role="status">
            <span aria-hidden="true">🎂</span>
            <p><strong>Cumpleaños del día</strong>{selectedBirthdays.map((birthday) => `${birthday.display_name} cumple ${birthday.age_turning} años`).join(' · ')}</p>
          </div>}
          {selectedAnnouncements.length > 0 && <div className="selected-calendar-group selected-day-announcements">
            <div className="task-week-heading"><h2>Avisos</h2><span>{selectedAnnouncements.length}</span></div>
            <div className="task-list">{selectedAnnouncements.map((announcement) => <AnnouncementCard actions={announcementActions(announcement)} announcement={announcement} initialOpen={props.focusedAnnouncementId === announcement.id} key={announcement.id} />)}</div>
          </div>}
          {selectedSurveyClosures.length > 0 && <SurveyClosureCards surveys={selectedSurveyClosures} onOpen={(survey) => onOpenSurveyResults?.(survey.id)} />}
          {selectedTrainingPlans.length > 0 && <div className="selected-calendar-group selected-day-trainings">
            <div className="task-week-heading"><h2>Entrenamientos</h2><span>{selectedTrainingPlans.length}</span></div>
            <div className="calendar-training-list">{selectedTrainingPlans.map((plan) => <article className={plan.status === 'draft' ? 'training-calendar-draft' : undefined} key={plan.id}><span>E</span><div><div className="calendar-training-title"><strong>{plan.title}</strong>{plan.status === 'draft' && <b>Borrador</b>}</div><small>{plan.status === 'draft' ? 'Solo visible para el equipo técnico' : 'Plan de entrenamiento preparado'}</small></div>{plan.status === 'draft' ? props.onEditTrainingPlan && <button className="secondary-button compact" onClick={() => props.onEditTrainingPlan?.(plan.id)} type="button"><Icon name="edit" size={14} />Editar entrenamiento</button> : <button className="secondary-button compact" onClick={() => props.onOpenTrainingPlan(plan.id)} type="button">Ver entrenamiento <Icon name="arrow" size={14} /></button>}</article>)}</div>
          </div>}
          {selectedMatches.length > 0 && <div className="selected-calendar-group selected-day-matches">
            <div className="task-week-heading"><h2>Partidos</h2><span>{selectedMatches.length}</span></div>
            <div className="match-list">{selectedMatches.map(renderMatch)}</div>
          </div>}
          <div className="selected-calendar-group selected-week-tasks">
            <div className="task-week-heading"><div><span className="eyebrow">TAREAS DE LA SEMANA</span><h2>{formatWeek(selectedWeek)}</h2></div><span>{selectedTasks.length} {selectedTasks.length === 1 ? 'tarea' : 'tareas'}</span></div>
            <div className="task-list">{selectedTasks.map((task) => <TaskCard hideWeek key={task.id} managerActions={taskActions(task)} managementSummary={access.taskResults ? <TaskResultsSummary profiles={props.profiles} results={props.results} task={task} /> : undefined} result={undefined} task={task} />)}</div>
          </div>
          {!hasSelectedContent && <EmptyState text="No hay tareas, avisos, partidos ni entrenamientos en este periodo." title="Sin planificación" />}
          {(access.taskCreate || access.announcementCreate || access.matchCreate) && <div className="selected-week-actions calendar-add-actions">
            <div className="calendar-add-menu">
              <button aria-expanded={addMenuOpen} className="primary-button" onClick={() => setAddMenuOpen((open) => !open)} type="button"><Icon name="plus" size={18} />Añadir</button>
              {addMenuOpen && <div className="calendar-add-options" role="menu">
                {access.taskCreate && <button onClick={() => { setTaskForm({}); setAddMenuOpen(false) }} role="menuitem" type="button">Nueva tarea</button>}
                {access.announcementCreate && <button onClick={() => { setAnnouncementForm(null); setAddMenuOpen(false) }} role="menuitem" type="button">Nuevo aviso</button>}
                {access.matchCreate && <button onClick={() => { setMatchForm(null); setAddMenuOpen(false) }} role="menuitem" type="button">Nuevo partido</button>}
              </div>}
            </div>
          </div>}
        </section>
      </div>
    </>}

    {taskForm && <TaskForm
      initialDate={taskForm.template?.week_start ?? selectedDate}
      canPublish={access.taskPublish}
      seasons={props.seasons}
      task={taskForm.task}
      template={taskForm.template}
      onCancel={() => setTaskForm(null)}
      onDelete={access.taskDelete ? async (task) => { await props.onDeleteTask(task); await props.onLoadTaskRange(task.week_start, task.week_start); setTaskForm(null) } : undefined}
      onSubmit={async (values) => {
        if (taskForm.task) await props.onUpdateTask(taskForm.task, values)
        else await props.onCreateTask(values)
        await props.onLoadTaskRange(mondayFor(values.date), mondayFor(values.date))
        setSelectedDate(values.date)
        setMonth(`${values.date.slice(0, 7)}-01`)
        setTaskForm(null)
      }}
    />}
    {announcementForm !== undefined && <AnnouncementForm
      announcement={announcementForm ?? undefined}
      canPublish={access.announcementPublish}
      initialDate={selectedDate}
      seasons={props.seasons}
      onCancel={() => setAnnouncementForm(undefined)}
      onDelete={access.announcementDelete ? async (announcement) => { await props.onDeleteAnnouncement(announcement); await props.onLoadTaskRange(mondayFor(announcement.announcement_date), mondayFor(announcement.announcement_date)); setAnnouncementForm(undefined) } : undefined}
      onSubmit={async (values) => { await props.onSaveAnnouncement(announcementForm ?? undefined, values); await props.onLoadTaskRange(mondayFor(values.date), mondayFor(values.date)); setSelectedDate(values.date); setMonth(`${values.date.slice(0, 7)}-01`); setAnnouncementForm(undefined) }}
    />}
    {matchForm !== undefined && <MatchForm
      competitions={props.seasonCompetitions}
      teams={props.seasonTeams}
      canManageInternal={props.isOwner}
      pairedMatch={props.matches.find((item) => item.id !== matchForm?.id && item.internal_fixture_id && item.internal_fixture_id === matchForm?.internal_fixture_id)}
      initialDate={selectedDate}
      match={matchForm ?? undefined}
      seasons={props.seasons}
      onCancel={() => setMatchForm(undefined)}
      onDelete={matchForm && access.matchDelete ? async (match) => { await props.onDeleteMatch(match); await props.onLoadMatchMonth(`${match.match_date.slice(0, 7)}-01`); setMatchForm(undefined) } : undefined}
      onSubmit={async (values) => { await props.onSaveMatch(matchForm ?? undefined, values); await refreshDate(values.matchDate); setSelectedDate(values.matchDate); setMonth(`${values.matchDate.slice(0, 7)}-01`); setMatchForm(undefined) }}
    />}
    {lineupMatch && <MatchLineupDialog
      availability={props.availability.filter((item) => item.match_id === lineupMatch.match.id)}
      canExport
      canPublish={access.lineupPublish && !lineupMatch.match.internal_fixture_id}
      canBorrowFromOtherTeams={props.isOwner}
      entries={props.lineups.filter((entry) => entry.match_id === lineupMatch.match.id)}
      match={lineupMatch.match}
      memberships={props.memberships}
      profiles={props.profiles}
      seasonTeams={props.seasonTeams}
      reservedPlayerIds={props.lineups.filter((entry) => entry.match_id !== lineupMatch.match.id && props.matches.some((item) => item.id === entry.match_id && item.match_date === lineupMatch.match.match_date && (!lineupMatch.match.internal_fixture_id || item.internal_fixture_id !== lineupMatch.match.internal_fixture_id))).map((entry) => entry.player_id)}
      onClose={() => setLineupMatch(null)}
      onUnlock={access.lineupUnlock && (!lineupMatch.match.internal_fixture_id || props.isOwner) ? async () => { await props.onUnlockLineup(lineupMatch.match); await props.onLoadMatchMonth(`${lineupMatch.match.match_date.slice(0, 7)}-01`) } : undefined}
      onSave={access.lineupEdit ? async (entries, published) => { await props.onSaveLineup(lineupMatch.match, entries, published); await props.onLoadMatchMonth(`${lineupMatch.match.match_date.slice(0, 7)}-01`); setLineupMatch(null) } : undefined}
    />}
    {detailMatch && <MatchDetailDialog
      canEditMatch={access.matchEdit && (!detailMatch.internal_fixture_id || Boolean(props.isOwner))}
      canManageLineup={access.lineupEdit}
      canViewAvailability
      canViewReportPdf={access.report}
      isPlayer={false}
      lineup={props.lineups.filter((entry) => entry.match_id === detailMatch.id)}
      match={detailMatch}
      profiles={props.profiles}
      onClose={() => setDetailMatch(null)}
      onEdit={() => { setDetailMatch(null); setMatchForm(detailMatch) }}
      onManageLineup={() => { setDetailMatch(null); setLineupMatch({ match: detailMatch, editable: true }) }}
      onReviewInternal={props.isOwner && detailMatch.internal_fixture_id ? () => { setReviewFixtureId(detailMatch.internal_fixture_id ?? null); setDetailMatch(null) } : undefined}
      onSaveReport={props.onSaveReport ? async (...args) => { await props.onSaveReport?.(...args); setDetailMatch(null); await props.onLoadMatchMonth(`${detailMatch.match_date.slice(0, 7)}-01`, { force: true }) } : undefined}
      onViewAvailability={() => { setDetailMatch(null); setAvailabilityMatch(detailMatch) }}
    />}
    {reviewFixtureId && props.isOwner && props.onFinalizeInternal && (() => {
      const fixtureMatches = props.matches.filter((match) => match.internal_fixture_id === reviewFixtureId).sort((a, b) => Number(b.is_home) - Number(a.is_home))
      if (fixtureMatches.length !== 2) return null
      return <InternalFixtureReviewDialog matches={[fixtureMatches[0], fixtureMatches[1]]} lineups={props.lineups} profiles={props.profiles} onClose={() => setReviewFixtureId(null)} onEdit={(match) => { setReviewFixtureId(null); setLineupMatch({ match, editable: true }) }} onSave={async (...args) => { await props.onSaveLineup(...args); await props.onLoadMatchMonth(`${fixtureMatches[0].match_date.slice(0, 7)}-01`) }} onFinalize={async (match) => { await props.onFinalizeInternal?.(match); await props.onLoadMatchMonth(`${match.match_date.slice(0, 7)}-01`) }} onUnlock={async (match) => { await props.onUnlockLineup(match); await props.onLoadMatchMonth(`${match.match_date.slice(0, 7)}-01`) }} />
    })()}
    {availabilityMatch && <MatchAvailabilityDialog
      availability={props.availability.filter((item) => item.match_id === availabilityMatch.id)}
      canEdit={access.availabilityEdit}
      eligibleProfiles={activePlayers(props.profiles).filter((profile) => props.memberships.some((membership) => membership.player_id === profile.id && membership.season_id === availabilityMatch.season_id && membershipCoversDate(membership, availabilityMatch.match_date) && (props.isOwner || membership.season_team_id === availabilityMatch.team_id || props.seasonTeams?.some((team) => team.id === membership.season_team_id && team.is_mixed))))}
      match={availabilityMatch}
      profiles={props.profiles}
      onClose={() => setAvailabilityMatch(null)}
      onSave={async (playerId, status, comment) => { await props.onSavePlayerAvailability(availabilityMatch, playerId, status, comment); await props.onLoadMatchMonth(`${availabilityMatch.match_date.slice(0, 7)}-01`) }}
    />}
  </div>
}
