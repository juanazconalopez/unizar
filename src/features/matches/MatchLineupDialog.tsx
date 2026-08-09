import { useId, useState } from 'react'
import type { DragEvent } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import { activePlayers, membershipCoversDate } from '../../lib/selectors'
import type { Match, MatchAvailability, MatchLineup, Profile, SeasonPlayer } from '../../types'

export function MatchLineupDialog({ availability, entries, match, memberships, profiles, onClose, onSave }: {
  availability: MatchAvailability[]
  entries: MatchLineup[]
  match: Match
  memberships: SeasonPlayer[]
  profiles: Profile[]
  onClose: () => void
  onSave?: (entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) => Promise<void>
}) {
  const titleId = useId()
  const editable = Boolean(onSave)
  const limit = lineupLimit(match)
  const starters = match.rugby_format === 'sevens' ? 7 : 15
  const eligible = activePlayers(profiles).filter((profile) => !profile.is_collaborator && memberships.some((membership) => (
    membership.player_id === profile.id && membership.season_id === match.season_id && membershipCoversDate(membership, match.match_date)
  )))
  const availableIds = new Set(availability.filter((item) => item.status === 'available').map((item) => item.player_id))
  const [slots, setSlots] = useState<Record<number, string>>(() => Object.fromEntries(entries.map((entry) => [entry.slot_number, entry.player_id])))
  const [published, setPublished] = useState(match.lineup_published)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
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
    if (playerId) assign(playerId, slot)
  }

  async function save() {
    if (!onSave) return
    setSaving(true); setError('')
    const lineup = Object.entries(slots).map(([slotValue, player_id]) => {
      const slot_number = Number(slotValue)
      return { player_id, slot_number, role: slot_number <= starters ? 'starter' as const : 'substitute' as const, position: null, sort_order: slot_number }
    }).sort((first, second) => first.slot_number - second.slot_number)
    try { await onSave(lineup, published) } catch { setError('No se ha podido guardar la alineación.'); setSaving(false) }
  }

  return <Modal className="lineup-dialog" disabled={saving} labelledBy={titleId} onClose={onClose}>
    <div className="task-detail-heading"><div><span className="eyebrow">{editable ? 'GESTIONAR ALINEACIÓN' : 'CONVOCATORIA'}</span><h2 id={titleId}>Partido contra {match.opponent}</h2><p>{matchTypeLabel(match)} · {Object.keys(slots).length}/{limit} jugadoras</p></div><button aria-label="Cerrar" className="icon-button" onClick={onClose}>×</button></div>
    {editable ? <div className="lineup-board">
      <section className="available-player-pool"><h3>Disponibles</h3><p>Arrastra una jugadora a un dorsal o pulsa Añadir.</p><div>{selectable.map((player) => <article draggable key={player.id} onDragStart={(event) => event.dataTransfer.setData('text/player-id', player.id)}><Avatar name={player.display_name} /><strong>{player.display_name}</strong><button className="secondary-button compact" onClick={() => { const empty = Array.from({ length: limit }, (_, index) => index + 1).find((slot) => !slots[slot]); if (empty) assign(player.id, empty) }} type="button">Añadir</button></article>)}{!selectable.length && <span className="lineup-empty">No quedan jugadoras disponibles sin asignar.</span>}</div></section>
      <section className="numbered-lineup"><h3>Alineación</h3><div className="lineup-section-label">Titulares</div>{Array.from({ length: limit }, (_, index) => index + 1).map((slot) => {
        const playerId = slots[slot]
        const player = eligible.find((item) => item.id === playerId) ?? profiles.find((item) => item.id === playerId)
        return <div className={`lineup-slot ${player ? 'filled' : ''}`} key={slot} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, slot)}>
          {slot === starters + 1 && <span className="lineup-section-label substitutes">Suplentes</span>}
          <b>{slot}</b>{player ? <><Avatar name={player.display_name} /><strong>{player.display_name}</strong><select aria-label={`Dorsal de ${player.display_name}`} onChange={(event) => assign(player.id, Number(event.target.value))} value={slot}>{Array.from({ length: limit }, (_, option) => <option key={option + 1} value={option + 1}>{option + 1}</option>)}</select><button aria-label={`Quitar a ${player.display_name}`} className="icon-button" onClick={() => setSlots((current) => { const next = { ...current }; delete next[slot]; return next })} type="button">×</button></> : <span>Suelta aquí</span>}
        </div>
      })}</section>
    </div> : <PublishedLineup entries={entries} profiles={profiles} starters={starters} />}
    {editable && <><label className="publish-lineup"><input checked={published} onChange={(event) => setPublished(event.target.checked)} type="checkbox" />Publicar convocatoria para las jugadoras</label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar alineación'}</button></div></>}
  </Modal>
}

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
