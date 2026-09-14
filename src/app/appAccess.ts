import { todayIso } from '../lib/dates'
import { hasPermission, PERMISSIONS } from '../lib/permissions'
import { membershipCoversDate } from '../lib/selectors'
import type { Profile, Season, SeasonPlayer, ViewName } from '../types'

export function hasWorkingSeason(profile: Profile, seasons: Season[], memberships: SeasonPlayer[], userId: string, permissionKeys?: readonly string[]) {
  const today = todayIso()
  const activeSeasons = seasons.filter((season) => season.start_date <= today && season.end_date >= today)
  const hasTeamScope = [
    PERMISSIONS.dashboard.team, PERMISSIONS.statistics.view, PERMISSIONS.calendar.manage, PERMISSIONS.training.view,
    PERMISSIONS.attendance.view, PERMISSIONS.matches.teamAvailability, PERMISSIONS.settings.view,
  ].some((permission) => hasPermission(profile, permission, permissionKeys))
  if (hasTeamScope) return activeSeasons.length > 0
  return activeSeasons.some((season) => memberships.some((membership) => (
    membership.season_id === season.id
    && membership.player_id === userId
    && membershipCoversDate(membership, today)
  )))
}

export function canAccessView(profile: Profile, view: ViewName, permissionKeys?: readonly string[]) {
  if (view === 'home') return hasPermission(profile, PERMISSIONS.dashboard.personal, permissionKeys) || hasPermission(profile, PERMISSIONS.dashboard.team, permissionKeys)
  if (view === 'calendar') return hasPermission(profile, PERMISSIONS.calendar.manage, permissionKeys) || hasPermission(profile, PERMISSIONS.calendar.personal, permissionKeys)
  if (view === 'training') return hasPermission(profile, PERMISSIONS.training.view, permissionKeys)
  if (view === 'surveys') return hasPermission(profile, PERMISSIONS.surveys.manage, permissionKeys)
  if (view === 'survey') return hasPermission(profile, PERMISSIONS.surveys.respondOwn, permissionKeys)
  if (view === 'player-preview') return profile.is_owner
  if (view === 'attendance') return hasPermission(profile, PERMISSIONS.attendance.view, permissionKeys)
  if (view === 'tasks') return false
  if (view === 'matches') return hasPermission(profile, PERMISSIONS.matches.teamAvailability, permissionKeys)
  if (view === 'settings') return hasPermission(profile, PERMISSIONS.settings.view, permissionKeys)
  if (view === 'library') return hasPermission(profile, PERMISSIONS.library.view, permissionKeys)
  if (view === 'statistics') return hasPermission(profile, PERMISSIONS.statistics.view, permissionKeys)
  if (view === 'competition') return hasPermission(profile, PERMISSIONS.competition.view, permissionKeys)
  return false
}
