import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, formatWeek, mondayFor, monthEnd, monthStart, todayIso } from '../../lib/dates'
import { activePlayers, membershipCoversDate, seasonForDate } from '../../lib/selectors'
import { compareTaskOrder } from '../../lib/taskOrder'
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
  SeasonCallupReport,
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
import { MatchForm } from '../matches/MatchForm'
import { MatchLineupDialog } from '../matches/MatchLineupDialog'
import { SeasonCallupReportView } from '../matches/SeasonCallupReportView'
import { AnnouncementCard } from '../tasks/AnnouncementCard'
import { AnnouncementForm } from '../tasks/AnnouncementForm'
import { TaskAlerts } from '../tasks/TaskAlerts'
import { TaskCard } from '../tasks/TaskCard'
import { TaskForm } from '../tasks/TaskForm'
import { TaskPlanningCalendar } from '../tasks/TaskPlanningCalendar'
import { TaskResultsSummary } from '../tasks/TaskResultsSummary'
import { StatusControl } from '../tasks/StatusControl'

type CalendarViewProps = {
  announcements: TeamAnnouncement[]
  availability: MatchAvailability[]
  lineups: MatchLineup[]
  matches: Match[]
  memberships: SeasonPlayer[]
  profiles: Profile[]
  results: TaskResult[]
  seasons: Season[]
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
  onLoadMatchMonth: (month: string) => Promise<void>
  onSavePlayerAvailability: (match: Match, playerId: string, status: AvailabilityStatus, comment: string) => Promise<void>
  onSaveLineup: (match: Match, entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) => Promise<void>
  onSaveMatch: (match: Match | undefined, values: MatchValues) => Promise<void>
  onUnlockLineup: (match: Match) => Promise<void>
  onLoadCallupReport: (seasonId: string) => Promise<SeasonCallupReport>
  onLoadPlayerSeasonSummary: (seasonId: string, playerId: string) => Promise<PlayerSeasonSummary>
  onLoadPublishedTrainingPlans: (fromDate: string, toDate: string) => Promise<TrainingPlanCalendarItem[]>
  onOpenTrainingPlan: (trainingPlanId: string) => void
}

