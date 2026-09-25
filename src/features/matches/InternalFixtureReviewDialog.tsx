import { useId, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import type { Match, MatchLineup, Profile } from '../../types'

type LineupDraft = Omit<MatchLineup, 'match_id' | 'updated_at'>[]

export function InternalFixtureReviewDialog({ matches, lineups, profiles, onClose, onEdit, onSave, onFinalize, onUnlock }: {
  matches: [Match, Match]
  lineups: MatchLineup[]
  profiles: Profile[]
  onClose: () => void
  onEdit: (match: Match) => void
  onSave: (match: Match, entries: LineupDraft, published: boolean) => Promise<void>
  onFinalize: (match: Match) => Promise<void>
  onUnlock: (match: Match) => Promise<void>
}) {
  const titleId = useId()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmMissing, setConfirmMissing] = useState(false)
  const sides = matches.map((match) => ({ match, entries: lineups.filter((entry) => entry.match_id === match.id).sort((a, b) => a.slot_number - b.slot_number) }))
  const overlap = sides[0].entries.filter((entry) => sides[1].entries.some((other) => other.player_id === entry.player_id))
  const published = matches.every((match) => match.lineup_published)
  const starters = matches[0].rugby_format === 'sevens' ? 7 : 15

  async function run(action: () => Promise<void>) {
    setSaving(true)
    setError('')
    try { await action(); setSaving(false) } catch (caught) { setError(errorText(caught)); setSaving(false) }
  }

  function resolve(playerId: string, keep: Match) {
    const other = sides.find((side) => side.match.id !== keep.id)
    if (!other) return
    const next = other.entries.filter((entry) => entry.player_id !== playerId).map(({ player_id, role, position, slot_number, sort_order }) => ({ player_id, role, position, slot_number, sort_order }))
    void run(() => onSave(other.match, next, false))
  }

  function finalize() {
    if (overlap.length) return
    if (sides.some((side) => side.entries.filter((entry) => entry.slot_number <= starters).length < starters) && !confirmMissing) {
      setConfirmMissing(true)
      return
    }
    void run(async () => { await onFinalize(matches[0]); setConfirmMissing(false) })
  }

  return <Modal className="lineup-dialog internal-fixture-dialog" disabled={saving} labelledBy={titleId} onClose={onClose}>
    <div className="task-detail-heading"><div><span className="eyebrow">PARTIDO ENTRE EQUIPOS DEL CDU</span><h2 id={titleId}>{matches[0].season_teams?.name ?? 'Equipo local'} vs {matches[1].season_teams?.name ?? 'Equipo visitante'}</h2><p>Dos propuestas, una convocatoria final por equipo.</p></div><button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button">×</button></div>
    {overlap.length > 0 && <section className="internal-fixture-conflicts"><h3>{overlap.length} {overlap.length === 1 ? 'jugadora propuesta' : 'jugadoras propuestas'} en ambos equipos</h3><p>El owner debe decidir en qué convocatoria queda cada una antes de publicar.</p>{overlap.map((entry) => <div key={entry.player_id}><strong>{profiles.find((profile) => profile.id === entry.player_id)?.display_name ?? 'Jugadora'}</strong>{sides.map((side) => <button className="secondary-button compact" disabled={saving} key={side.match.id} onClick={() => resolve(entry.player_id, side.match)} type="button">Dejar en {side.match.season_teams?.name ?? 'este equipo'}</button>)}</div>)}</section>}
    <div className="internal-fixture-sides">{sides.map(({ match, entries }) => <section key={match.id}><h3>{match.season_teams?.name ?? 'Equipo'} <small>{entries.length}/23</small></h3><p>{entries.filter((entry) => entry.slot_number <= starters).length}/{starters} titulares · {match.lineup_published ? 'Publicada' : 'Borrador'}</p><div>{entries.length ? entries.map((entry) => <div className="internal-fixture-player" key={entry.player_id}><b>{entry.slot_number}</b><span>{profiles.find((profile) => profile.id === entry.player_id)?.display_name ?? 'Jugadora'}</span></div>) : <span className="lineup-empty">Todavía no hay jugadoras propuestas.</span>}</div><button className="secondary-button" disabled={saving || published} onClick={() => onEdit(match)} type="button">Editar convocatoria de {match.season_teams?.name ?? 'este equipo'}</button></section>)}</div>
    {confirmMissing && <p className="form-hint">Faltan titulares en una o ambas convocatorias. Pulsa de nuevo «Publicar ambas convocatorias» para confirmar.</p>}
    {error && <p className="form-error">{error}</p>}
    <div className="form-actions">{published ? <button className="danger-button" disabled={saving} onClick={() => void run(() => onUnlock(matches[0]))} type="button">Desbloquear ambas convocatorias</button> : <button className="primary-button" disabled={saving || overlap.length > 0} onClick={finalize} type="button">Publicar ambas convocatorias</button>}</div>
  </Modal>
}
