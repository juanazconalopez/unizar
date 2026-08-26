import { useId, useState } from 'react'
import type { DragEvent } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar } from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { copyText, downloadText } from '../../lib/fileExport'
import { lineupPlainText, lineupXml } from '../../lib/matchExports'
import { activePlayers, membershipCoversDate } from '../../lib/selectors'
import type { Match, MatchAvailability, MatchLineup, Profile, SeasonPlayer } from '../../types'

export function MatchLineupDialog({ availability, canExport = true, entries, match, memberships, profiles, onClose, onSave, onUnlock }: {
  availability: MatchAvailability[]
  canExport?: boolean
  entries: MatchLineup[]
  match: Match
  memberships: SeasonPlayer[]
  profiles: Profile[]
  onClose: () => void
  onSave?: (entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) => Promise<void>
  onUnlock?: () => Promise<void>
}) {
  const titleId = useId()
  const [locked, setLocked] = useState(match.lineup_published)
  const editable = Boolean(onSave) && !locked
  const limit = lineupLimit(match)
  const starters = match.rugby_format === 'sevens' ? 7 : 15
  const eligible = activePlayers(profiles).filter((profile) => memberships.some((membership) => (
    membership.player_id === profile.id && membership.season_id === match.season_id && membershipCoversDate(membership, match.match_date)
  )))
  const availableIds = new Set(availability.filter((item) => item.status === 'available').map((item) => item.player_id))
  const [slots, setSlots] = useState<Record<number, string>>(() => Object.fromEntries(
    entries
      .filter((entry) => !editable || availableIds.has(entry.player_id))
      .map((entry) => [entry.slot_number, entry.player_id]),
  ))
  const [published, setPublished] = useState(match.lineup_published)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmMissing, setConfirmMissing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmUnlock, setConfirmUnlock] = useState(false)
  const selectedIds = new Set(Object.values(slots))
  const selectable = eligible.filter((player) => availableIds.has(player.id) && !selectedIds.has(player.id))

  function assign(playerId: string, slot: number) {
    setSlots((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([, selectedId]) => selectedId !== playerId)) as Record<number, string>
      next[slot] = playerId
      return next
    })
  }

  function drop(event: DragEvent, slot: number) {
    event.preventDefault()
    const playerId = event.dataTransfer.getData('text/player-id')
    if (playerId && !slots[slot]) assign(playerId, slot)
  }

  async function save(confirmed = false) {
    if (!onSave) return
    const missingStarters = Array.from({ length: starters }, (_, index) => index + 1).filter((slot) => !slots[slot])
    if (published && missingStarters.length && !confirmed) { setConfirmMissing(true); return }
    setSaving(true); setError('')
    const lineup = Object.entries(slots).map(([slotValue, player_id]) => {
      const slot_number = Number(slotValue)
      return { player_id, slot_number, role: slot_number <= starters ? 'starter' as const : 'substitute' as const, position: null, sort_order: slot_number }
    }).sort((first, second) => first.slot_number - second.slot_number)
    try { await onSave(lineup, published) } catch (caught) { setError(errorText(caught)); setSaving(false) }
  }

  async function copyLineup() {
    try {
      await copyText(lineupPlainText(match, entries, profiles))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch (caught) {
      setError(errorText(caught))
    }
  }

  async function unlock() {
    if (!onUnlock) return
    setSaving(true); setError('')
    try {
      await onUnlock()
      setLocked(false)
      setPublished(false)
      setConfirmUnlock(false)
      setSaving(false)
    } catch (caught) {
      setError(errorText(caught))
      setConfirmUnlock(false)
      setSaving(false)
    }
  }

  return <Modal className="lineup-dialog" disabled={saving} labelledBy={titleId} onClose={onClose}>
    <div className="task-detail-heading"><div><span className="eyebrow">{editable ? 'GESTIONAR ALINEACIÓN' : 'CONVOCATORIA'}</span><h2 id={titleId}>Partido contra {match.opponent}</h2><p>{matchTypeLabel(match)} · {Object.keys(slots).length}/{limit} jugadoras</p></div><button aria-label="Cerrar" className="icon-button" onClick={onClose}>×</button></div>
    {editable ? <div className="lineup-board">
      <section className="available-player-pool"><h3>Disponibles</h3><p>Arrastra una jugadora a un dorsal o pulsa Añadir.</p><div>{selectable.map((player) => <article draggable key={player.id} onDragStart={(event) => event.dataTransfer.setData('text/player-id', player.id)}><Avatar name={player.display_name} /><strong>{player.display_name}</strong><button className="secondary-button compact" onClick={() => { const empty = Array.from({ length: limit }, (_, index) => index + 1).find((slot) => !slots[slot]); if (empty) assign(player.id, empty) }} type="button">Añadir</button></article>)}{!selectable.length && <span className="lineup-empty">No quedan jugadoras disponibles sin asignar.</span>}</div></section>
      <section className="numbered-lineup"><h3>Alineación</h3><div className="lineup-section-label">Titulares</div>{Array.from({ length: limit }, (_, index) => index + 1).map((slot) => {
        const playerId = slots[slot]
        const player = eligible.find((item) => item.id === playerId) ?? profiles.find((item) => item.id === playerId)
        const availableSlots = Array.from({ length: limit }, (_, option) => option + 1)
          .filter((option) => option === slot || !slots[option])
        return <div className={`lineup-slot ${player ? 'filled' : ''}`} key={slot} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, slot)}>
          {slot === starters + 1 && <span className="lineup-section-label substitutes">Suplentes</span>}
          <b>{slot}</b>{player ? <>
            <div className="lineup-player-identity"><Avatar name={player.display_name} /><strong>{player.display_name}</strong></div>
            <button aria-label={`Quitar a ${player.display_name}`} className="icon-button lineup-remove-button" onClick={() => setSlots((current) => { const next = { ...current }; delete next[slot]; return next })} type="button">×</button>
            <label className="lineup-position-field"><span>Posición / dorsal</span><select aria-label={`Posición de ${player.display_name}`} onChange={(event) => assign(player.id, Number(event.target.value))} value={slot}>{availableSlots.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          </> : <span>Suelta aquí</span>}
        </div>
      })}</section>
    </div> : <><PublishedLineup entries={entries} profiles={profiles} starters={starters} />{(locked && onUnlock) || canExport ? <div className="lineup-export-actions">{locked && onUnlock && <button className="danger-button" onClick={() => setConfirmUnlock(true)} type="button">Desbloquear para editar</button>}{canExport && <><button className="secondary-button" onClick={() => void copyLineup()} type="button"><Icon name="copy" size={17} />{copied ? 'Convocatoria copiada' : 'Copiar convocatoria'}</button><button className="primary-button" onClick={() => downloadText(`convocatoria-${match.match_date}-${match.opponent}.xml`, lineupXml(match, entries, profiles), 'application/xml')} type="button"><Icon name="download" size={17} />Descargar XML</button></>}</div> : null}{error && <p className="form-error">{error}</p>}</>}
    {editable && <><label className="publish-lineup"><input checked={published} disabled={locked} onChange={(event) => setPublished(event.target.checked)} type="checkbox" />{locked ? 'Convocatoria publicada' : 'Publicar convocatoria para las jugadoras'}</label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar alineación'}</button></div></>}
    {confirmMissing && <MissingStartersDialog missing={Array.from({ length: starters }, (_, index) => index + 1).filter((slot) => !slots[slot])} onCancel={() => setConfirmMissing(false)} onConfirm={() => { setConfirmMissing(false); void save(true) }} />}
    {confirmUnlock && <UnlockLineupDialog onCancel={() => setConfirmUnlock(false)} onConfirm={() => void unlock()} />}
  </Modal>
}

function UnlockLineupDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const titleId = useId()
  return <Modal className="lineup-confirm-dialog" labelledBy={titleId} onClose={onCancel}>
    <div className="task-detail-heading"><div><span className="eyebrow">DESBLOQUEAR CONVOCATORIA</span><h2 id={titleId}>¿Volver a editar la convocatoria?</h2></div><button aria-label="Cerrar" className="icon-button" onClick={onCancel}>×</button></div>
    <div className="lineup-warning"><IconWarning /><div><strong>La convocatoria dejará de estar publicada</strong><p>Las jugadoras podrán cambiar su disponibilidad y cualquier baja saldrá de la alineación. Cuando termines los cambios tendrás que publicarla de nuevo.</p></div></div>
    <div className="form-actions"><button className="secondary-button" onClick={onCancel}>Mantener bloqueada</button><button className="danger-button" onClick={onConfirm}>Sí, desbloquear</button></div>
  </Modal>
}

function MissingStartersDialog({ missing, onCancel, onConfirm }: { missing: number[]; onCancel: () => void; onConfirm: () => void }) {
  const titleId = useId()
  return <Modal className="lineup-confirm-dialog" labelledBy={titleId} onClose={onCancel}>
    <div className="task-detail-heading"><div><span className="eyebrow">COMPROBAR ALINEACIÓN</span><h2 id={titleId}>Hay titulares sin rellenar</h2></div><button aria-label="Cerrar" className="icon-button" onClick={onCancel}>×</button></div>
    <div className="lineup-warning"><IconWarning /><div><strong>Faltan {missing.length} {missing.length === 1 ? 'titular' : 'titulares'}</strong><p>Dorsales sin asignar: {missing.join(', ')}. Puedes publicar igualmente si el equipo va a jugar con menos jugadoras.</p></div></div>
    <div className="form-actions"><button className="secondary-button" onClick={onCancel}>Revisar alineación</button><button className="primary-button" onClick={onConfirm}>Publicar igualmente</button></div>
  </Modal>
}

function IconWarning() { return <span aria-hidden="true">!</span> }

function PublishedLineup({ entries, profiles, starters }: { entries: MatchLineup[]; profiles: Profile[]; starters: number }) {
  const ordered = [...entries].sort((first, second) => first.slot_number - second.slot_number)
  return <div className="lineup-roster"><RosterSection entries={ordered.filter((entry) => entry.slot_number <= starters)} label="Titulares" profiles={profiles} /><RosterSection entries={ordered.filter((entry) => entry.slot_number > starters)} label="Suplentes" profiles={profiles} /></div>
}

function RosterSection({ entries, label, profiles }: { entries: MatchLineup[]; label: string; profiles: Profile[] }) {
  if (!entries.length) return null
  return <section><h3>{label}</h3>{entries.map((entry) => <div key={entry.player_id}><b>{entry.slot_number}</b><span>{profiles.find((profile) => profile.id === entry.player_id)?.display_name ?? 'Jugadora'}</span></div>)}</section>
}

function lineupLimit(match: Match) {
  if (match.match_kind === 'official') return 23
  return match.rugby_format === 'sevens' ? 7 : 15
}

function matchTypeLabel(match: Match) {
  return `${match.match_kind === 'official' ? 'Oficial' : 'Amistoso'} · ${match.rugby_format === 'sevens' ? 'Rugby Seven' : 'Rugby XV'}`
}
