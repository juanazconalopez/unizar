import { todayIso } from '../lib/dates'
import { canAccessTasks, canManageSport, canViewTeamData } from '../lib/permissions'
import { membershipCoversDate } from '../lib/selectors'
import type { Profile, Season, SeasonPlayer, ViewName } from '../types'

export function hasWorkingSeason(profile: Profile, seasons: Season[], memberships: SeasonPlayer[], userId: string) {
  const today = todayIso()
  const activeSeasons = seasons.filter((season) => season.start_date <= today && season.end_date >= today)
  if (canViewTeamData(profile)) return activeSeasons.length > 0
  return activeSeasons.some((season) => memberships.some((membership) => (
    membership.season_id === season.id
    && membership.player_id === userId
    && membershipCoversDate(membership, today)
  )))
}

export function canAccessView(profile: Profile, view: ViewName) {
  if (view === 'calendar' || view === 'training' || view === 'attendance') return canManageSport(profile)
  if ((view === 'tasks' || view === 'matches') && canManageSport(profile)) return false
  if (view === 'settings') return profile.is_owner
  if (view === 'statistics') return canViewTeamData(profile)
  if (view === 'tasks') return canAccessTasks(profile)
  return true
}
