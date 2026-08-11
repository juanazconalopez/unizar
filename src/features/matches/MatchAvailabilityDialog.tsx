import { useId } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import type { AvailabilityStatus, Match, MatchAvailability, Profile } from '../../types'

const groups: { status: AvailabilityStatus | 'unanswered'; title: string; empty: string }[] = [
  { status: 'available', title: 'Disponibles', empty: 'Ninguna jugadora disponible.' },
  { status: 'doubt', title: 'En duda', empty: 'Ninguna jugadora en duda.' },
  { status: 'unavailable', title: 'No disponibles', empty: 'Ninguna jugadora ha rechazado.' },
  { status: 'unanswered', title: 'Sin responder', empty: 'Todas las jugadoras han respondido.' },
]

export function MatchAvailabilityDialog({ availability, eligibleProfiles, match, profiles, onClose }: {
  availability: MatchAvailability[]
  eligibleProfiles: Profile[]
  match: Match
  profiles: Profile[]
  onClose: () => void
}) {
  const titleId = useId()
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  const respondedIds = new Set(availability.map((item) => item.player_id))

  return <Modal className="availability-details-dialog" labelledBy={titleId} onClose={onClose}>
    <div className="task-detail-heading"><div><span className="eyebrow">DISPONIBILIDAD DEL EQUIPO</span><h2 id={titleId}>Partido contra {match.opponent}</h2><p>{availability.length} {availability.length === 1 ? 'respuesta recibida' : 'respuestas recibidas'}</p></div><button aria-label="Cerrar" className="icon-button" onClick={onClose}>×</button></div>
    <div className="availability-groups">{groups.map((group) => {
      const responses = group.status === 'unanswered'
        ? eligibleProfiles.filter((profile) => !respondedIds.has(profile.id)).map((profile) => ({ player_id: profile.id, comment: null }))
        : availability.filter((item) => item.status === group.status)
      return <section className={`availability-group ${group.status}`} key={group.status}>
        <h3><span>{group.title}</span><b>{responses.length}</b></h3>
        <div>{responses.length ? responses.map((response) => {
          const profile = profilesById.get(response.player_id)
          const name = profile?.display_name ?? 'Jugadora no disponible'
          return <article key={response.player_id}><Avatar name={name} /><div><strong>{name}</strong>{response.comment && <p>{response.comment}</p>}</div></article>
        }) : <p className="availability-empty">{group.empty}</p>}</div>
      </section>
    })}</div>
  </Modal>
}
