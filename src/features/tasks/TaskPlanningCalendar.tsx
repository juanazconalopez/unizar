import { formatDate, todayIso, toIsoDate } from '../../lib/dates'
import type { CalendarBirthday, Match, TeamAnnouncement, TrainingPlanCalendarItem, TrainingTask } from '../../types'

export function TaskPlanningCalendar({ month, selectedDate, tasks, announcements = [], birthdays = [], matches, trainingPlans, showLegend = true, legendVariant = 'management', onMonthChange, onSelectDate }: {
  month: string
  selectedDate: string
  tasks: TrainingTask[]
  announcements?: TeamAnnouncement[]
  birthdays?: CalendarBirthday[]
  matches?: Match[]
  trainingPlans?: TrainingPlanCalendarItem[]
  showLegend?: boolean
  legendVariant?: 'management' | 'player'
  onMonthChange: (month: string) => void
  onSelectDate: (date: string) => void
}) {
  const days = calendarDays(month)
  const today = todayIso()
  const visibleMatches = matches ?? []
  const includesMatches = matches !== undefined
  const visibleTrainingPlans = trainingPlans ?? []
  const includesTrainingPlans = trainingPlans !== undefined

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
          const plannedTasks = tasks.filter((task) => task.status !== 'cancelled' && task.week_start === date)
          const taskCount = plannedTasks.length
          const dayAnnouncements = announcements.filter((announcement) => announcement.status !== 'cancelled' && announcement.announcement_date === date)
          const announcementCount = dayAnnouncements.length
          const dayMatches = visibleMatches.filter((match) => match.status !== 'cancelled' && match.match_date === date)
          const matchCount = dayMatches.length
          const dayTrainingPlans = visibleTrainingPlans.filter((plan) => plan.status === 'published' && plan.session_date === date)
          const trainingPlanCount = dayTrainingPlans.length
          const dayBirthdays = birthdays.filter((birthday) => birthday.birthday_on === date)
          const birthdayCount = dayBirthdays.length
          return (
            <button
              aria-label={`${formatDate(date, { day: 'numeric', month: 'long' })}: ${taskCount} ${taskCount === 1 ? 'tarea planificada' : 'tareas planificadas'} y ${announcementCount} ${announcementCount === 1 ? 'aviso' : 'avisos'}${includesTrainingPlans ? ` y ${trainingPlanCount} ${trainingPlanCount === 1 ? 'entrenamiento publicado' : 'entrenamientos publicados'}` : ''}${includesMatches ? ` y ${matchCount} ${matchCount === 1 ? 'partido' : 'partidos'}` : ''}${birthdayCount ? ` y ${birthdayCount} cumpleaños` : ''}`}
              aria-pressed={selectedDate === date}
              className={`${taskCount || announcementCount || matchCount || trainingPlanCount || birthdayCount ? 'has-data ' : ''}${announcementCount ? 'has-announcement ' : ''}${date === today ? 'today' : ''}`}
              key={date}
              onClick={() => onSelectDate(date)}
              type="button"
            >
              <strong>{Number(date.slice(-2))}</strong>
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
                  {dayMatches.slice(0, 3).map((match) => <i key={match.id}>P</i>)}
                  {matchCount > 3 && <small>+{matchCount - 3}</small>}
                </span>
              )}
              {birthdayCount > 0 && <small aria-hidden="true" className="birthday-mark">🎂 {birthdayCount}</small>}
            </button>
          )
        })}
      </div>
      {showLegend && <div className="calendar-legend">
        <span><i className="task-dot" />T · {legendVariant === 'player' ? 'Tareas publicadas' : 'Tareas publicadas o en borrador guardadas en el lunes de su semana'}</span>
        <span><i className="announcement-dot" />A · Avisos en su fecha exacta</span>
        {includesTrainingPlans && <span><i className="training-plan-dot" />E · Entrenamientos publicados</span>}
        {includesMatches && <span><i className="match-dot" />P · Partidos en su fecha exacta</span>}
        {birthdays.length > 0 && <span>🎂 · Cumpleaños</span>}
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
