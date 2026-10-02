import { useState } from 'react'
import type { FormEvent } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import { Icon } from '../../components/Icon'
import { todayIso } from '../../lib/dates'
import { getCurrentPlayerAbsence } from '../team/playerAbsenceStatus'
import { displayNameContains } from '../../lib/displayNames'
import { errorText } from '../../lib/errors'
import { licenseAllowsTeam, licenseLabel, membershipLicense } from '../../lib/playerLicenses'
import { activeMembershipFor, membershipCoversDate } from '../../lib/selectors'
import { canBeSeasonTeamCoach, isPlayer } from '../../lib/permissions'
import type { PlayerAbsence, Profile, Season, SeasonPlayer, SeasonTeam, SeasonTeamCoach } from '../../types'
import type { SeasonTeamCoachChange, SeasonTeamValues } from '../../services/seasonTeamsService'
import { seasonTeamCoachRoleLabel, seasonTeamCoachRoles, type SeasonTeamCoachRole } from './seasonTeamCoachRoles'

type Panel =
  | { kind: 'list' }
  | { kind: 'team'; team: SeasonTeam | null }
  | { kind: 'move'; player: Profile }
  | { kind: 'coaches'; team: SeasonTeam }

export function SeasonTeamsDialog({ season, teams, memberships, profiles, coaches, playerAbsences = [], onClose, onCreate, onDelete, onSave, onAssignPlayer, onAssignCoach }: {
  season: Season
  teams: SeasonTeam[]
  memberships: SeasonPlayer[]
  profiles: Profile[]
  playerAbsences?: PlayerAbsence[]
  coaches: SeasonTeamCoach[]
  onClose: () => void
  onCreate: (values: Pick<SeasonTeamValues, 'name' | 'isMixed'>) => Promise<void>
  onDelete: (team: SeasonTeam) => Promise<void>
  onSave: (team: SeasonTeam, values: SeasonTeamValues) => Promise<void>
  onAssignPlayer: (player: Profile, teamId: string) => Promise<void>
  onAssignCoach: (team: SeasonTeam, changes: SeasonTeamCoachChange[]) => Promise<void>
}) {
  const [panel, setPanel] = useState<Panel>({ kind: 'list' })
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [coachDrafts, setCoachDrafts] = useState<Record<string, { assigned: boolean; role: SeasonTeamCoachRole }>>({})
  const seasonTeams = teams.filter((team) => team.season_id === season.id)
  const activePlayers = profiles
    .filter((profile) => profile.is_approved && profile.is_active && !profile.is_archived && isPlayer(profile) && activeMembershipFor(memberships, season.id, profile.id))
    .sort((first, second) => first.display_name.localeCompare(second.display_name, 'es'))
  const today = todayIso()
  const currentAbsencePlayerIds = new Set((season.start_date <= today && season.end_date >= today ? activePlayers : [])
    .filter((player) => membershipCoversDate(activeMembershipFor(memberships, season.id, player.id)!, today)
      && getCurrentPlayerAbsence(playerAbsences, player.id, today))
    .map((player) => player.id))
  const absenceCount = (players: Profile[]) => players.filter((player) => currentAbsencePlayerIds.has(player.id)).length
  const activeCoaches = profiles
    .filter(canBeSeasonTeamCoach)
    .sort((first, second) => first.display_name.localeCompare(second.display_name, 'es'))
  const memberTeam = (playerId: string) => activeMembershipFor(memberships, season.id, playerId)?.season_team_id ?? ''
  const playersForTeam = (teamId: string) => activePlayers.filter((player) => memberTeam(player.id) === teamId)
  const unassignedPlayers = activePlayers.filter((player) => !seasonTeams.some((team) => team.id === memberTeam(player.id)))
  const matchesSearch = (player: Profile) => displayNameContains(player.display_name, search)
  const visibleUnassignedPlayers = unassignedPlayers.filter(matchesSearch)
  const searchHasMatches = activePlayers.some(matchesSearch)
  const coachAssignment = (teamId: string, coachId: string) => coaches.find((assignment) => assignment.season_team_id === teamId && assignment.coach_id === coachId)
  const coachRoleKey = (teamId: string, coachId: string) => `${teamId}:${coachId}`
  const persistedTeamHasHeadCoach = (teamId: string) => coaches.some((assignment) => assignment.season_team_id === teamId && assignment.role === 'head_coach')
  const coachDraft = (teamId: string, coachId: string) => {
    const assignment = coachAssignment(teamId, coachId)
    return coachDrafts[coachRoleKey(teamId, coachId)] ?? {
      assigned: Boolean(assignment),
      role: (assignment?.role as SeasonTeamCoachRole | undefined) ?? (persistedTeamHasHeadCoach(teamId) ? 'assistant_coach' : 'head_coach'),
    }
  }
  const teamHasHeadCoach = (teamId: string) => panel.kind === 'coaches' && panel.team.id === teamId
    ? activeCoaches.some((coach) => coachDraft(teamId, coach.id).assigned && coachDraft(teamId, coach.id).role === 'head_coach')
    : persistedTeamHasHeadCoach(teamId)
  const assignedCoaches = (teamId: string) => activeCoaches.flatMap((coach) => {
    const assignment = coachAssignment(teamId, coach.id)
    return assignment ? [{ coach, role: assignment.role }] : []
  }).sort((first, second) => seasonTeamCoachRoles.findIndex(({ value }) => value === first.role) - seasonTeamCoachRoles.findIndex(({ value }) => value === second.role))
  const coachChangesForTeam = (teamId: string) => activeCoaches.flatMap((coach) => {
    const assignment = coachAssignment(teamId, coach.id)
    const draft = coachDraft(teamId, coach.id)
    if (Boolean(assignment) === draft.assigned && (!draft.assigned || assignment?.role === draft.role)) return []
    return [{ coachId: coach.id, assigned: draft.assigned, role: draft.role }]
  })

  function showPanel(nextPanel: Panel) {
    setError('')
    if (nextPanel.kind === 'coaches') {
      const hasHeadCoach = persistedTeamHasHeadCoach(nextPanel.team.id)
      setCoachDrafts(Object.fromEntries(activeCoaches.map((coach) => {
        const assignment = coachAssignment(nextPanel.team.id, coach.id)
        const key = coachRoleKey(nextPanel.team.id, coach.id)
        const role = (assignment?.role as SeasonTeamCoachRole | undefined) ?? (hasHeadCoach ? 'assistant_coach' : 'head_coach')
        return [key, { assigned: Boolean(assignment), role }]
      })))
    }
    setPanel(nextPanel)
  }

  async function saveTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (panel.kind !== 'team') return
    const form = new FormData(event.currentTarget)
    const values = { name: String(form.get('name')).trim(), isMixed: form.get('isMixed') === 'on', isActive: form.get('isActive') === 'on' }
    setSaving(true)
    setError('')
    try {
      if (panel.team) await onSave(panel.team, values)
      else await onCreate(values)
      setPanel({ kind: 'list' })
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setSaving(false)
    }
  }

  async function deleteTeam(team: SeasonTeam) {
    if (!window.confirm(`¿Eliminar el equipo “${team.name}”? Esta acción no se puede deshacer.`)) return
    setSaving(true)
    setError('')
    try {
      await onDelete(team)
      setPanel({ kind: 'list' })
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setSaving(false)
    }
  }

  async function movePlayer(player: Profile, team: SeasonTeam) {
    setSaving(true)
    setError('')
    try {
      await onAssignPlayer(player, team.id)
      setPanel({ kind: 'list' })
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setSaving(false)
    }
  }

  async function saveCoachAssignments(team: SeasonTeam) {
    const changes = coachChangesForTeam(team.id)
    if (!changes.length) {
      setPanel({ kind: 'list' })
      return
    }
    setSaving(true)
    setError('')
    try {
      await onAssignCoach(team, changes)
      setPanel({ kind: 'list' })
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setSaving(false)
    }
  }

  function playerRow(player: Profile) {
    return <li className="season-team-player" key={player.id}>
      <span><Avatar name={player.display_name} /><strong>{player.display_name}</strong>{currentAbsencePlayerIds.has(player.id) && <span aria-label="Baja deportiva" className="player-absence-indicator" role="img" title="Baja deportiva"><Icon name="medicalCross" size={18} /></span>}<small>{licenseLabel(membershipLicense(activeMembershipFor(memberships, season.id, player.id)!))}</small></span>
      <button aria-label={`Mover a ${player.display_name} a otro equipo`} className="secondary-button compact" disabled={!licenseAllowsTeam(membershipLicense(activeMembershipFor(memberships, season.id, player.id)!)) || saving || seasonTeams.filter((team) => team.is_active && team.id !== memberTeam(player.id)).length === 0} onClick={() => showPanel({ kind: 'move', player })} type="button">Mover a…</button>
    </li>
  }

  return <Modal className="season-teams-dialog" disabled={saving} labelledBy="season-teams-title" onClose={onClose} onSubmit={panel.kind === 'team' ? saveTeam : undefined}>
    <div className="panel-form-heading"><div><span className="eyebrow">{season.name}</span><h2 id="season-teams-title">Equipos</h2><p>Consulta la plantilla y mueve jugadoras entre equipos.</p></div><button aria-label="Cerrar equipos" className="icon-button" disabled={saving} onClick={onClose} type="button">×</button></div>
    {panel.kind === 'list' && <>
      <div className="season-team-toolbar">
        <label><Icon name="search" size={17} /><input aria-label="Buscar jugadora" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar jugadora…" spellCheck type="search" value={search} /></label>
        <button className="primary-button" disabled={saving} onClick={() => showPanel({ kind: 'team', team: null })} type="button"><Icon name="plus" size={17} />Nuevo equipo</button>
      </div>
      <div className="season-team-roster-grid">
        {seasonTeams.map((team) => {
          const teamPlayers = playersForTeam(team.id)
          const visiblePlayers = teamPlayers.filter(matchesSearch)
          const teamCoaches = assignedCoaches(team.id)
          if (search.trim() && !visiblePlayers.length) return null
          return <section aria-label={`${team.name}, ${teamPlayers.length} ${teamPlayers.length === 1 ? 'jugadora' : 'jugadoras'}`} className={`season-team-roster-card${team.is_active ? '' : ' inactive'}`} key={team.id}>
            <div className="season-team-roster-heading"><div><h3>{team.name} <span>{teamPlayers.length}</span> <AbsenceCount count={absenceCount(teamPlayers)} /></h3><small>{team.is_default ? 'Equipo inicial' : team.is_mixed ? 'Grupo mixto' : 'Equipo competitivo'} · {team.is_active ? 'Activo' : 'Inactivo'}</small></div><button aria-label={`Editar equipo ${team.name}`} className="text-button" onClick={() => showPanel({ kind: 'team', team })} type="button">Editar equipo</button></div>
            <ul className="season-team-player-list">{visiblePlayers.map(playerRow)}</ul>
            {!visiblePlayers.length && <p className="season-team-empty">Sin jugadoras en este equipo.</p>}
            <div className="season-team-coaches"><div><strong>Entrenadores</strong>{teamCoaches.length ? <span className="season-team-coach-list">{teamCoaches.map(({ coach, role }) => <span key={coach.id}>{role === 'head_coach' ? <strong className="season-team-head-coach-role">{seasonTeamCoachRoleLabel(role)}</strong> : seasonTeamCoachRoleLabel(role)} · {coach.display_name}</span>)}</span> : <span>Sin entrenadores asignados</span>}</div><button aria-label={`Editar entrenadores de ${team.name}`} className="text-button" onClick={() => showPanel({ kind: 'coaches', team })} type="button">Editar</button></div>
          </section>
        })}
        {visibleUnassignedPlayers.length > 0 && <section aria-label={`Sin equipo, ${unassignedPlayers.length} jugadoras`} className="season-team-roster-card unassigned"><div className="season-team-roster-heading"><div><h3>Sin equipo <span>{unassignedPlayers.length}</span> <AbsenceCount count={absenceCount(unassignedPlayers)} /></h3><small>Sin ficha deportiva o pendientes de asignación</small></div></div><ul className="season-team-player-list">{visibleUnassignedPlayers.map(playerRow)}</ul></section>}
      </div>
      {!seasonTeams.length && !unassignedPlayers.length && <p className="lineup-empty">Todavía no hay equipos en esta temporada.</p>}
      {search.trim() && !searchHasMatches && <p className="lineup-empty">No hay jugadoras que coincidan con la búsqueda.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="secondary-button" onClick={onClose} type="button">Cerrar</button></div>
    </>}
    {panel.kind === 'move' && <>
      <div className="season-team-subview-heading"><span className="eyebrow">CAMBIAR DE EQUIPO</span><h3>{panel.player.display_name}</h3><p>Equipo actual: {seasonTeams.find((team) => team.id === memberTeam(panel.player.id))?.name ?? 'Sin equipo'}</p></div>
      <div className="season-team-destinations" role="group" aria-label="Equipo de destino">
        {seasonTeams.filter((team) => team.is_active && team.id !== memberTeam(panel.player.id)).map((team) => <button className="season-team-destination" disabled={saving} key={team.id} onClick={() => void movePlayer(panel.player, team)} type="button"><span><strong>{team.name}</strong><small>{team.is_mixed ? 'Grupo mixto' : team.is_default ? 'Equipo inicial' : 'Equipo competitivo'}</small></span><Icon name="arrow" size={18} /></button>)}
      </div>
      {seasonTeams.filter((team) => team.is_active && team.id !== memberTeam(panel.player.id)).length === 0 && <p className="lineup-empty">No hay otro equipo activo al que moverla.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={() => showPanel({ kind: 'list' })} type="button">Volver a equipos</button></div>
    </>}
    {panel.kind === 'coaches' && <>
      <div className="season-team-subview-heading"><span className="eyebrow">ENTRENADORES</span><h3>{panel.team.name}</h3><p>Selecciona los entrenadores que gestionan este equipo.</p></div>
      <div className="season-team-coach-options">{activeCoaches.map((coach) => {
        const draft = coachDraft(panel.team.id, coach.id)
        const headCoachAssigned = teamHasHeadCoach(panel.team.id)
        const key = coachRoleKey(panel.team.id, coach.id)
        return <div className="season-team-coach-option" key={coach.id}>
          <label><input checked={draft.assigned} disabled={saving} onChange={(event) => {
            const assigned = event.target.checked
            setCoachDrafts((current) => {
              const anotherHeadCoach = activeCoaches.some((candidate) => candidate.id !== coach.id && current[coachRoleKey(panel.team.id, candidate.id)]?.assigned && current[coachRoleKey(panel.team.id, candidate.id)]?.role === 'head_coach')
              const role = assigned ? anotherHeadCoach
                ? draft.role === 'head_coach' ? 'assistant_coach' : draft.role
                : 'head_coach'
                : draft.role
              return { ...current, [key]: { assigned, role } }
            })
          }} type="checkbox" /><span>{coach.display_name}</span></label>
          <select aria-label={`Rol de ${coach.display_name}`} disabled={saving} onChange={(event) => setCoachDrafts((current) => ({ ...current, [key]: { ...draft, role: event.target.value as SeasonTeamCoachRole } }))} value={draft.role}>
            {seasonTeamCoachRoles.map(({ value, label }) => <option disabled={value === 'head_coach' && headCoachAssigned && !(draft.assigned && draft.role === 'head_coach')} key={value} value={value}>{label}</option>)}
          </select>
        </div>
      })}{!activeCoaches.length && <p className="lineup-empty">No hay entrenadores activos.</p>}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={() => setPanel({ kind: 'list' })} type="button">Cancelar</button><button className="primary-button" disabled={saving || !coachChangesForTeam(panel.team.id).length} onClick={() => void saveCoachAssignments(panel.team)} type="button">{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
    </>}
    {panel.kind === 'team' && <>
      <div className="season-team-subview-heading"><span className="eyebrow">{panel.team ? 'EDITAR EQUIPO' : 'NUEVO EQUIPO'}</span><h3>{panel.team?.name ?? 'Datos del equipo'}</h3></div>
      <div className="season-team-fields"><label>Nombre<input autoFocus defaultValue={panel.team?.name ?? ''} maxLength={80} name="name" required spellCheck /></label><label className="check-field"><input defaultChecked={panel.team?.is_mixed ?? false} name="isMixed" type="checkbox" />Grupo mixto</label>{panel.team && <label className="check-field"><input defaultChecked={panel.team.is_active} name="isActive" type="checkbox" />Equipo activo</label>}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={() => showPanel({ kind: 'list' })} type="button">Volver a equipos</button>{panel.team && !panel.team.is_default && <button className="danger-button" disabled={saving} onClick={() => void deleteTeam(panel.team!)} type="button">Eliminar equipo</button>}<button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar equipo'}</button></div>
    </>}
  </Modal>
}

function AbsenceCount({ count }: { count: number }) {
  return <span aria-label={`${count} ${count === 1 ? 'jugadora' : 'jugadoras'} de baja deportiva hoy`} className="season-team-absence-count" title="Jugadoras de baja deportiva hoy"><Icon name="medicalCross" size={14} />{count}</span>
}
