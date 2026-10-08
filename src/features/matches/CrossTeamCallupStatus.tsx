import { formatDate } from '../../lib/dates'
import { CROSS_TEAM_CALLUP_LIMIT, crossTeamCallupOverlap, crossTeamCallupRestriction } from '../../lib/crossTeamCallups'
import type { CrossTeamCallupReference } from '../../lib/crossTeamCallups'
import type { Profile } from '../../types'

export function CrossTeamCallupStatus({ reference, playerIds, profiles }: {
  reference: CrossTeamCallupReference
  playerIds: Iterable<string>
  profiles: Profile[]
}) {
  if (!reference.enabled) return null
  const selected = [...playerIds]
  const repeated = crossTeamCallupOverlap(reference, selected)
  const restriction = crossTeamCallupRestriction(reference, selected)
  return <section aria-label="Límite de jugadoras repetidas" className="lineup-warning">
    <div>
      <strong>Repetidas de la última acta del otro equipo: {repeated.length}/{CROSS_TEAM_CALLUP_LIMIT}</strong>
      {reference.matchId ? <p>{reference.teamName ?? 'Otro equipo'} · {reference.matchDate ? formatDate(reference.matchDate) : ''} · {reference.confirmed ? 'Acta confirmada' : 'Acta pendiente de confirmar'}</p> : <p>Sin partido anterior del otro equipo en esta competición. Todavía no se aplica el límite.</p>}
      {repeated.length > 0 && <p>{repeated.map((id) => profiles.find((profile) => profile.id === id)?.display_name ?? 'Jugadora').join(', ')}</p>}
      {restriction && <p className="form-error" role="alert">{restriction} Puedes guardar el borrador.</p>}
    </div>
  </section>
}
