import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, formatWeek, mondayFor, monthEnd, monthStart, todayIso } from '../../lib/dates'
import { useSeasonHolidayDates } from '../../hooks/useSeasonHolidayDates'
import { canUserCompleteTask } from '../../lib/tasks'
import { compareTaskOrder } from '../../lib/taskOrder'
import { compareMatches } from '../../lib/seasonCompetitions'
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
import { MatchDetailDialog } from '../matches/MatchDetailDialog'
import { SurveyClosureCards } from '../surveys/SurveyClosureCards'
import { SurveyOwnResponseDialog } from '../surveys/SurveyOwnResponseDialog'
import { SurveyResponseDialog } from '../surveys/SurveyResponseDialog'
import { HolidayDayContext } from './HolidayDayContext'
import { AnnouncementCard } from '../tasks/AnnouncementCard'
import { TaskCard } from '../tasks/TaskCard'
import { TaskPlanningCalendar } from '../tasks/TaskPlanningCalendar'
import { assignCalendarSurveyTones, calendarSurveyAppearsOnDate } from '../tasks/calendarSurveys'
import type { CalendarSurvey } from '../tasks/calendarSurveys'
import type { MySurveyResponse, SurveyForResponse } from '../../services/surveysService'
import type { SurveyAnswerValues } from '../surveys/SurveyResponseForm'

const SURVEY_MONTH_CACHE_MS = 60_000

