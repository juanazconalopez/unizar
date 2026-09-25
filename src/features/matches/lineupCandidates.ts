import type { Profile, SeasonPlayer, SeasonTeam } from '../../types'

export type LineupCandidate = Profile & { teamName: string; priority: 0 | 1 | 2 }

/** Orden operativo: equipo del partido, mixto y el resto agrupado por equipo. */
export function orderedLineupCandidates(players: Profile[], memberships: SeasonPlayer[], teams: SeasonTeam[], seasonId: string, teamId: string | null | undefined): LineupCandidate[] {
  const teamsById = new Map(teams.filter((team) => team.season_id === seasonId).map((team) => [team.id, team]))
  return players.map((player) => {
    const membership = memberships.find((item) => item.season_id === seasonId && item.player_id === player.id && !item.active_until)
    const team = membership?.season_team_id ? teamsById.get(membership.season_team_id) : undefined
    const priority: 0 | 1 | 2 = team?.id === teamId ? 0 : team?.is_mixed ? 1 : 2
    return { ...player, teamName: team?.name ?? 'Sin equipo', priority }
  }).sort((first, second) => first.priority - second.priority || first.teamName.localeCompare(second.teamName, 'es') || first.display_name.localeCompare(second.display_name, 'es'))
}
