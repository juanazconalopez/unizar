import { useMemo } from 'react'
import { formatDate, todayIso, toIsoDate } from '../../lib/dates'
import { compareMatches, matchColor, matchLegendItems } from '../../lib/seasonCompetitions'
import type { CalendarBirthday, Match, TeamAnnouncement, TrainingPlanCalendarItem, TrainingTask } from '../../types'
import { assignCalendarSurveyTones } from './calendarSurveys'
import type { CalendarSurvey } from './calendarSurveys'
const EMPTY_MATCHES: Match[] = []
const EMPTY_TRAINING_PLANS: TrainingPlanCalendarItem[] = []

export function TaskPlanningCalendar({ month, selectedDate, tasks, announcements = [], birthdays = [], holidays = [], matches, trainingPlans, surveys = [], showLegend = true, legendVariant = 'management', onMonthChange, onSelectDate }: {
  month: string
  selectedDate: string
  tasks: TrainingTask[]
  announcements?: TeamAnnouncement[]
  birthdays?: CalendarBirthday[]
  holidays?: string[]
  matches?: Match[]
  trainingPlans?: TrainingPlanCalendarItem[]
  surveys?: CalendarSurvey[]
  showLegend?: boolean
  legendVariant?: 'management' | 'player'
  onMonthChange: (month: string) => void
  onSelectDate: (date: string) => void
}) {
  const days = useMemo(() => calendarDays(month), [month])
  const calendarSurveys = useMemo(() => assignCalendarSurveyTones(surveys), [surveys])
  const today = todayIso()
  const visibleMatches = matches ?? EMPTY_MATCHES
  const includesMatches = matches !== undefined
  const visibleTrainingPlans = trainingPlans ?? EMPTY_TRAINING_PLANS
  const includesTrainingPlans = trainingPlans !== undefined
  const itemsByDate = useMemo(() => {
    const tasksByDate = new Map<string, TrainingTask[]>()
    const announcementsByDate = new Map<string, TeamAnnouncement[]>()
    const matchesByDate = new Map<string, Match[]>()
    const trainingPlansByDate = new Map<string, TrainingPlanCalendarItem[]>()
    const birthdaysByDate = new Map<string, CalendarBirthday[]>()
    const surveyMarksByDate = new Map<string, CalendarSurvey[]>()
    const activeSurveysByDate = new Map<string, CalendarSurvey[]>()
    const add = <T,>(map: Map<string, T[]>, date: string, item: T) => {
      const items = map.get(date)
      if (items) items.push(item)
      else map.set(date, [item])
    }

    tasks.filter((task) => task.status !== 'cancelled').forEach((task) => add(tasksByDate, task.week_start, task))
    announcements.filter((announcement) => announcement.status !== 'cancelled').forEach((announcement) => add(announcementsByDate, announcement.announcement_date, announcement))
    visibleMatches.filter((match) => match.status !== 'cancelled').forEach((match) => add(matchesByDate, match.match_date, match))
    visibleTrainingPlans.forEach((plan) => add(trainingPlansByDate, plan.session_date, plan))
    birthdays.forEach((birthday) => add(birthdaysByDate, birthday.birthday_on, birthday))
    calendarSurveys.forEach((survey) => {
      if (survey.state === 'active' && survey.startsOn && survey.endsOn) {
        days.forEach((date) => {
          if (date && date >= survey.startsOn! && date <= survey.endsOn!) add(activeSurveysByDate, date, survey)
        })
        // En el calendario de jugadora result_date es el día de su última respuesta.
        // En el de gestión, en cambio, es el día posterior al cierre para consultar
        // resultados provisionales mientras la encuesta siga abierta.
        const markDate = survey.result_date ?? survey.respondedOn
        if (markDate) add(surveyMarksByDate, markDate, survey)
        return
      }
      if (survey.result_date) add(surveyMarksByDate, survey.result_date, survey)
    })
    matchesByDate.forEach((dayMatches) => dayMatches.sort(compareMatches))

    return { tasksByDate, announcementsByDate, matchesByDate, trainingPlansByDate, birthdaysByDate, surveyMarksByDate, activeSurveysByDate }
  }, [announcements, birthdays, calendarSurveys, days, tasks, visibleMatches, visibleTrainingPlans])

  function changeMonth(offset: number) {
    const nextMonth = offsetMonth(month, offset)
    onMonthChange(nextMonth)
    onSelectDate(nextMonth)
  }

  return (
    <section className="calendar-panel task-planning-panel" aria-label="Calendario de planificación">
      <div className="calendar-toolbar">
        <button aria-label="Mes anterior" onClick={() => changeMonth(-1)} type="button">‹</button>
        <div>
          <span className="eyebrow">PLANIFICACIÓN MENSUAL</span>
          <h2>{formatDate(month, { month: 'long', year: 'numeric' })}</h2>
        </div>
        <button aria-label="Mes siguiente" onClick={() => changeMonth(1)} type="button">›</button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="statistics-calendar task-planning-calendar">
        {days.map((date, index) => {
          if (!date) return <span className="calendar-empty" key={`empty-${index}`} />
          const plannedTasks = itemsByDate.tasksByDate.get(date) ?? []
          const taskCount = plannedTasks.length
          const dayAnnouncements = itemsByDate.announcementsByDate.get(date) ?? []
          const announcementCount = dayAnnouncements.length
          const dayMatches = itemsByDate.matchesByDate.get(date) ?? []
          const matchCount = dayMatches.length
          const dayTrainingPlans = itemsByDate.trainingPlansByDate.get(date) ?? []
          const trainingPlanCount = dayTrainingPlans.length
          const dayBirthdays = itemsByDate.birthdaysByDate.get(date) ?? []
          const birthdayCount = dayBirthdays.length
          const surveyCount = (itemsByDate.surveyMarksByDate.get(date) ?? []).length
          const activeSurveys = itemsByDate.activeSurveysByDate.get(date) ?? []
          const activeSurveyCount = activeSurveys.length
          const surveyTracks = activeSurveys
            .slice()
            .sort((left, right) => (left.calendarTone ?? 0) - (right.calendarTone ?? 0))
            .slice(0, 3)
          const isHoliday = holidays.includes(date)
          return (
            <button
              aria-label={`${formatDate(date, { day: 'numeric', month: 'long' })}: ${taskCount} ${taskCount === 1 ? 'tarea planificada' : 'tareas planificadas'} y ${announcementCount} ${announcementCount === 1 ? 'aviso' : 'avisos'}${includesTrainingPlans ? ` y ${trainingPlanCount} ${trainingPlanCount === 1 ? 'entrenamiento programado' : 'entrenamientos programados'}` : ''}${includesMatches ? ` y ${matchCount} ${matchCount === 1 ? 'partido' : 'partidos'}` : ''}${birthdayCount ? ` y ${birthdayCount} cumpleaños` : ''}${activeSurveyCount ? ` y ${activeSurveyCount} ${activeSurveyCount === 1 ? 'encuesta abierta' : 'encuestas abiertas'}` : ''}${surveyCount ? ` y ${surveyCount} ${surveyCount === 1 ? 'resultado de encuesta' : 'resultados de encuestas'}` : ''}`}
              aria-pressed={selectedDate === date}
              className={`${taskCount || announcementCount || matchCount || trainingPlanCount || birthdayCount || surveyCount || activeSurveyCount ? 'has-data ' : ''}${announcementCount ? 'has-announcement ' : ''}${isHoliday ? 'holiday ' : ''}${date === today ? 'today' : ''}`}
              key={date}
              onClick={() => onSelectDate(date)}
              type="button"
            >
              <strong>{Number(date.slice(-2))}</strong>
              {surveyTracks.map((survey, track) => <i aria-hidden="true" className={`survey-active-range survey-active-range-${track}${survey.startsOn === date ? ' survey-active-range-start' : ''}${survey.endsOn === date ? ' survey-active-range-end' : ''}`} data-survey-tone={survey.calendarTone} key={survey.id} title={`Encuesta abierta: ${survey.title ?? 'Encuesta'}`} />)}
              {activeSurveyCount > 3 && <small aria-hidden="true" className="survey-active-overflow">+{activeSurveyCount - 3}</small>}
              {date === today && <small aria-hidden="true" className="today-label">HOY</small>}
              {taskCount > 0 && (
                <span className="week-task-bubbles" aria-hidden="true">
                  {plannedTasks.slice(0, 6).map((task) => <i key={task.id}>T</i>)}
                  {taskCount > 6 && <small>+{taskCount - 6}</small>}
                </span>
              )}
              {announcementCount > 0 && (
                <span className="day-announcement-bubbles" aria-hidden="true">
                  {dayAnnouncements.slice(0, 3).map((announcement) => <i key={announcement.id}>A</i>)}
                  {announcementCount > 3 && <small>+{announcementCount - 3}</small>}
                </span>
              )}
              {trainingPlanCount > 0 && (
                <span className="day-training-bubbles" aria-hidden="true">
                  {dayTrainingPlans.slice(0, 3).map((plan) => <i key={plan.id}>E</i>)}
                  {trainingPlanCount > 3 && <small>+{trainingPlanCount - 3}</small>}
                </span>
              )}
              {matchCount > 0 && (
                <span className="match-day-marks" aria-hidden="true">
                  {dayMatches.slice(0, 3).map((match) => <i key={match.id} style={{ backgroundColor: matchColor(match).solid }}>P</i>)}
                  {matchCount > 3 && <small>+{matchCount - 3}</small>}
                </span>
              )}
              {birthdayCount > 0 && <small aria-hidden="true" className="birthday-mark">🎂 {birthdayCount}</small>}
              {surveyCount > 0 && <small aria-hidden="true" className="survey-mark">Q {surveyCount}</small>}
            </button>
          )
        })}
      </div>
      {showLegend && <div className="calendar-legend">
        <span><i className="task-dot" />T · {legendVariant === 'player' ? 'Tareas publicadas' : 'Tareas publicadas o en borrador guardadas en el lunes de su semana'}</span>
        <span><i className="announcement-dot" />A · Avisos en su fecha exacta</span>
        {includesTrainingPlans && <span><i className="training-plan-dot" />E · Entrenamientos publicados y borradores</span>}
        {includesMatches && matchLegendItems(visibleMatches).map((item) => <span key={item.key}><i className="match-dot" style={{ backgroundColor: item.solid }} />P · {item.label}</span>)}
        {birthdays.length > 0 && <span>🎂 · Cumpleaños</span>}
        {calendarSurveys.some((survey) => survey.state === 'active') && <span><i className="survey-active-line-dot" />Encuestas abiertas</span>}
        {surveys.length > 0 && <span><i className="survey-dot" />Q · Respuesta o resultados de encuestas</span>}
      </div>}
    </section>
  )
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
