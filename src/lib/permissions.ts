import type { Profile } from '../types'

export function isPlayer(profile: Profile) {
  return profile.is_player
}

export function canAccessTasks(profile: Profile) {
  return isPlayer(profile) || canManageSport(profile)
}

export function canManageSport(profile: Profile) {
  return profile.is_owner || profile.is_coach
}

export function canViewTeamData(profile: Profile) {
  return profile.is_owner || profile.is_coach || profile.is_viewer
}

export function canConfigureClub(profile: Profile) {
  return profile.is_owner
}
