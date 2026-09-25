import { formatDate } from '../../lib/dates'
import type { Match } from '../../types'

export { matchTitle } from '../../lib/matchTitle'

export function matchDateLabel(match: Match) {
  return formatDate(match.match_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function matchLogistics(match: Match) {
  const details = [matchDateLabel(match)]
  if (match.callup_time) details.push(`Convocatoria ${match.callup_time.slice(0, 5)}`)
  if (match.callup_venue) details.push(match.callup_venue)
  if (match.kickoff_time) details.push(`Inicio ${match.kickoff_time.slice(0, 5)}`)
  if (match.venue) details.push(match.venue)
  return details.join(' · ')
}
