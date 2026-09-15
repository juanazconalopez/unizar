import { useId, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { copyText } from '../../lib/fileExport'
import { lineupPlainText } from '../../lib/matchExports'
import type { AvailabilityStatus, Match, MatchAvailability, MatchLineup, Profile } from '../../types'
import { MatchAvailabilityResponse } from './MatchAvailabilityResponse'
import { PublishedLineup } from './MatchLineupDialog'
import { matchDateLabel, matchTitle } from './matchPresentation'

export function MatchDetailDialog({
  canEditMatch,
  canManageLineup,
  canViewAvailability,
  isPlayer,
  lineup,
  match,
  ownAvailability,
  profiles,
  onClose,
  onEdit,
  onManageLineup,
  onSaveAvailability,
  onViewAvailability,
}: {
  canEditMatch: boolean
  canManageLineup: boolean
  canViewAvailability: boolean
  isPlayer: boolean
  lineup: MatchLineup[]
  match: Match
  ownAvailability?: MatchAvailability
  profiles: Profile[]
  onClose: () => void
  onEdit: () => void
  onManageLineup: () => void
  onSaveAvailability?: (match: Match, status: AvailabilityStatus, comment: string) => Promise<void>
  onViewAvailability: () => void
}) {
  const titleId = useId()
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const starters = match.rugby_format === 'sevens' ? 7 : 15
  const hasPublishedLineup = match.lineup_published

  async function copyLineup() {
    try {
      setCopyError('')
      await copyText(lineupPlainText(match, lineup, profiles))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch (caught) {
      setCopyError(errorText(caught))
    }
  }

  return <Modal className="match-detail-dialog" labelledBy={titleId} onClose={onClose}>
    <div className="task-detail-heading">
      <div><span className="eyebrow">{match.match_kind === 'official' ? match.season_competitions?.name ?? 'COMPETICIÓN' : 'AMISTOSO'}</span><h2 id={titleId}>{matchTitle(match)}</h2><p className="match-detail-date">{matchDateLabel(match)}</p></div>
      <div className="match-detail-heading-actions">
        {canEditMatch && <button aria-label="Editar partido" className="icon-button" onClick={onEdit} title="Editar partido" type="button"><Icon name="edit" size={17} /></button>}
        <button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button">×</button>
      </div>
    </div>

    {(match.callup_time || match.callup_venue || match.kickoff_time || match.venue) && <dl className="match-detail-logistics">
      {(match.callup_time || match.callup_venue) && <div className="match-detail-logistics-row">
        {match.callup_time && <div><dt>Hora de convocatoria</dt><dd><strong>{match.callup_time.slice(0, 5)}</strong></dd></div>}
        {match.callup_venue && <div><dt>Lugar de convocatoria</dt><dd>{match.callup_venue}</dd></div>}
      </div>}
      {(match.venue || match.kickoff_time) && <div className="match-detail-logistics-row">
        {match.venue && <div><dt>Lugar del partido</dt><dd>{match.venue}</dd></div>}
        {match.kickoff_time && <div><dt>Hora de inicio</dt><dd>{match.kickoff_time.slice(0, 5)}</dd></div>}
      </div>}
    </dl>}
    {match.notes && <section className="match-detail-notes"><h3>Información</h3><p>{match.notes}</p></section>}

    {isPlayer && onSaveAvailability && <MatchAvailabilityResponse initial={ownAvailability} match={match} onSave={onSaveAvailability} />}

    <section className="match-detail-callup">
      <div className="match-detail-section-heading"><div><span className="eyebrow">CONVOCATORIA</span><h3>{hasPublishedLineup ? 'Convocatoria publicada' : 'Próximamente'}</h3></div><div className="match-detail-section-actions">{canViewAvailability && <button className="secondary-button compact" onClick={onViewAvailability} type="button">Ver disponibilidades</button>}{hasPublishedLineup && <button aria-label={copied ? 'Convocatoria copiada' : 'Copiar convocatoria'} className="icon-button match-copy-button" onClick={() => void copyLineup()} title={copied ? 'Convocatoria copiada' : 'Copiar convocatoria'} type="button"><Icon name={copied ? 'check' : 'copy'} size={16} /></button>}</div></div>
      {hasPublishedLineup ? lineup.length ? <PublishedLineup entries={lineup} profiles={profiles} starters={starters} /> : <p className="match-callup-pending">La convocatoria se ha publicado sin jugadoras asignadas.</p> : <p className="match-callup-pending">{isPlayer ? 'Tu disponibilidad ayuda a preparar la convocatoria. En cuanto esté lista podrás revisarla aquí.' : 'Prepara la convocatoria cuando dispongas de las respuestas del equipo.'}</p>}
      {copyError && <p className="form-error">{copyError}</p>}
      {canManageLineup && <div className="match-detail-actions"><button className="primary-button" onClick={onManageLineup} type="button">{match.lineup_published ? 'Gestionar convocatoria' : 'Preparar convocatoria'}</button></div>}
    </section>
  </Modal>
}
