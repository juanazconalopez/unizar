import type { ReactNode, Ref } from 'react'
import { Icon } from '../../components/Icon'
import type { Match } from '../../types'
import { MatchWeekSection } from './MatchWeekSection'
import type { MatchWeek } from './MatchWeekSection'

export function MatchListView({
  currentWeek,
  currentWeekRef,
  canManage,
  onCreate,
  renderMatch,
  weeks,
}: {
  currentWeek: string
  currentWeekRef: Ref<HTMLElement>
  canManage: boolean
  onCreate: () => void
  renderMatch: (match: Match) => ReactNode
  weeks: MatchWeek[]
}) {
  return (
    <div className="match-week-list">
      {weeks.map(({ weekStart, weekMatches }) => (
        <MatchWeekSection
          eyebrow={weekStart === currentWeek ? 'SEMANA ACTUAL' : 'PRÓXIMA'}
          key={weekStart}
          renderMatch={renderMatch}
          sectionRef={weekStart === currentWeek ? currentWeekRef : undefined}
          weekMatches={weekMatches}
          weekStart={weekStart}
        />
      ))}
      {canManage && (
        <div className="match-list-create">
          <button className="primary-button" onClick={onCreate}>
            <Icon name="plus" size={18} />Nuevo partido
          </button>
        </div>
      )}
    </div>
  )
}
