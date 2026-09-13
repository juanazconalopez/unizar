import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, seasonState, todayIso } from '../../lib/dates'
import { downloadText } from '../../lib/fileExport'
import { activeMembershipFor, isActivePlayer } from '../../lib/selectors'
import { activePlayersXml, currentSeasonPlayers } from '../../lib/seasonExports'
import { isPlayer } from '../../lib/permissions'
import type { Profile, ProfilePrivateDetails, Season, SeasonCompetition, SeasonPlayer, SeasonValues } from '../../types'
import type { SeasonCompetitionValues } from '../../services/seasonCompetitionsService'
import { SeasonForm } from './SeasonForm'
import { SeasonHolidayDialog } from './SeasonHolidayDialog'
import { SeasonCompetitionsDialog } from './SeasonCompetitionsDialog'
import { fetchSeasonHolidays, saveSeasonHolidays } from '../../services/seasonHolidaysService'

export function SeasonsView({ embedded = false, hideEmbeddedTitle = false, seasons, competitions = [], profiles, profilePrivateDetails = [], memberships, holidays: providedHolidays, onCreate, onDelete, onUpdate, onToggleMembership, onSaveHolidays, onCreateCompetition, onDeleteCompetition, onSetDefaultCompetition, onUpdateCompetition }: {
  embedded?: boolean
  hideEmbeddedTitle?: boolean
  seasons: Season[]
  competitions?: SeasonCompetition[]
  profiles: Profile[]
  profilePrivateDetails?: ProfilePrivateDetails[]
  memberships: SeasonPlayer[]
  holidays?: { season_id: string; holiday_date: string }[]
  onCreate: (values: SeasonValues) => Promise<void>
  onDelete: (season: Season) => Promise<void>
  onUpdate: (season: Season, values: SeasonValues) => Promise<void>
  onToggleMembership: (season: Season, player: Profile, active: boolean) => Promise<void>
  onSaveHolidays?: (seasonId: string, dates: string[]) => Promise<void>
  onCreateCompetition?: (season: Season, values: SeasonCompetitionValues) => Promise<void>
  onDeleteCompetition?: (competition: SeasonCompetition) => Promise<void>
  onSetDefaultCompetition?: (competition: SeasonCompetition) => Promise<void>
  onUpdateCompetition?: (competition: SeasonCompetition, values: SeasonCompetitionValues) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingSeason, setEditingSeason] = useState<Season | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [holidaySeason, setHolidaySeason] = useState<Season | null>(null)
  const [competitionSeason, setCompetitionSeason] = useState<Season | null>(null)
  const [loadedHolidays, setLoadedHolidays] = useState<{ season_id: string; holiday_date: string }[]>([])
  const holidays = providedHolidays ?? loadedHolidays
  useEffect(() => { if (!providedHolidays) void fetchSeasonHolidays(seasons.map((season) => season.id)).then(setLoadedHolidays).catch(() => undefined) }, [providedHolidays, seasons])

  return <div className={embedded ? 'settings-section' : 'page'}>
      {embedded ? <div className={`settings-section-heading${hideEmbeddedTitle ? ' compact' : ''}`}><div>{!hideEmbeddedTitle && <><span className="eyebrow">ORGANIZACIÓN</span><h2>Temporadas</h2></>}<p>Gestiona periodos y participantes del equipo.</p></div><button className="primary-button" onClick={() => { setEditingSeason(null); setShowForm(true) }}><Icon name="plus" size={18} />Nueva temporada</button></div> : <PageHeader
        eyebrow="ORGANIZACIÓN"
        title="Temporadas"
        subtitle="Gestiona periodos y participantes del equipo."
        action={<button className="primary-button" onClick={() => { setEditingSeason(null); setShowForm(true) }}><Icon name="plus" size={18} />Nueva temporada</button>}
      />}
      {(showForm || editingSeason) && (
        <SeasonForm
          season={editingSeason ?? undefined}
          onCancel={() => { setShowForm(false); setEditingSeason(null) }}
          onDelete={editingSeason ? async (season) => {
            const memberCount = new Set(memberships
              .filter((item) => item.season_id === season.id)
              .map((item) => item.player_id)).size
            const confirmed = window.confirm(
              `¿Eliminar “${season.name}”?\n\nSe eliminarán en cascada sus ${memberCount} inscripciones, competiciones, tareas y respuestas, entrenamientos de campo y asistencias, y partidos con sus disponibilidades y alineaciones. Esta acción no se puede deshacer.`,
            )
            if (!confirmed) return false
            await onDelete(season)
            setEditingSeason(null)
            return true
          } : undefined}
          onSubmit={async (values) => {
            if (editingSeason) await onUpdate(editingSeason, values)
            else await onCreate(values)
            setShowForm(false)
            setEditingSeason(null)
          }}
        />
      )}
      <div className="season-grid">
        {seasons.map((season) => (
          <SeasonCard
            expanded={expanded === season.id}
            key={season.id}
            memberships={memberships}
            profiles={profiles}
            profilePrivateDetails={profilePrivateDetails}
            season={season}
            holidayCount={holidays.filter((holiday) => holiday.season_id === season.id).length}
            competitionCount={competitions.filter((competition) => competition.season_id === season.id).length}
            onCompetitions={() => setCompetitionSeason(season)}
            onEdit={() => { setShowForm(false); setEditingSeason(season) }}
            onHolidays={() => setHolidaySeason(season)}
            onToggle={() => setExpanded(expanded === season.id ? null : season.id)}
            onToggleMembership={onToggleMembership}
          />
        ))}
        {!seasons.length && <EmptyState title="Sin temporadas" text="Crea la primera temporada para comenzar a planificar entrenamientos." />}
      </div>
      {holidaySeason && <SeasonHolidayDialog holidays={holidays.filter((holiday) => holiday.season_id === holidaySeason.id).map((holiday) => holiday.holiday_date)} onClose={() => setHolidaySeason(null)} onSave={async (dates) => { await (onSaveHolidays ?? saveSeasonHolidays)(holidaySeason.id, dates); if (!providedHolidays) setLoadedHolidays((current) => [...current.filter((holiday) => holiday.season_id !== holidaySeason.id), ...dates.map((holiday_date) => ({ season_id: holidaySeason.id, holiday_date }))]) }} season={holidaySeason} />}
      {competitionSeason && onCreateCompetition && onDeleteCompetition && onSetDefaultCompetition && onUpdateCompetition && <SeasonCompetitionsDialog competitions={competitions} season={competitionSeason} onClose={() => setCompetitionSeason(null)} onCreate={onCreateCompetition} onDelete={onDeleteCompetition} onSetDefault={onSetDefaultCompetition} onUpdate={onUpdateCompetition} />}
    </div>
}

