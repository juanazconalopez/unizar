import { useId, useState } from 'react'
import { todayInMadridIso } from '../../lib/dates'
import { matchReportUrl, type SavedReportEvent } from '../../services/matchReportService'
import { MatchReportDialog } from './MatchReportDialog'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { copyText } from '../../lib/fileExport'
import { lineupPlainText } from '../../lib/matchExports'
import type { AvailabilityStatus, Match, MatchAvailability, MatchLineup, Profile, SeasonTeamCoach } from '../../types'
import { MatchAvailabilityResponse } from './MatchAvailabilityResponse'
import { PublishedLineup } from './MatchLineupDialog'
import { LineupGraphic, LineupGraphicDialog } from './LineupGraphicDialog'
import { matchDateLabel, matchTitle } from './matchPresentation'

export function MatchDetailDialog({
  canEditMatch,
  canManageLineup,
  canGraphicExport = false,
  canViewAvailability,
  canViewReportPdf = false,
  demo = false,
  demoCoaches,
  onLoadGraphicPhoto,
  isPlayer,
  lineup,
  match,
  pairedLineup,
  pairedMatch,
  ownAvailability,
  profiles,
  onClose,
  onEdit,
  onManageLineup,
  onReviewInternal,
  onSaveAvailability,
  onSaveReport,
  onViewAvailability,
}: {
  canEditMatch: boolean
  canManageLineup: boolean
  canGraphicExport?: boolean
  canViewAvailability: boolean
  canViewReportPdf?: boolean
  demo?: boolean
  demoCoaches?: SeasonTeamCoach[]
  onLoadGraphicPhoto?: (path: string) => Promise<string>
  isPlayer: boolean
  lineup: MatchLineup[]
  match: Match
  pairedLineup?: MatchLineup[]
  pairedMatch?: Match
  ownAvailability?: MatchAvailability
  profiles: Profile[]
  onClose: () => void
  onEdit: () => void
  onManageLineup: () => void
  onReviewInternal?: () => void
  onSaveAvailability?: (match: Match, status: AvailabilityStatus, comment: string) => Promise<void>
  onSaveReport?: (match: Match, file: File, scores: { team: number; opponent: number }, duration: number, events: SavedReportEvent[], reviewed: boolean) => Promise<void>
  onViewAvailability: () => void
}) {
  const titleId = useId()
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [graphicOpen, setGraphicOpen] = useState(false)
  const [lineupView, setLineupView] = useState<'image' | 'list'>('image')
  const [selectedPublishedMatchId, setSelectedPublishedMatchId] = useState(match.id)
  const [reportError, setReportError] = useState('')
  const hasPublishedLineup = match.lineup_published
  const showTeamSelector = Boolean(match.internal_fixture_id && hasPublishedLineup && pairedMatch?.lineup_published && pairedMatch.internal_fixture_id === match.internal_fixture_id)
  const selectedPublishedMatch = showTeamSelector && pairedMatch && selectedPublishedMatchId === pairedMatch.id ? pairedMatch : match
  const selectedLineup = selectedPublishedMatch.id === match.id ? lineup : pairedLineup ?? []
  const starters = selectedPublishedMatch.rugby_format === 'sevens' ? 7 : 15
  const publishedTeams = showTeamSelector && pairedMatch ? [match, pairedMatch].sort((first, second) => Number(second.is_home) - Number(first.is_home)) : []

  async function copyLineup() {
    try {
      setCopyError('')
      await copyText(lineupPlainText(selectedPublishedMatch, selectedLineup, profiles))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch (caught) {
      setCopyError(errorText(caught))
    }
  }

  async function openReport() {
    if (!match.match_report_path) return
    const tab = window.open('', '_blank')
    try {
      const url = match.match_report_path.startsWith('blob:') ? match.match_report_path : await matchReportUrl(match.match_report_path)
      if (tab) { tab.opener = null; tab.location.replace(url) }
      else setReportError('El navegador ha bloqueado la pestaña del acta.')
    } catch (error) { tab?.close(); setReportError(errorText(error)) }
  }

  if (reportOpen && onSaveReport) return <MatchReportDialog match={match} lineup={lineup} profiles={profiles} onClose={() => setReportOpen(false)} onSave={(file, scores, duration, events, reviewed) => onSaveReport(match, file, scores, duration, events, reviewed)} />
  if (graphicOpen) return <LineupGraphicDialog canLoadPhotos={canGraphicExport} demo={demo} demoCoaches={demoCoaches} entries={selectedLineup} match={selectedPublishedMatch} onClose={() => setGraphicOpen(false)} onLoadPhoto={onLoadGraphicPhoto} profiles={profiles} />

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

    {match.match_report_path && <section className="match-detail-notes"><h3>Acta del partido</h3><p>{match.team_score} - {match.opponent_score} · {match.report_events_reviewed ? 'Eventos revisados' : 'Eventos pendientes de revisar'}</p>{canViewReportPdf && <button className="secondary-button compact" onClick={() => void openReport()} type="button">Ver PDF del acta</button>}{reportError && <p className="form-error">{reportError}</p>}</section>}
    {onSaveReport && canEditMatch && match.match_date < todayInMadridIso() && match.status !== 'draft' && match.status !== 'cancelled' && <div className="match-detail-actions"><button className="secondary-button" onClick={() => setReportOpen(true)} type="button">{match.match_report_path ? 'Sustituir acta' : 'Subir acta'}</button></div>}

    {isPlayer && onSaveAvailability && <MatchAvailabilityResponse initial={ownAvailability} match={match} onSave={onSaveAvailability} />}

    <section className="match-detail-callup">
      <div className="match-detail-section-heading">
        <div><span className="eyebrow">CONVOCATORIA</span><h3>{hasPublishedLineup ? 'Convocatoria publicada' : canManageLineup && lineup.length ? 'Borrador de convocatoria' : 'Próximamente'}</h3></div>
        <div className="match-detail-section-actions">
          {canViewAvailability && <button className="secondary-button compact match-detail-availability-button" onClick={onViewAvailability} type="button">Ver disponibilidades</button>}
          {hasPublishedLineup && <button className="secondary-button compact match-lineup-view-toggle" onClick={() => setLineupView((view) => view === 'image' ? 'list' : 'image')} type="button"><Icon name="swap" size={16} />{lineupView === 'image' ? 'Ver lista' : 'Ver imagen'}</button>}
          {hasPublishedLineup && <button aria-label={copied ? 'Convocatoria copiada' : 'Copiar convocatoria'} className="icon-button match-copy-button" onClick={() => void copyLineup()} title={copied ? 'Convocatoria copiada' : 'Copiar convocatoria'} type="button"><Icon name={copied ? 'check' : 'copy'} size={16} /></button>}
        </div>
      </div>
      {hasPublishedLineup ? <>
        {showTeamSelector && <div aria-label="Equipo de la convocatoria" className="match-lineup-team-selector" role="group">{publishedTeams.map((team) => <button aria-pressed={selectedPublishedMatch.id === team.id} className="secondary-button compact" key={team.id} onClick={() => { setSelectedPublishedMatchId(team.id); setCopied(false); setCopyError('') }} type="button">{team.season_teams?.name ?? (team.is_home ? 'Equipo local' : 'Equipo visitante')}</button>)}</div>}
        <div className="match-lineup-view-panel" data-view="image" hidden={lineupView !== 'image'}>
          <LineupGraphic canLoadPhotos={canGraphicExport} demo={demo} demoCoaches={demoCoaches} embedded entries={selectedLineup} key={selectedPublishedMatch.id} match={selectedPublishedMatch} onClose={() => setGraphicOpen(false)} onOpen={() => setGraphicOpen(true)} onLoadPhoto={onLoadGraphicPhoto} profiles={profiles} />
        </div>
        {lineupView === 'list' && <div className="match-lineup-view-panel" data-view="list"><PublishedLineup entries={selectedLineup} profiles={profiles} starters={starters} /></div>}
      </> : canManageLineup && lineup.length ? <PublishedLineup entries={lineup} profiles={profiles} starters={starters} /> : <p className="match-callup-pending">{isPlayer ? 'Tu disponibilidad ayuda a preparar la convocatoria. En cuanto esté lista podrás revisarla aquí.' : 'Prepara la convocatoria cuando dispongas de las respuestas del equipo.'}</p>}
      {copyError && <p className="form-error">{copyError}</p>}
      {canManageLineup && <div className="match-detail-actions"><button className="primary-button" onClick={onManageLineup} type="button">{match.lineup_published ? 'Gestionar convocatoria' : 'Preparar convocatoria'}</button>{onReviewInternal && <button className="secondary-button" onClick={onReviewInternal} type="button">Revisar las dos convocatorias</button>}</div>}
    </section>
  </Modal>
}
