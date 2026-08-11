import { formatDate } from '../../lib/dates'
import type { AvailabilityStatus, Match, MatchAvailability, MatchLineup } from '../../types'
import { MatchAvailabilityResponse } from './MatchAvailabilityResponse'

export type MatchCardProps = {
  availability: MatchAvailability[]
  eligiblePlayerCount: number
  isOwner: boolean
  lineup: MatchLineup[]
  match: Match
  ownAvailability?: MatchAvailability
  onEdit: () => void
  onManageLineup: () => void
  onSaveAvailability: (match: Match, status: AvailabilityStatus, comment: string) => Promise<void>
  onViewAvailability: () => void
  onViewLineup: () => void
}

export function MatchCard({
  availability,
  eligiblePlayerCount,
  isOwner,
  lineup,
  match,
  ownAvailability,
  onEdit,
  onManageLineup,
  onSaveAvailability,
  onViewAvailability,
  onViewLineup,
}: MatchCardProps) {
  const canViewLineup = match.lineup_published && lineup.length > 0

  return (
    <article className="match-card">
      <div className="match-card-heading">
        <div>
          <span className="eyebrow">
            {match.is_home ? 'LOCAL' : 'VISITANTE'} · {match.match_kind === 'official' ? 'OFICIAL' : 'AMISTOSO'} · {match.rugby_format === 'sevens' ? 'SEVEN' : 'XV'}
          </span>
          <h2>
            {match.is_home
              ? <>CDU Rugby <i>vs</i> {match.opponent}</>
              : <>{match.opponent} <i>vs</i> CDU Rugby</>}
          </h2>
          <p>
            {formatDate(match.match_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {match.kickoff_time ? ` · ${match.kickoff_time.slice(0, 5)}` : ''}
            {match.venue ? ` · ${match.venue}` : ''}
          </p>
        </div>
        <span className={`match-status ${match.status}`}>{matchStatus(match.status)}</span>
      </div>

      {match.notes && <p className="match-notes">{match.notes}</p>}

      {isOwner ? (
        <>
          <AvailabilitySummary availability={availability} eligiblePlayerCount={eligiblePlayerCount} onView={onViewAvailability} />
          <div className="match-actions">
            <button className="secondary-button compact" onClick={onEdit}>Editar partido</button>
            {canViewLineup && <button className="secondary-button compact" onClick={onViewLineup}>Ver convocatoria</button>}
            {!match.lineup_published && <button className="primary-button compact" onClick={onManageLineup}>Gestionar alineación</button>}
          </div>
        </>
      ) : (
        <>
          <MatchAvailabilityResponse initial={ownAvailability} match={match} onSave={onSaveAvailability} />
          {canViewLineup && (
            <div className="match-actions">
              <button className="secondary-button compact" onClick={onViewLineup}>Ver convocatoria</button>
            </div>
          )}
        </>
      )}
    </article>
  )
}

function AvailabilitySummary({ availability, eligiblePlayerCount, onView }: { availability: MatchAvailability[]; eligiblePlayerCount: number; onView: () => void }) {
  const count = (status: AvailabilityStatus) => availability.filter((item) => item.status === status).length
  const responseCount = new Set(availability.map((item) => item.player_id)).size
  const missingCount = Math.max(0, eligiblePlayerCount - responseCount)

  return (
    <div className="availability-summary">
      <button className="available" onClick={onView}>{count('available')} disponibles</button>
      <button className="doubt" onClick={onView}>{count('doubt')} dudas</button>
      <button className="unavailable" onClick={onView}>{count('unavailable')} no disponibles</button>
      <button className="unanswered" onClick={onView}>{missingCount} sin responder</button>
    </div>
  )
}

function matchStatus(status: Match['status']) {
  if (status === 'draft') return 'Borrador'
  if (status === 'published') return 'Publicado'
  if (status === 'cancelled') return 'Cancelado'
  return 'Finalizado'
}
