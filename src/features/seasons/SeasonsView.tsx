import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, seasonState } from '../../lib/dates'
import type { Profile, Season, SeasonPlayer, SeasonValues } from '../../types'
import { SeasonForm } from './SeasonForm'

export function SeasonsView({ seasons, profiles, memberships, onCreate, onToggleMembership }: {
  seasons: Season[]
  profiles: Profile[]
  memberships: SeasonPlayer[]
  onCreate: (values: SeasonValues) => Promise<void>
  onToggleMembership: (season: Season, player: Profile, active: boolean) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="page">
      <PageHeader
        eyebrow="ORGANIZACIÓN"
        title="Temporadas"
        subtitle="Gestiona periodos y participantes del equipo."
        action={<button className="primary-button" onClick={() => setShowForm(true)}><Icon name="plus" size={18} />Nueva temporada</button>}
      />
      {showForm && (
        <SeasonForm
          onCancel={() => setShowForm(false)}
          onCreate={async (values) => { await onCreate(values); setShowForm(false) }}
        />
      )}
      <div className="season-grid">
        {seasons.map((season) => (
          <SeasonCard
            expanded={expanded === season.id}
            key={season.id}
            memberships={memberships}
            profiles={profiles}
            season={season}
            onToggle={() => setExpanded(expanded === season.id ? null : season.id)}
            onToggleMembership={onToggleMembership}
          />
        ))}
        {!seasons.length && <EmptyState title="Sin temporadas" text="Crea la primera temporada para comenzar a planificar entrenamientos." />}
      </div>
    </div>
  )
}

function SeasonCard({ season, profiles, memberships, expanded, onToggle, onToggleMembership }: {
  season: Season
  profiles: Profile[]
  memberships: SeasonPlayer[]
  expanded: boolean
  onToggle: () => void
  onToggleMembership: (season: Season, player: Profile, active: boolean) => Promise<void>
}) {
  const state = seasonState(season)
  const seasonMemberships = memberships.filter((item) => item.season_id === season.id)
  const activeMembers = seasonMemberships.filter((item) => !item.active_until)

  return (
    <article className="season-card">
      <div className="season-card-top"><span className={`season-state ${state.toLowerCase()}`}>{state}</span><span>{activeMembers.length} participantes</span></div>
      <h3>{season.name}</h3>
      <p>{formatDate(season.start_date, { day: 'numeric', month: 'long', year: 'numeric' })} — {formatDate(season.end_date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <button className="secondary-button full-button" onClick={onToggle}><Icon name="users" size={17} />Gestionar participantes</button>
      {expanded && (
        <div className="member-list">
          {profiles.filter((player) => player.is_approved && !player.is_archived).map((player) => {
            const membership = seasonMemberships.find((item) => item.player_id === player.id)
            const active = Boolean(membership && !membership.active_until)
            return (
              <label key={player.id}>
                <span><Avatar name={player.display_name} /><span><strong>{player.display_name}</strong><small>{player.is_active ? 'Jugador activo' : 'Jugador inactivo'}</small></span></span>
                <input checked={active} disabled={!player.is_active} onChange={(event) => void onToggleMembership(season, player, event.target.checked)} type="checkbox" />
              </label>
            )
          })}
        </div>
      )}
    </article>
  )
}
