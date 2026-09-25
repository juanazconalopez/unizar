import type { Match } from '../types'

export function matchTitle(match: Match) {
  const teamName = match.season_teams?.name ?? 'Unizar Fem.'
  return match.is_home
    ? `${teamName} vs ${match.opponent}`
    : `${match.opponent} vs ${teamName}`
}
