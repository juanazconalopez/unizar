import { formatDate, toIsoDate } from '../../lib/dates'
import type { Match } from '../../types'

export function MatchPlanningCalendar({ matches, month, selectedDate, onMonthChange, onSelectDate }: {
  matches: Match[]
  month: string
  selectedDate: string
  onMonthChange: (month: string) => void
  onSelectDate: (date: string) => void
}) {
  function changeMonth(offset: number) {
    const next = offsetMonth(month, offset)
    onMonthChange(next)
    onSelectDate(next)
  }

  return <section aria-label="Calendario de partidos" className="calendar-panel match-planning-panel">
    <div className="calendar-toolbar">
      <button aria-label="Mes anterior" onClick={() => changeMonth(-1)} type="button">‹</button>
      <div><span className="eyebrow">PLANIFICACIÓN MENSUAL</span><h2>{formatDate(month, { month: 'long', year: 'numeric' })}</h2></div>
      <button aria-label="Mes siguiente" onClick={() => changeMonth(1)} type="button">›</button>
    </div>
    <div aria-hidden="true" className="calendar-weekdays">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
    <div className="statistics-calendar match-planning-calendar">{calendarDays(month).map((date, index) => {
      if (!date) return <span className="calendar-empty" key={`empty-${index}`} />
      const dayMatches = matches.filter((match) => match.status !== 'cancelled' && match.match_date === date)
      return <button
        aria-label={`${formatDate(date, { day: 'numeric', month: 'long' })}: ${dayMatches.length} ${dayMatches.length === 1 ? 'partido' : 'partidos'}`}
        aria-pressed={selectedDate === date}
        className={dayMatches.length ? 'has-match' : ''}
        key={date}
        onClick={() => onSelectDate(date)}
        type="button"
      ><strong>{Number(date.slice(-2))}</strong>{dayMatches.length > 0 && <span aria-hidden="true" className="match-day-marks">{dayMatches.slice(0, 3).map((match) => <i key={match.id}>P</i>)}{dayMatches.length > 3 && <small>+{dayMatches.length - 3}</small>}</span>}</button>
    })}</div>
    <div className="calendar-legend"><span><i className="match-dot" />P · Día de partido</span></div>
  </section>
}

function calendarDays(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstDay = new Date(year, monthNumber - 1, 1, 12)
  const offset = (firstDay.getDay() + 6) % 7
  const totalDays = new Date(year, monthNumber, 0, 12).getDate()
  return [...Array.from<null>({ length: offset }).fill(null), ...Array.from({ length: totalDays }, (_, index) => toIsoDate(new Date(year, monthNumber - 1, index + 1, 12)))]
}

function offsetMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  return toIsoDate(new Date(year, monthNumber - 1 + offset, 1, 12))
}
