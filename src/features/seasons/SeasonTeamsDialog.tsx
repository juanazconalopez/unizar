import { useState } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import { activeMembershipFor } from '../../lib/selectors'
import { isPlayer } from '../../lib/permissions'
import type { Profile, Season, SeasonPlayer, SeasonTeam, SeasonTeamCoach } from '../../types'
import type { SeasonTeamValues } from '../../services/seasonTeamsService'

export function SeasonTeamsDialog({ season, teams, memberships, profiles, coaches, onClose, onCreate, onDelete, onSave, onAssignPlayer, onAssignCoach }: {
  season: Season
  teams: SeasonTeam[]
  memberships: SeasonPlayer[]
  profiles: Profile[]
  coaches: SeasonTeamCoach[]
  onClose: () => void
  onCreate: (values: Pick<SeasonTeamValues, 'name' | 'isMixed'>) => Promise<void>
  onDelete: (team: SeasonTeam) => Promise<void>
  onSave: (team: SeasonTeam, values: SeasonTeamValues) => Promise<void>
  onAssignPlayer: (player: Profile, teamId: string) => Promise<void>
  onAssignCoach: (team: SeasonTeam, coach: Profile, assigned: boolean) => Promise<void>
}) {
  const [editing, setEditing] = useState<SeasonTeam | null | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const seasonTeams = teams.filter((team) => team.season_id === season.id)
  const activePlayers = profiles.filter((profile) => profile.is_approved && profile.is_active && !profile.is_archived && isPlayer(profile) && activeMembershipFor(memberships, season.id, profile.id))
  const activeCoaches = profiles.filter((profile) => profile.is_approved && profile.is_active && !profile.is_archived && profile.is_coach)
  const memberTeam = (playerId: string) => activeMembershipFor(memberships, season.id, playerId)?.season_team_id ?? ''

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = { name: String(form.get('name')).trim(), isMixed: form.get('isMixed') === 'on', isActive: form.get('isActive') === 'on' }
    setSaving(true); setError('')
    try {
      if (editing) await onSave(editing, values)
      else await onCreate(values)
      setEditing(undefined)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se ha podido guardar el equipo.') } finally { setSaving(false) }
  }

  return <Modal className="season-teams-dialog" disabled={saving} labelledBy="season-teams-title" onClose={onClose} onSubmit={editing !== undefined ? save : undefined}>
    <div className="panel-form-heading"><div><span className="eyebrow">{season.name}</span><h2 id="season-teams-title">Equipos</h2><p>La plantilla está siempre en la temporada; aquí se organiza su equipo preferente.</p></div><button aria-label="Cerrar equipos" className="icon-button" onClick={onClose} type="button">×</button></div>
    {editing === undefined ? <>
      <div className="season-team-list">{seasonTeams.map((team) => <article className="season-team-row" key={team.id}>
        <div><strong>{team.name}</strong><small>{team.is_default ? 'Equipo inicial' : team.is_mixed ? 'Grupo mixto' : 'Equipo competitivo'} · {team.is_active ? 'Activo' : 'Inactivo'}</small></div>
        <div className="season-team-row-actions"><button className="secondary-button" onClick={() => setEditing(team)} type="button">Editar</button>{!team.is_default && <button className="text-button danger" onClick={() => void onDelete(team).catch((caught) => setError(caught instanceof Error ? caught.message : 'No se ha podido borrar el equipo.'))} type="button">Eliminar</button>}</div>
      </article>)}</div>
      <h3 className="season-team-subtitle">Jugadoras</h3>
      <div className="member-list season-team-members">{activePlayers.map((player) => <label key={player.id}><span><Avatar name={player.display_name} /><strong>{player.display_name}</strong></span><select aria-label={`Equipo de ${player.display_name}`} onChange={(event) => void onAssignPlayer(player, event.target.value).catch((caught) => setError(caught instanceof Error ? caught.message : 'No se ha podido asignar la jugadora.'))} value={memberTeam(player.id)}>{seasonTeams.filter((team) => team.is_active).map((team) => <option key={team.id} value={team.id}>{team.name}{team.is_mixed ? ' · Mixto' : ''}</option>)}</select></label>)}{!activePlayers.length && <p className="lineup-empty">No hay jugadoras vinculadas a esta temporada.</p>}</div>
      <h3 className="season-team-subtitle">Entrenadores</h3>
      <div className="member-list season-team-members">{activeCoaches.flatMap((coach) => seasonTeams.filter((team) => team.is_active).map((team) => <label key={`${coach.id}:${team.id}`}><span><strong>{coach.display_name}</strong><small>{team.name}</small></span><input checked={coaches.some((assignment) => assignment.coach_id === coach.id && assignment.season_team_id === team.id)} onChange={(event) => void onAssignCoach(team, coach, event.target.checked).catch((caught) => setError(caught instanceof Error ? caught.message : 'No se ha podido asignar el entrenador.'))} type="checkbox" /></label>))}</div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions"><button className="secondary-button" onClick={onClose} type="button">Cerrar</button><button className="primary-button" onClick={() => setEditing(null)} type="button">Nuevo equipo</button></div>
    </> : <>
      <label>Nombre<input autoFocus defaultValue={editing?.name ?? ''} name="name" required /></label>
      <label className="check-field"><input defaultChecked={editing?.is_mixed ?? false} name="isMixed" type="checkbox" />Grupo mixto</label>
      {editing && <label className="check-field"><input defaultChecked={editing.is_active} name="isActive" type="checkbox" />Equipo activo</label>}
      {!editing && <p className="form-hint">Solo puede existir un grupo mixto por temporada.</p>}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions"><button className="secondary-button" onClick={() => setEditing(undefined)} type="button">Volver</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar equipo'}</button></div>
    </>}
  </Modal>
}
