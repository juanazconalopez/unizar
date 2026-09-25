import { activeMembershipFor } from '../../lib/selectors'
import { archiveManagedProfile, updateManagedProfile, updateOwnProfileDetails, updateProfilePermissions } from '../../services/profilesService'
import { loadProfilePhotoUrl } from '../../services/profilePhotoService'
import { createSeason, deleteSeason, updateSeason } from '../../services/seasonsService'
import { saveTrainingAttendance } from '../../services/trainingAttendanceService'
import { linkProvisionalPlayers } from '../../services/provisionalPlayersService'
import { setSeasonMembership } from '../../services/trainingMembershipService'
import type { ManagedProfileValues, Profile, ProfileDetailsValues, ProfilePhotoChange, ProvisionalAttendanceEntry, ProvisionalPlayer, Season, SeasonCompetition, SeasonPlayer, SeasonValues } from '../../types'
import type { ActionContext } from './actionContext'
import { resetRolePermissions, saveRolePermissions } from '../../services/permissionsService'
import type { ConfigurableRole, PermissionKey } from '../../lib/permissions'
import { createSeasonCompetition, deleteSeasonCompetition, setDefaultSeasonCompetition, updateSeasonCompetition } from '../../services/seasonCompetitionsService'
import type { SeasonCompetitionValues } from '../../services/seasonCompetitionsService'
import { assignSeasonPlayerTeam, createSeasonTeam, deleteSeasonTeam, setSeasonTeamCoach, updateSeasonTeam } from '../../services/seasonTeamsService'
import type { SeasonTeam } from '../../types'
import type { SeasonTeamValues } from '../../services/seasonTeamsService'
import { deletePlayerAbsence, savePlayerAbsence } from '../../services/playerAbsencesService'
import type { PlayerAbsenceValues } from '../../services/playerAbsencesService'

