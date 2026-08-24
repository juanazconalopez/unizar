import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import type { AvailabilityStatus, Match, MatchAvailability, Profile } from '../../types'

const groups: { status: AvailabilityStatus | 'unanswered'; title: string; empty: string }[] = [
  { status: 'available', title: 'Disponibles', empty: 'Ninguna jugadora disponible.' },
  { status: 'doubt', title: 'En duda', empty: 'Ninguna jugadora en duda.' },
  { status: 'unavailable', title: 'No disponibles', empty: 'Ninguna jugadora ha rechazado.' },
  { status: 'unanswered', title: 'Sin responder', empty: 'Todas las jugadoras han respondido.' },
]

export function MatchAvailabilityDialog({ availability, canEdit = false, eligibleProfiles, match, profiles, onClose, onSave }: {
  availability: MatchAvailability[]
  canEdit?: boolean
  eligibleProfiles: Profile[]
  match: Match
  profiles: Profile[]
  onClose: () => void
  onSave?: (playerId: string, status: AvailabilityStatus, comment: string) => Promise<void>
}) {
  const titleId = useId()
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const editable = canEdit && !match.lineup_published
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  const respondedIds = new Set(availability.map((item) => item.player_id))

  return <Modal className="availability-details-dialog" labelledBy={titleId} onClose={onClose}>
    <div className="task-detail-heading"><div><span className="eyebrow">DISPONIBILIDAD DEL EQUIPO</span><h2 id={titleId}>Partido contra {match.opponent}</h2><p>{availability.length} {availability.length === 1 ? 'respuesta recibida' : 'respuestas recibidas'}</p></div><button aria-label="Cerrar" className="icon-button" onClick={onClose}>×</button></div>
    {canEdit && match.lineup_published && <div className="availability-locked"><strong>Edición de disponibilidad cerrada</strong><span>Desbloquea primero la convocatoria para registrar cambios comunicados por las jugadoras.</span></div>}
    <div className="availability-groups">{groups.map((group) => {
      const responses = group.status === 'unanswered'
        ? eligibleProfiles.filter((profile) => !respondedIds.has(profile.id)).map((profile) => ({ player_id: profile.id, comment: null }))
        : availability.filter((item) => item.status === group.status)
      return <section className={`availability-group ${group.status}`} key={group.status}>
        <h3><span>{group.title}</span><b>{responses.length}</b></h3>
        <div>{responses.length ? responses.map((response) => {
          const profile = profilesById.get(response.player_id)
          const name = profile?.display_name ?? 'Jugadora no disponible'
          return <article key={response.player_id}><Avatar name={name} /><div><strong>{name}</strong>{response.comment && <p>{response.comment}</p>}</div>{editable && onSave && <button className="secondary-button compact" onClick={() => setEditingPlayerId(response.player_id)} type="button">Editar</button>}</article>
        }) : <p className="availability-empty">{group.empty}</p>}</div>
      </section>
    })}</div>
    {editingPlayerId && onSave && <CoachAvailabilityDialog
      initial={availability.find((item) => item.player_id === editingPlayerId)}
      match={match}
      player={profilesById.get(editingPlayerId)}
      onClose={() => setEditingPlayerId(null)}
      onSave={async (status, comment) => {
        await onSave(editingPlayerId, status, comment)
        setEditingPlayerId(null)
      }}
    />}
  </Modal>
}

function CoachAvailabilityDialog({ initial, match, player, onClose, onSave }: {
  initial?: MatchAvailability
  match: Match
  player?: Profile
  onClose: () => void
  onSave: (status: AvailabilityStatus, comment: string) => Promise<void>
}) {
  const titleId = useId()
  const [status, setStatus] = useState<AvailabilityStatus>(initial?.status ?? 'available')
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    try { await onSave(status, comment) } catch (caught) { setError(errorText(caught)); setSaving(false) }
  }

  return <Modal className="availability-dialog" disabled={saving} labelledBy={titleId} onClose={onClose} onSubmit={submit}>
    <div className="task-detail-heading"><div><span className="eyebrow">ACTUALIZAR DISPONIBILIDAD</span><h2 id={titleId}>{player?.display_name ?? 'Jugadora'}</h2><p>Partido contra {match.opponent}</p></div><button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button">×</button></div>
    <label>Respuesta<select autoFocus onChange={(event) => setStatus(event.target.value as AvailabilityStatus)} value={status}><option value="available">Disponible</option><option value="doubt">En duda</option><option value="unavailable">No disponible</option></select></label>
    <label>Comentario opcional<textarea maxLength={500} onChange={(event) => setComment(event.target.value)} placeholder="Por ejemplo: baja comunicada por teléfono…" rows={5} value={comment} /></label>
    <small>Este cambio quedará registrado como realizado por un entrenador.</small>
    {error && <p className="form-error">{error}</p>}
    <div className="form-actions"><button className="secondary-button" onClick={onClose} type="button">Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar disponibilidad'}</button></div>
  </Modal>
}
