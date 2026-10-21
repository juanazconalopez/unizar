import { isEnabledProfile } from '../../lib/permissions'
import { membershipCoversDate } from '../../lib/selectors'
import type { Profile, Season, SeasonPlayer } from '../../types'

export function workGroupCandidates(profiles: Profile[], memberships: SeasonPlayer[], season: Season, today: string) {
  const date = today < season.start_date ? season.start_date : today > season.end_date ? season.end_date : today
  return profiles.filter((profile) => isEnabledProfile(profile) && (profile.is_coach || profile.is_player && memberships.some((membership) => membership.season_id === season.id && membership.player_id === profile.id && membershipCoversDate(membership, date))))
    .map((profile) => ({ id: profile.id, display_name: profile.display_name }))
}