function SeasonCard({ season, profiles, profilePrivateDetails, memberships, holidayCount, competitionCount, expanded, onEdit, onHolidays, onCompetitions, onToggle, onToggleMembership }: {
  season: Season
  profiles: Profile[]
  profilePrivateDetails: ProfilePrivateDetails[]
  memberships: SeasonPlayer[]
  holidayCount: number
  competitionCount: number
  expanded: boolean
  onEdit: () => void
  onHolidays: () => void
  onCompetitions: () => void
  onToggle: () => void
  onToggleMembership: (season: Season, player: Profile, active: boolean) => Promise<void>
}) {
  const state = seasonState(season)
  const today = todayIso()
  const seasonMemberships = memberships.filter((item) => item.season_id === season.id)
  const playerIds = new Set(profiles.filter(isPlayer).map((profile) => profile.id))
  const activeMembers = seasonMemberships.filter((item) => !item.active_until && playerIds.has(item.player_id))
  const exportPlayers = state === 'Activa' ? currentSeasonPlayers(profiles, memberships, season, today) : []

  return (
    <article className="season-card">
      <div className="season-card-top"><span className={`season-state ${state.toLowerCase()}`}>{state}</span><span>{activeMembers.length} participantes</span></div>
      <h3>{season.name}</h3>
      <p>{formatDate(season.start_date, { day: 'numeric', month: 'long', year: 'numeric' })} — {formatDate(season.end_date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div className="season-card-actions">
        <button className="secondary-button" onClick={onToggle}><Icon name="users" size={17} />Gestionar participantes</button>
        <button className="secondary-button" onClick={onCompetitions}><Icon name="trophy" size={17} />Competiciones{competitionCount ? ` (${competitionCount})` : ''}</button>
        <button className="secondary-button" onClick={onHolidays}>Festivos{holidayCount ? ` (${holidayCount})` : ''}</button>
        <button className="secondary-button" onClick={onEdit}>Editar</button>
      </div>
      {state === 'Activa' && <button
        className="secondary-button season-card-export"
        disabled={!exportPlayers.length}
        onClick={() => downloadText(`jugadoras-activas-${season.name}.xml`, activePlayersXml(season, exportPlayers, today, profilePrivateDetails), 'application/xml')}
        type="button"
      ><Icon name="download" size={17} />Exportar jugadoras activas XML</button>}
      {expanded && (
        <div className="member-list">
          {profiles.filter((player) => player.is_approved && !player.is_archived && isPlayer(player)).map((player) => {
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
