import { matchColorStyle } from '../../lib/seasonCompetitions'
import type { AvailabilityStatus, Match, MatchAvailability } from '../../types'
import { MatchAvailabilityResponse } from './MatchAvailabilityResponse'
import { matchLogistics, matchTitle } from './matchPresentation'

export type MatchCardProps = {
  availability?: MatchAvailability[]
  canEditMatch: boolean
  canViewAvailability?: boolean
  eligiblePlayerCount?: number
  isPlayer: boolean
  match: Match
  ownAvailability?: MatchAvailability
  onOpen: () => void
  onSaveAvailability?: (match: Match, status: AvailabilityStatus, comment: string) => Promise<void>
  onViewAvailability?: () => void
}

export function MatchCard({ availability = [], canEditMatch, canViewAvailability = false, eligiblePlayerCount = 0, isPlayer, match, ownAvailability, onOpen, onSaveAvailability, onViewAvailability }: MatchCardProps) {
  return (
    <article className="match-card" style={matchColorStyle(match)}>
      <button aria-label={`Ver detalle de ${matchTitle(match)}`} className="match-card-summary" onClick={onOpen} type="button">
        <div className="match-card-heading">
          <div>
            <div className="match-card-labels"><span className="match-competition-label">{match.match_kind === 'official' ? match.season_competitions?.name ?? 'Competición' : 'Amistoso'}</span><span className="eyebrow">
              {match.is_home ? 'LOCAL' : 'VISITANTE'} · {match.rugby_format === 'sevens' ? 'SEVEN' : 'XV'}
            </span></div>
            <h2>{matchTitle(match)}</h2>
            <p>{matchLogistics(match)}</p>
          </div>
          {canEditMatch && <span className={`match-status ${match.status}`}>{matchStatus(match.status)}</span>}
        </div>
        {match.notes && <p className="match-notes">{match.notes}</p>}
      </button>
      {canViewAvailability && onViewAvailability && <AvailabilitySummary availability={availability} eligiblePlayerCount={eligiblePlayerCount} onView={onViewAvailability} />}
      {isPlayer && onSaveAvailability && <MatchAvailabilityResponse initial={ownAvailability} match={match} onSave={onSaveAvailability} />}
    </article>
  )
}

function AvailabilitySummary({ availability, eligiblePlayerCount, onView }: { availability: MatchAvailability[]; eligiblePlayerCount: number; onView: () => void }) {
  const count = (status: AvailabilityStatus) => availability.filter((item) => item.status === status).length
  const responseCount = new Set(availability.map((item) => item.player_id)).size
  const missingCount = Math.max(0, eligiblePlayerCount - responseCount)

  return <div className="availability-summary">
    <button className="available" onClick={onView} type="button">{count('available')} disponibles</button>
    <button className="doubt" onClick={onView} type="button">{count('doubt')} dudas</button>
    <button className="unavailable" onClick={onView} type="button">{count('unavailable')} no disponibles</button>
    <button className="unanswered" onClick={onView} type="button">{missingCount} sin responder</button>
  </div>
}

function matchStatus(status: Match['status']) {
  if (status === 'draft') return 'Borrador'
  if (status === 'published') return 'Publicado'
  if (status === 'cancelled') return 'Cancelado'
  return 'Finalizado'
}
