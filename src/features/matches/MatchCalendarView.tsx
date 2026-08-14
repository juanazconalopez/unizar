import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatWeek } from '../../lib/dates'
import type { Match } from '../../types'
import { MatchPlanningCalendar } from './MatchPlanningCalendar'

export function MatchCalendarView({
  canManage,
  matches,
  month,
  selectedDate,
  selectedMatches,
  selectedWeek,
  onCreate,
  onGoToCurrentWeek,
  onMonthChange,
  onSelectDate,
  renderMatch,
}: {
  canManage: boolean
  matches: Match[]
  month: string
  selectedDate: string
  selectedMatches: Match[]
  selectedWeek: string
  onCreate: () => void
  onGoToCurrentWeek: () => void
  onMonthChange: (month: string) => void
  onSelectDate: (date: string) => void
  renderMatch: (match: Match) => ReactNode
}) {
  return (
    <div className="task-calendar-view">
      <div className="planning-current-action">
        <button className="secondary-button compact" onClick={onGoToCurrentWeek}>
          <Icon name="calendar" size={16} />Ir a la semana actual
        </button>
      </div>
      <MatchPlanningCalendar
        matches={matches}
        month={month}
        selectedDate={selectedDate}
        onMonthChange={onMonthChange}
        onSelectDate={onSelectDate}
      />
      <section className="selected-planning-week">
        <div className="task-week-heading">
          <div>
            <span className="eyebrow">SEMANA SELECCIONADA</span>
            <h2>{formatWeek(selectedWeek)}</h2>
          </div>
          <span>{selectedMatches.length} {selectedMatches.length === 1 ? 'partido' : 'partidos'}</span>
        </div>
        <div className="match-list">
          {selectedMatches.map(renderMatch)}
          {!selectedMatches.length && <EmptyState title="Semana sin partidos" text="No hay ningún partido programado esta semana." />}
        </div>
        {canManage && (
          <div className="selected-week-actions">
            <button className="primary-button" onClick={onCreate}>
              <Icon name="plus" size={18} />Nuevo partido
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