export function CalendarView(props: CalendarViewProps) {
  const { onLoadPublishedTrainingPlans } = props
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
  const [availabilityMatch, setAvailabilityMatch] = useState<Match | null>(null)
  const [publishedTrainingPlans, setPublishedTrainingPlans] = useState<TrainingPlanCalendarItem[]>([])
  const selectedWeek = mondayFor(selectedDate)
  const selectedTasks = props.tasks
    .filter((task) => task.week_start === selectedWeek)
    .sort(compareTaskOrder)
  const selectedAnnouncements = props.announcements.filter((announcement) => announcement.announcement_date === selectedDate)
  const selectedMatches = props.matches
    .filter((match) => match.match_date === selectedDate)
    .sort((first, second) => (first.kickoff_time ?? '').localeCompare(second.kickoff_time ?? ''))
  const selectedTrainingPlans = publishedTrainingPlans.filter((plan) => plan.session_date === selectedDate)
  const activeSeason = seasonForDate(props.seasons, today)

  const loadPublishedTrainingPlans = useCallback(async (targetMonth: string) => {
    try {
      setPublishedTrainingPlans(await onLoadPublishedTrainingPlans(monthStart(targetMonth), monthEnd(targetMonth)))
    } catch {
      setPublishedTrainingPlans([])
    }
  }, [onLoadPublishedTrainingPlans])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPublishedTrainingPlans(month), 0)
    return () => window.clearTimeout(timer)
  }, [loadPublishedTrainingPlans, month])

  async function changeMonth(nextMonth: string) {
    setMonth(nextMonth)
    await Promise.all([
      props.onLoadTaskRange(mondayFor(monthStart(nextMonth)), mondayFor(monthEnd(nextMonth))),
      props.onLoadMatchMonth(nextMonth),
      loadPublishedTrainingPlans(nextMonth),
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
      loadPublishedTrainingPlans(`${date.slice(0, 7)}-01`),
    ])
  }

  function taskActions(task: TrainingTask) {
    const ordered = props.tasks.filter((item) => item.week_start === task.week_start).sort(compareTaskOrder)
    const index = ordered.findIndex((item) => item.id === task.id)
    return <>
      {props.onReorderTasks && ordered.length > 1 && <div aria-label={`Ordenar ${task.title}`} className="task-order-actions" role="group">
        <button aria-label={`Subir ${task.title}`} className="secondary-button compact" disabled={index <= 0 || reorderingTaskId !== null} onClick={() => void moveTask(task, -1)} title="Mover antes" type="button">↑</button>
        <button aria-label={`Bajar ${task.title}`} className="secondary-button compact" disabled={index < 0 || index >= ordered.length - 1 || reorderingTaskId !== null} onClick={() => void moveTask(task, 1)} title="Mover después" type="button">↓</button>
      </div>}
      <StatusControl status={task.status} onChange={async (status) => {
        await props.onTaskStatusChange(task.id, status)
        await props.onLoadTaskRange(task.week_start, task.week_start)
      }} />
      <button className="secondary-button compact" onClick={() => setTaskForm({ task })} type="button">Editar tarea</button>
      <button className="secondary-button compact" onClick={() => setTaskForm({ template: task })} type="button">Copiar</button>
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
    return <>
      <StatusControl status={announcement.status} onChange={async (status) => {
        await props.onAnnouncementStatusChange(announcement.id, status)
        await props.onLoadTaskRange(mondayFor(announcement.announcement_date), mondayFor(announcement.announcement_date))
      }} />
      <button className="secondary-button compact" onClick={() => setAnnouncementForm(announcement)} type="button">Editar aviso</button>
    </>
  }

  function renderMatch(match: Match) {
    const eligibleProfiles = activePlayers(props.profiles).filter((profile) => props.memberships.some((membership) => (
      membership.player_id === profile.id
      && membership.season_id === match.season_id
      && membershipCoversDate(membership, match.match_date)
    )))
    return <MatchCard
      availability={props.availability.filter((item) => item.match_id === match.id)}
      canManage
      canViewAvailability
      eligiblePlayerCount={eligibleProfiles.length}
      isPlayer={false}
      key={match.id}
      lineup={props.lineups.filter((entry) => entry.match_id === match.id)}
      match={match}
      onEdit={() => setMatchForm(match)}
      onManageLineup={() => setLineupMatch({ match, editable: true })}
      onSaveAvailability={async () => undefined}
      onViewAvailability={() => setAvailabilityMatch(match)}
      onViewLineup={() => setLineupMatch({ match, editable: true })}
    />
  }

  const hasSelectedContent = selectedAnnouncements.length + selectedMatches.length + selectedTrainingPlans.length + selectedTasks.length > 0

  return <div className="page">
    <PageHeader
      action={<button className={reportOpen ? 'primary-button' : 'secondary-button'} onClick={() => setReportOpen((open) => !open)} type="button"><Icon name="statistics" size={18} />{reportOpen ? 'Volver al calendario' : 'Resumen de convocatorias'}</button>}
      eyebrow="PLANIFICACIÓN"
      subtitle="Organiza tareas, avisos, partidos y entrenamientos publicados desde una única vista."
      title="Calendario"
    />

    {reportOpen ? <SeasonCallupReportView key={activeSeason?.id ?? 'no-active-season'} onLoad={props.onLoadCallupReport} onLoadPlayer={props.onLoadPlayerSeasonSummary} season={activeSeason} /> : <>
      <TaskAlerts currentWeek={mondayFor(today)} profiles={props.profiles} results={props.results} showFatigue={false} tasks={props.tasks} />
      <div className="task-calendar-view">
        <div className="planning-current-action"><button className="secondary-button compact" onClick={goToToday} type="button"><Icon name="calendar" size={16} />Ir a la semana actual</button></div>
        <TaskPlanningCalendar
          announcements={props.announcements}
          matches={props.matches}
          month={month}
          selectedDate={selectedDate}
          showLegend={false}
          tasks={props.tasks}
          trainingPlans={publishedTrainingPlans}
          onMonthChange={(nextMonth) => void changeMonth(nextMonth)}
          onSelectDate={setSelectedDate}
        />
        <section className="selected-planning-week">
          {selectedAnnouncements.length > 0 && <div className="selected-calendar-group selected-day-announcements">
            <div className="task-week-heading"><div><span className="eyebrow">AVISOS DEL DÍA</span><h2>{formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div><span>{selectedAnnouncements.length}</span></div>
            <div className="task-list">{selectedAnnouncements.map((announcement) => <AnnouncementCard actions={announcementActions(announcement)} announcement={announcement} initialOpen={props.focusedAnnouncementId === announcement.id} key={announcement.id} />)}</div>
          </div>}
          {selectedMatches.length > 0 && <div className="selected-calendar-group">
            <div className="task-week-heading"><div><span className="eyebrow">PARTIDOS DEL DÍA</span><h2>{formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div><span>{selectedMatches.length}</span></div>
            <div className="match-list">{selectedMatches.map(renderMatch)}</div>
          </div>}
          {selectedTrainingPlans.length > 0 && <div className="selected-calendar-group selected-day-trainings">
            <div className="task-week-heading"><div><span className="eyebrow">ENTRENAMIENTOS PUBLICADOS</span><h2>{formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div><span>{selectedTrainingPlans.length}</span></div>
            <div className="calendar-training-list">{selectedTrainingPlans.map((plan) => <article key={plan.id}><span>E</span><div><strong>{plan.title}</strong><small>Plan de entrenamiento preparado</small></div><button className="secondary-button compact" onClick={() => props.onOpenTrainingPlan(plan.id)} type="button">Ver entrenamiento <Icon name="arrow" size={14} /></button></article>)}</div>
          </div>}
          <div className="selected-calendar-group">
            <div className="task-week-heading"><div><span className="eyebrow">TAREAS DE LA SEMANA</span><h2>{formatWeek(selectedWeek)}</h2></div><span>{selectedTasks.length} {selectedTasks.length === 1 ? 'tarea' : 'tareas'}</span></div>
            <div className="task-list">{selectedTasks.map((task) => <TaskCard hideWeek key={task.id} managerActions={taskActions(task)} managementSummary={<TaskResultsSummary profiles={props.profiles} results={props.results} task={task} />} result={undefined} task={task} />)}</div>
          </div>
          {!hasSelectedContent && <EmptyState text="No hay tareas, avisos, partidos ni entrenamientos publicados en este periodo." title="Sin planificación" />}
          <div className="selected-week-actions calendar-add-actions">
            <div className="calendar-add-menu">
              <button aria-expanded={addMenuOpen} className="primary-button" onClick={() => setAddMenuOpen((open) => !open)} type="button"><Icon name="plus" size={18} />Añadir</button>
              {addMenuOpen && <div className="calendar-add-options" role="menu">
                <button onClick={() => { setTaskForm({}); setAddMenuOpen(false) }} role="menuitem" type="button">Nueva tarea</button>
                <button onClick={() => { setAnnouncementForm(null); setAddMenuOpen(false) }} role="menuitem" type="button">Nuevo aviso</button>
                <button onClick={() => { setMatchForm(null); setAddMenuOpen(false) }} role="menuitem" type="button">Nuevo partido</button>
              </div>}
            </div>
          </div>
        </section>
      </div>
    </>}

    {taskForm && <TaskForm
      initialDate={taskForm.template?.week_start ?? selectedDate}
      seasons={props.seasons}
      task={taskForm.task}
      template={taskForm.template}
      onCancel={() => setTaskForm(null)}
      onDelete={async (task) => { await props.onDeleteTask(task); await props.onLoadTaskRange(task.week_start, task.week_start); setTaskForm(null) }}
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
      initialDate={selectedDate}
      seasons={props.seasons}
      onCancel={() => setAnnouncementForm(undefined)}
      onDelete={async (announcement) => { await props.onDeleteAnnouncement(announcement); await props.onLoadTaskRange(mondayFor(announcement.announcement_date), mondayFor(announcement.announcement_date)); setAnnouncementForm(undefined) }}
      onSubmit={async (values) => { await props.onSaveAnnouncement(announcementForm ?? undefined, values); await props.onLoadTaskRange(mondayFor(values.date), mondayFor(values.date)); setSelectedDate(values.date); setMonth(`${values.date.slice(0, 7)}-01`); setAnnouncementForm(undefined) }}
    />}
    {matchForm !== undefined && <MatchForm
      initialDate={selectedDate}
      match={matchForm ?? undefined}
      seasons={props.seasons}
      onCancel={() => setMatchForm(undefined)}
      onDelete={matchForm ? async (match) => { await props.onDeleteMatch(match); await props.onLoadMatchMonth(`${match.match_date.slice(0, 7)}-01`); setMatchForm(undefined) } : undefined}
      onSubmit={async (values) => { await props.onSaveMatch(matchForm ?? undefined, values); await refreshDate(values.matchDate); setSelectedDate(values.matchDate); setMonth(`${values.matchDate.slice(0, 7)}-01`); setMatchForm(undefined) }}
    />}
    {lineupMatch && <MatchLineupDialog
      availability={props.availability.filter((item) => item.match_id === lineupMatch.match.id)}
      canExport
      entries={props.lineups.filter((entry) => entry.match_id === lineupMatch.match.id)}
      match={lineupMatch.match}
      memberships={props.memberships}
      profiles={props.profiles}
      onClose={() => setLineupMatch(null)}
      onUnlock={async () => { await props.onUnlockLineup(lineupMatch.match); await props.onLoadMatchMonth(`${lineupMatch.match.match_date.slice(0, 7)}-01`) }}
      onSave={async (entries, published) => { await props.onSaveLineup(lineupMatch.match, entries, published); await props.onLoadMatchMonth(`${lineupMatch.match.match_date.slice(0, 7)}-01`); setLineupMatch(null) }}
    />}
    {availabilityMatch && <MatchAvailabilityDialog
      availability={props.availability.filter((item) => item.match_id === availabilityMatch.id)}
      canEdit
      eligibleProfiles={activePlayers(props.profiles).filter((profile) => props.memberships.some((membership) => membership.player_id === profile.id && membership.season_id === availabilityMatch.season_id && membershipCoversDate(membership, availabilityMatch.match_date)))}
      match={availabilityMatch}
      profiles={props.profiles}
      onClose={() => setAvailabilityMatch(null)}
      onSave={async (playerId, status, comment) => { await props.onSavePlayerAvailability(availabilityMatch, playerId, status, comment); await props.onLoadMatchMonth(`${availabilityMatch.match_date.slice(0, 7)}-01`) }}
    />}
  </div>
}