export function createClubActions(context: ActionContext, memberships: SeasonPlayer[]) {
  return {
    createSeason: async (values: SeasonValues) => {
      context.requireConnection()
      if (!context.userId) return
      await createSeason(values, context.userId)
      context.notify('Temporada creada.')
      await context.reloadData()
    },
    updateSeason: async (season: Season, values: SeasonValues) => {
      context.requireConnection()
      await updateSeason(season.id, values)
      context.notify('Temporada actualizada.')
      await context.reloadData()
    },
    deleteSeason: async (season: Season) => {
      context.requireConnection()
      await deleteSeason(season.id)
      context.notify('Temporada y todos sus datos asociados eliminados.')
      await context.reloadData()
    },
    createSeasonCompetition: async (season: Season, values: SeasonCompetitionValues) => {
      context.requireConnection()
      await createSeasonCompetition(season.id, values)
      context.notify('Competición creada.')
      await context.reloadData()
    },
    updateSeasonCompetition: async (competition: SeasonCompetition, values: SeasonCompetitionValues) => {
      context.requireConnection()
      await updateSeasonCompetition(competition.id, values)
      context.notify('Competición actualizada.')
      await context.reloadData()
    },
    setDefaultSeasonCompetition: async (competition: SeasonCompetition) => {
      context.requireConnection()
      await setDefaultSeasonCompetition(competition.id)
      context.notify(`${competition.name} es ahora la competición predeterminada.`)
      await context.reloadData()
    },
    deleteSeasonCompetition: async (competition: SeasonCompetition) => {
      context.requireConnection()
      const deletedMatches = await deleteSeasonCompetition(competition.id)
      context.notify(`Competición eliminada${deletedMatches ? ` junto con ${deletedMatches} ${deletedMatches === 1 ? 'partido' : 'partidos'}` : ''}.`)
      await context.reloadData()
    },
    createSeasonTeam: async (season: Season, values: Pick<SeasonTeamValues, 'name' | 'isMixed'>) => {
      context.requireConnection()
      await createSeasonTeam(season.id, values)
      context.notify('Equipo creado.')
      await context.reloadData()
    },
    updateSeasonTeam: async (team: SeasonTeam, values: SeasonTeamValues) => {
      context.requireConnection()
      await updateSeasonTeam(team, values)
      context.notify('Equipo actualizado.')
      await context.reloadData()
    },
    deleteSeasonTeam: async (team: SeasonTeam) => {
      context.requireConnection()
      await deleteSeasonTeam(team.id)
      context.notify('Equipo eliminado.')
      await context.reloadData()
    },
    assignSeasonPlayerTeam: async (season: Season, player: Profile, teamId: string) => {
      context.requireConnection()
      await assignSeasonPlayerTeam(season.id, player.id, teamId)
      context.notify(`${player.display_name} ha cambiado de equipo.`)
      await context.reloadData()
    },
    setSeasonTeamCoach: async (team: SeasonTeam, coach: Profile, assigned: boolean) => {
      context.requireConnection()
      await setSeasonTeamCoach(team.id, coach.id, assigned)
      context.notify(`${coach.display_name} ${assigned ? 'gestionará' : 'ya no gestionará'} ${team.name}.`)
      await context.reloadData()
    },
    savePlayerAbsence: async (player: Profile, values: PlayerAbsenceValues, absenceId?: string) => {
      context.requireConnection()
      await savePlayerAbsence(player.id, values, absenceId ?? null)
      context.notify('Baja guardada.')
      await context.reloadData()
    },
    deletePlayerAbsence: async (absenceId: string) => {
      context.requireConnection()
      await deletePlayerAbsence(absenceId)
      context.notify('Baja eliminada.')
      await context.reloadData()
    },
    updateProfile: async (profile: Profile) => {
      try {
        context.requireConnection()
        await updateProfilePermissions(profile)
        context.notify(`Permisos de ${profile.display_name} actualizados.`)
        await context.reloadData()
      } catch (error) {
        context.reportError(error)
      }
    },
    updateOwnProfileDetails: async (profile: Profile, values: ProfileDetailsValues, photoChange?: ProfilePhotoChange) => {
      context.requireConnection()
      await updateOwnProfileDetails(profile, values, photoChange)
      context.notify('Datos de perfil actualizados.')
      await context.reloadData()
    },
    updateManagedProfile: async (profile: Profile, values: ManagedProfileValues, photoChange?: ProfilePhotoChange) => {
      context.requireConnection()
      await updateManagedProfile(profile, values, photoChange)
      context.notify(`Datos de ${values.displayName} actualizados.`)
      await context.reloadData()
    },
    archiveProfile: async (profile: Profile) => {
      context.requireConnection()
      await archiveManagedProfile(profile.id)
      context.notify(`${profile.display_name} ha sido desautorizada.`)
      await context.reloadData()
    },
    loadProfilePhoto: loadProfilePhotoUrl,
    saveAttendance: async (date: string, playerIds: string[], attendedPlayerIds: string[], guests: ProvisionalAttendanceEntry[]) => {
      context.requireConnection()
      await saveTrainingAttendance(date, playerIds, attendedPlayerIds, guests)
      context.notify('Asistencia guardada correctamente.')
      await context.reloadData()
    },
    linkProvisionalPlayers: async (guests: ProvisionalPlayer[], profile: Profile) => {
      context.requireConnection()
      await linkProvisionalPlayers(guests.map((guest) => guest.id), profile.id)
      context.notify(`${guests.length === 1 ? 'La invitada seleccionada se ha vinculado' : `${guests.length} invitadas se han vinculado`} con ${profile.display_name}.`)
      await context.reloadData()
    },
    toggleMembership: async (season: Season, player: Profile, active: boolean) => {
      try {
        context.requireConnection()
        const existing = activeMembershipFor(memberships, season.id, player.id)
        await setSeasonMembership(season, player, active, existing)
        context.notify(`${player.display_name} ${active ? 'forma parte de' : 'ha salido de'} ${season.name}.`)
        await context.reloadData()
      } catch (error) {
        context.reportError(error)
      }
    },
    saveRolePermissions: async (role: ConfigurableRole, permissions: PermissionKey[]) => {
      context.requireConnection()
      await saveRolePermissions(role, permissions)
      context.notify('Permisos actualizados.')
      await context.reloadData()
    },
    resetRolePermissions: async (role: ConfigurableRole) => {
      context.requireConnection()
      await resetRolePermissions(role)
      context.notify('Permisos predeterminados restaurados.')
      await context.reloadData()
    },
  }
}

export type ClubActions = ReturnType<typeof createClubActions>