export function PlayerCalendarView({
  announcements,
  availability,
  birthdays,
  holidays: providedHolidays,
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
  onLoadSurveyClosures,
  onOpenSurveyResults,
  canRespondToSurveys = true,
  initialSurveys,
  initialOwnSurveyResponses,
  onSubmitSurveyResponse,
  onSaveAvailability,
  onSaveResult,
}: {
  announcements: TeamAnnouncement[]
  availability: MatchAvailability[]
  birthdays: CalendarBirthday[]
  holidays?: string[]
  focusedAnnouncementId?: string
  focusedDate?: string
  lineups: MatchLineup[]
  matches: Match[]
  memberships: SeasonPlayer[]
  profiles: Profile[]
  results: TaskResult[]
  tasks: TrainingTask[]
  userId: string
  onLoadMatchMonth: (month: string, options?: { force?: boolean }) => Promise<void>
  onLoadTaskRange: (fromWeek: string, toWeek: string) => Promise<void>
  onSaveAvailability?: (match: Match, status: AvailabilityStatus, comment: string) => Promise<void>
  onSaveResult?: (task: TrainingTask, values: ResultValues) => Promise<void>
  onLoadSurveyClosures?: (from: string, until: string) => Promise<CalendarSurvey[]>
  onOpenSurveyResults?: (surveyId: string) => void
  canRespondToSurveys?: boolean
  initialSurveys?: Record<string, SurveyForResponse>
  initialOwnSurveyResponses?: Record<string, MySurveyResponse>
  onSubmitSurveyResponse?: (surveyId: string, answers: SurveyAnswerValues[]) => Promise<void>
}) {
  const today = todayIso()
  const initialDate = focusedDate ?? today
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [month, setMonth] = useState(`${initialDate.slice(0, 7)}-01`)
  const [detailMatch, setDetailMatch] = useState<Match | null>(null)
  const [surveyClosures, setSurveyClosures] = useState<CalendarSurvey[]>([])
  const [responseSurvey, setResponseSurvey] = useState<CalendarSurvey | null>(null)
  const [closedSurvey, setClosedSurvey] = useState<CalendarSurvey | null>(null)
  const surveyMonthCache = useRef(new Map<string, { loadedAt: number; surveys: CalendarSurvey[] }>())
  const holidays = useSeasonHolidayDates(memberships.map((membership) => membership.season_id), providedHolidays)
  const visibleTasks = tasks.filter((task) => task.status === 'published' && canUserCompleteTask(task, memberships, userId))
  const visibleAnnouncements = announcements.filter((announcement) => announcement.status === 'published')
  const visibleMatches = matches.filter((match) => match.status === 'published' || match.status === 'completed')
  const selectedWeek = mondayFor(selectedDate)
  const selectedTasks = visibleTasks.filter((task) => task.week_start === selectedWeek).sort(compareTaskOrder)
  const selectedAnnouncements = visibleAnnouncements.filter((announcement) => announcement.announcement_date === selectedDate)
  const selectedMatches = visibleMatches
    .filter((match) => match.match_date === selectedDate)
    .sort(compareMatches)
  const selectedBirthdays = birthdays.filter((birthday) => birthday.birthday_on === selectedDate)
  const selectedSurveyClosures = surveyClosures.filter((survey) => calendarSurveyAppearsOnDate(survey, selectedDate))
  const hasSelectedDayContent = selectedBirthdays.length + selectedAnnouncements.length + selectedMatches.length + selectedSurveyClosures.length > 0 || holidays.includes(selectedDate)

  useEffect(() => {
    if (!focusedDate) return
    const focusedMonth = `${focusedDate.slice(0, 7)}-01`
    void Promise.all([
      onLoadTaskRange(mondayFor(monthStart(focusedMonth)), mondayFor(monthEnd(focusedMonth))),
      onLoadMatchMonth(focusedMonth, { force: true }),
    ]).catch(() => undefined)
  }, [focusedDate, onLoadMatchMonth, onLoadTaskRange])

  const fetchSurveyMonth = useCallback(async (targetMonth: string, force = false) => {
    if (!onLoadSurveyClosures) return []
    const cached = surveyMonthCache.current.get(targetMonth)
    if (!force && cached && Date.now() - cached.loadedAt < SURVEY_MONTH_CACHE_MS) return cached.surveys
    const surveys = assignCalendarSurveyTones(await onLoadSurveyClosures(monthStart(targetMonth), monthEnd(targetMonth)))
    surveyMonthCache.current.set(targetMonth, { loadedAt: Date.now(), surveys })
    return surveys
  }, [onLoadSurveyClosures])

  async function changeMonth(nextMonth: string) {
    setMonth(nextMonth)
    await Promise.all([
      onLoadTaskRange(mondayFor(monthStart(nextMonth)), mondayFor(monthEnd(nextMonth))),
      onLoadMatchMonth(nextMonth),
    ]).catch(() => undefined)
  }

  useEffect(() => {
    let current = true
    void fetchSurveyMonth(month).then((surveys) => { if (current) setSurveyClosures(surveys) }).catch(() => { if (current) setSurveyClosures([]) })
    return () => { current = false }
  }, [fetchSurveyMonth, month])

  function goToToday() {
    setSelectedDate(today)
    const currentMonth = `${today.slice(0, 7)}-01`
    if (month !== currentMonth) void changeMonth(currentMonth)
  }

  function renderMatch(match: Match) {
    return <MatchCard
      canEditMatch={false}
      isPlayer
      key={match.id}
      match={match}
      ownAvailability={availability.find((item) => item.match_id === match.id && item.player_id === userId)}
      onOpen={() => setDetailMatch(match)}
      onSaveAvailability={onSaveAvailability ? async (...args) => {
        await onSaveAvailability(...args)
        await onLoadMatchMonth(`${match.match_date.slice(0, 7)}-01`)
      } : undefined}
    />
  }

  function openSurveyDetail(survey: CalendarSurvey) {
    if (!canRespondToSurveys) {
      if (survey.visibility !== 'management' && survey.visibility !== 'private') onOpenSurveyResults?.(survey.id)
      return
    }
    if (survey.visibility !== 'management' && survey.visibility !== 'private' && onOpenSurveyResults) onOpenSurveyResults(survey.id)
    else setClosedSurvey(survey)
  }

  function modifySurvey(survey: CalendarSurvey) {
    if (canRespondToSurveys && survey.state === 'active') setResponseSurvey(survey)
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
        holidays={holidays}
        legendVariant="player"
        matches={visibleMatches}
        month={month}
        selectedDate={selectedDate}
        tasks={visibleTasks}
        surveys={surveyClosures}
        onMonthChange={(nextMonth) => void changeMonth(nextMonth)}
        onSelectDate={setSelectedDate}
      />
      <section className="selected-planning-week">
        {hasSelectedDayContent && <div className="selected-day-date"><h2>{formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>}
        {holidays.includes(selectedDate) && <HolidayDayContext />}
        {selectedBirthdays.length > 0 && <div className="birthday-day-detail" role="status">
          <span aria-hidden="true">🎂</span>
          <p><strong>Cumpleaños del día</strong>{selectedBirthdays.map((birthday) => birthday.display_name).join(' · ')}</p>
        </div>}
        {selectedAnnouncements.length > 0 && <div className="selected-calendar-group selected-day-announcements">
          <div className="task-week-heading"><h2>Avisos</h2><span>{selectedAnnouncements.length}</span></div>
          <div className="task-list">{selectedAnnouncements.map((announcement) => <AnnouncementCard announcement={announcement} initialOpen={focusedAnnouncementId === announcement.id} key={announcement.id} />)}</div>
        </div>}
        {selectedSurveyClosures.length > 0 && <SurveyClosureCards canRespond={canRespondToSurveys} surveys={selectedSurveyClosures} onModify={modifySurvey} onOpen={openSurveyDetail} />}
        {selectedMatches.length > 0 && <div className="selected-calendar-group selected-day-matches">
          <div className="task-week-heading"><h2>Partidos</h2><span>{selectedMatches.length}</span></div>
          <div className="match-list">{selectedMatches.map(renderMatch)}</div>
        </div>}
        <div className="selected-calendar-group selected-week-tasks">
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
    {detailMatch && <MatchDetailDialog
      canEditMatch={false}
      canManageLineup={false}
      canViewAvailability={false}
      isPlayer
      lineup={lineups.filter((entry) => entry.match_id === detailMatch.id)}
      match={detailMatch}
      ownAvailability={availability.find((item) => item.match_id === detailMatch.id && item.player_id === userId)}
      profiles={profiles}
      onClose={() => setDetailMatch(null)}
      onEdit={() => undefined}
      onManageLineup={() => undefined}
      onSaveAvailability={onSaveAvailability ? async (...args) => {
        await onSaveAvailability(...args)
        await onLoadMatchMonth(`${detailMatch.match_date.slice(0, 7)}-01`)
      } : undefined}
      onViewAvailability={() => undefined}
    />}
    {responseSurvey && <SurveyResponseDialog initialSurvey={initialSurveys?.[responseSurvey.id]} onClose={() => setResponseSurvey(null)} onDone={async () => {
      setSurveyClosures(await fetchSurveyMonth(month, true))
      setResponseSurvey(null)
    }} onSubmitResponse={onSubmitSurveyResponse} surveyId={responseSurvey.id} />}
    {closedSurvey && <SurveyOwnResponseDialog initialResponse={initialOwnSurveyResponses?.[closedSurvey.id]} onClose={() => setClosedSurvey(null)} surveyId={closedSurvey.id} title={closedSurvey.title} />}
  </div>
}
