import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, seasonState } from '../../lib/dates'
import { activeMembershipFor, isActivePlayer } from '../../lib/selectors'
import type { Profile, Season, SeasonPlayer, SeasonValues } from '../../types'
import { SeasonForm } from './SeasonForm'

export function SeasonsView({ embedded = false, seasons, profiles, memberships, onCreate, onToggleMembership }: {
  embedded?: boolean
  seasons: Season[]
  profiles: Profile[]
  memberships: SeasonPlayer[]
  onCreate: (values: SeasonValues) => Promise<void>
  onToggleMembership: (season: Season, player: Profile, active: boolean) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className={embedded ? 'settings-section' : 'page'}>
      {embedded ? <div className="settings-section-heading"><div><span className="eyebrow">ORGANIZACIÓN</span><h2>Temporadas</h2><p>Gestiona periodos y participantes del equipo.</p></div><button className="primary-button" onClick={() => setShowForm(true)}><Icon name="plus" size={18} />Nueva temporada</button></div> : <PageHeader
        eyebrow="ORGANIZACIÓN"
        title="Temporadas"
        subtitle="Gestiona periodos y participantes del equipo."
        action={<button className="primary-button" onClick={() => setShowForm(true)}><Icon name="plus" size={18} />Nueva temporada</button>}
      />}
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
          {profiles.filter((player) => player.is_approved && !player.is_archived && !player.is_owner).map((player) => {
            const membership = activeMembershipFor(seasonMemberships, season.id, player.id)
            const active = Boolean(membership)
            return (
              <label key={player.id}>
                <span><Avatar name={player.display_name} /><span><strong>{player.display_name}</strong><small>{player.is_active ? 'Jugador activo' : 'Jugador inactivo'}</small></span></span>
                <input checked={active} disabled={!isActivePlayer(player)} onChange={(event) => void onToggleMembership(season, player, event.target.checked)} type="checkbox" />
              </label>
            )
          })}
        </div>
      )}
    </article>
  )
}
