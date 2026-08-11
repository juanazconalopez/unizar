import type { ReactNode, Ref } from 'react'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatWeek } from '../../lib/dates'
import type { Match } from '../../types'

export type MatchWeek = {
  weekStart: string
  weekMatches: Match[]
}

export function MatchWeekSection({
  emptyText = 'No hay ningún partido programado esta semana.',
  eyebrow,
  renderMatch,
  sectionRef,
  weekMatches,
  weekStart,
}: MatchWeek & {
  emptyText?: string
  eyebrow: string
  renderMatch: (match: Match) => ReactNode
  sectionRef?: Ref<HTMLElement>
}) {
  return (
    <section className="task-week-group" ref={sectionRef}>
      <div className="task-week-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{formatWeek(weekStart)}</h2>
        </div>
        <span>{weekMatches.length} {weekMatches.length === 1 ? 'partido' : 'partidos'}</span>
      </div>
      <div className="match-list">
        {weekMatches.map(renderMatch)}
        {!weekMatches.length && <EmptyState title="Semana sin partidos" text={emptyText} />}
      </div>
    </section>
  )
}
