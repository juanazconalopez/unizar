import type { AttendanceRecord, Profile, Season, SeasonPlayer, TaskResult } from '../types'

export function isActivePlayer(profile: Profile) {
  return profile.is_approved && profile.is_active && !profile.is_archived && !profile.is_owner
}

export function activePlayers(profiles: Profile[]) {
  return profiles.filter(isActivePlayer)
}

export function membershipCoversDate(membership: SeasonPlayer, date: string) {
  return membership.active_from <= date && (!membership.active_until || membership.active_until >= date)
}

export function membershipOverlapsSeasonRange(
  membership: SeasonPlayer,
  season: Season | undefined,
  from: string,
  to: string,
) {
  if (!season || membership.season_id !== season.id) return false
  const activeFrom = membership.active_from > season.start_date ? membership.active_from : season.start_date
  const membershipEnd = membership.active_until ?? season.end_date
  const activeUntil = membershipEnd < season.end_date ? membershipEnd : season.end_date
  return activeFrom <= to && activeUntil >= from
}

export function activeMembershipFor(memberships: SeasonPlayer[], seasonId: string, playerId: string) {
  return memberships.find((membership) => (
    membership.season_id === seasonId
    && membership.player_id === playerId
    && !membership.active_until
  ))
}

export function profilesById(profiles: Profile[]) {
  return new Map(profiles.map((profile) => [profile.id, profile]))
}

export function resultsByTask(results: TaskResult[]) {
  const grouped = new Map<string, TaskResult[]>()
  for (const result of results) grouped.set(result.task_id, [...(grouped.get(result.task_id) ?? []), result])
  return grouped
}

export function attendancePlayerIdsForDate(attendance: AttendanceRecord[], date: string) {
  return new Set(attendance
    .filter((record) => record.training_sessions?.session_date === date)
    .map((record) => record.player_id))
}
