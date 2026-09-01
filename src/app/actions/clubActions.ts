import { activeMembershipFor } from '../../lib/selectors'
import { archiveManagedProfile, updateManagedProfile, updateOwnProfileDetails, updateProfilePermissions } from '../../services/profilesService'
import { loadProfilePhotoUrl } from '../../services/profilePhotoService'
import { createSeason, deleteSeason, updateSeason } from '../../services/seasonsService'
import { saveTrainingAttendance } from '../../services/trainingAttendanceService'
import { setSeasonMembership } from '../../services/trainingMembershipService'
import type { ManagedProfileValues, Profile, ProfileDetailsValues, ProfilePhotoChange, Season, SeasonPlayer, SeasonValues } from '../../types'
import type { ActionContext } from './actionContext'

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
    saveAttendance: async (date: string, playerIds: string[], attendedPlayerIds: string[]) => {
      context.requireConnection()
      await saveTrainingAttendance(date, playerIds, attendedPlayerIds)
      context.notify('Asistencia guardada correctamente.')
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
  }
}

export type ClubActions = ReturnType<typeof createClubActions>
