import { Icon } from '../../components/Icon'
import { formatDate } from '../../lib/dates'
import type { CrossTeamCallupReference } from '../../lib/crossTeamCallups'

export function CrossTeamCallupBadge({ reference }: { reference: CrossTeamCallupReference }) {
  const team = reference.teamName ?? 'Otro equipo'
  const shortName = team.match(/\b([AB])$/i)?.[1].toUpperCase() ?? team
  const description = `Convocada en la última acta de ${team}${reference.matchDate ? ` · ${formatDate(reference.matchDate)}` : ''}${reference.confirmed ? '' : ' · Acta pendiente de confirmar'}`
  return <span className="lineup-acta-badge" aria-label={description} title={description}><Icon name="tasks" size={13} />{shortName}</span>
}
