import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, formatWeek, mondayFor, monthEnd, monthStart, todayIso } from '../../lib/dates'
import { canUserCompleteTask } from '../../lib/tasks'
import { compareTaskOrder } from '../../lib/taskOrder'
import type {
  AvailabilityStatus,
  CalendarBirthday,
  Match,
  MatchAvailability,
  MatchLineup,
  Profile,
  ResultValues,
  SeasonPlayer,
  TaskResult,
  TeamAnnouncement,
  TrainingTask,
} from '../../types'
import { MatchCard } from '../matches/MatchCard'
import { MatchLineupDialog } from '../matches/MatchLineupDialog'
import { AnnouncementCard } from '../tasks/AnnouncementCard'
import { TaskCard } from '../tasks/TaskCard'
import { TaskPlanningCalendar } from '../tasks/TaskPlanningCalendar'

export function PlayerCalendarView({
  announcements,
  availability,
  birthdays,
  focusedAnnouncementId,
  focusedDate,
  lineups,
  matches,
  memberships,
  profiles,
  results,
  tasks,
  userId,
  onLoadMatchMonth,
  onLoadTaskRange,
  onSaveAvailability,
  onSaveResult,
}: {
  announcements: TeamAnnouncement[]
  availability: MatchAvailability[]
  birthdays: CalendarBirthday[]
  focusedAnnouncementId?: string
  focusedDate?: string
  lineups: MatchLineup[]
  matches: Match[]
  memberships: SeasonPlayer[]
  profiles: Profile[]
  results: TaskResult[]
  tasks: TrainingTask[]
  userId: string
  onLoadMatchMonth: (month: string) => Promise<void>
  onLoadTaskRange: (fromWeek: string, toWeek: string) => Promise<void>
  onSaveAvailability: (match: Match, status: AvailabilityStatus, comment: string) => Promise<void>
  onSaveResult: (task: TrainingTask, values: ResultValues) => Promise<void>
}) {
  const today = todayIso()
  const initialDate = focusedDate ?? today
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [month, setMonth] = useState(`${initialDate.slice(0, 7)}-01`)
  const [lineupMatch, setLineupMatch] = useState<Match | null>(null)
  const visibleTasks = tasks.filter((task) => task.status === 'published' && canUserCompleteTask(task, memberships, userId))
  const visibleAnnouncements = announcements.filter((announcement) => announcement.status === 'published')
  const visibleMatches = matches.filter((match) => match.status === 'published')
  const selectedWeek = mondayFor(selectedDate)
  const selectedTasks = visibleTasks.filter((task) => task.week_start === selectedWeek).sort(compareTaskOrder)
  const selectedAnnouncements = visibleAnnouncements.filter((announcement) => announcement.announcement_date === selectedDate)
  const selectedMatches = visibleMatches
    .filter((match) => match.match_date === selectedDate)
    .sort((first, second) => (first.kickoff_time ?? '').localeCompare(second.kickoff_time ?? ''))
  const selectedBirthdays = birthdays.filter((birthday) => birthday.birthday_on === selectedDate)

  useEffect(() => {
    if (!focusedDate || focusedDate.slice(0, 7) === today.slice(0, 7)) return
    const focusedMonth = `${focusedDate.slice(0, 7)}-01`
    void Promise.all([
      onLoadTaskRange(mondayFor(monthStart(focusedMonth)), mondayFor(monthEnd(focusedMonth))),
      onLoadMatchMonth(focusedMonth),
    ]).catch(() => undefined)
  }, [focusedDate, onLoadMatchMonth, onLoadTaskRange, today])

  async function changeMonth(nextMonth: string) {
    setMonth(nextMonth)
    await Promise.all([
      onLoadTaskRange(mondayFor(monthStart(nextMonth)), mondayFor(monthEnd(nextMonth))),
      onLoadMatchMonth(nextMonth),
    ]).catch(() => undefined)
  }

  function goToToday() {
    setSelectedDate(today)
    const currentMonth = `${today.slice(0, 7)}-01`
    if (month !== currentMonth) void changeMonth(currentMonth)
  }

  function renderMatch(match: Match) {
    return <MatchCard
      availability={availability.filter((item) => item.match_id === match.id)}
      canManage={false}
      canViewAvailability={false}
      eligiblePlayerCount={0}
      isPlayer
      key={match.id}
      lineup={lineups.filter((entry) => entry.match_id === match.id)}
      match={match}
      ownAvailability={availability.find((item) => item.match_id === match.id && item.player_id === userId)}
      onEdit={() => undefined}
      onManageLineup={() => undefined}
      onSaveAvailability={async (...args) => {
        await onSaveAvailability(...args)
        await onLoadMatchMonth(`${match.match_date.slice(0, 7)}-01`)
      }}
      onViewAvailability={() => undefined}
      onViewLineup={() => setLineupMatch(match)}
    />
  }

  return <div className="page">
    <PageHeader
      eyebrow="PLANIFICACIÓN"
      subtitle="Consulta tus tareas, avisos, partidos y próximos cumpleaños."
      title="Calendario"
    />
    <div className="task-calendar-view player-calendar-view">
      <div className="planning-current-action"><button className="secondary-button compact" onClick={goToToday} type="button"><Icon name="calendar" size={16} />Ir a hoy</button></div>
      <TaskPlanningCalendar
        announcements={visibleAnnouncements}
        birthdays={birthdays}
        legendVariant="player"
        matches={visibleMatches}
        month={month}
        selectedDate={selectedDate}
        tasks={visibleTasks}
        onMonthChange={(nextMonth) => void changeMonth(nextMonth)}
        onSelectDate={setSelectedDate}
      />
      <section className="selected-planning-week">
        {selectedBirthdays.length > 0 && <div className="birthday-day-detail" role="status">
          <span aria-hidden="true">🎂</span>
          <p><strong>Cumpleaños del día</strong>{selectedBirthdays.map((birthday) => birthday.display_name).join(' · ')}</p>
        </div>}
        {selectedAnnouncements.length > 0 && <div className="selected-calendar-group selected-day-announcements">
          <div className="task-week-heading"><div><span className="eyebrow">AVISOS DEL DÍA</span><h2>{formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div><span>{selectedAnnouncements.length}</span></div>
          <div className="task-list">{selectedAnnouncements.map((announcement) => <AnnouncementCard announcement={announcement} initialOpen={focusedAnnouncementId === announcement.id} key={announcement.id} />)}</div>
        </div>}
        {selectedMatches.length > 0 && <div className="selected-calendar-group">
          <div className="task-week-heading"><div><span className="eyebrow">PARTIDOS DEL DÍA</span><h2>{formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div><span>{selectedMatches.length}</span></div>
          <div className="match-list">{selectedMatches.map(renderMatch)}</div>
        </div>}
        <div className="selected-calendar-group">
          <div className="task-week-heading"><div><span className="eyebrow">TAREAS DE LA SEMANA</span><h2>{formatWeek(selectedWeek)}</h2></div><span>{selectedTasks.length} {selectedTasks.length === 1 ? 'tarea' : 'tareas'}</span></div>
          <div className="task-list">
            {selectedTasks.map((task) => <TaskCard
              hideWeek
              key={task.id}
              onSave={task.week_start === mondayFor(today) ? onSaveResult : undefined}
              result={results.find((result) => result.task_id === task.id)}
              task={task}
            />)}
            {!selectedTasks.length && <EmptyState title="Semana sin tareas" text="No hay tareas publicadas para esta semana." />}
          </div>
        </div>
      </section>
    </div>
    {lineupMatch && <MatchLineupDialog
      availability={availability.filter((item) => item.match_id === lineupMatch.id)}
      canExport={false}
      entries={lineups.filter((entry) => entry.match_id === lineupMatch.id)}
      match={lineupMatch}
      memberships={memberships}
      profiles={profiles}
      onClose={() => setLineupMatch(null)}
    />}
  </div>
}
