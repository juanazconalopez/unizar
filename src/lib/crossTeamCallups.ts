import type { Match, MatchLineup } from '../types'

export const CROSS_TEAM_CALLUP_LIMIT = 7

export type CrossTeamCallupReference = {
  enabled: boolean
  matchId: string | null
  teamName: string | null
  matchDate: string | null
  confirmed: boolean
  playerIds: string[]
}

export function crossTeamCallupOverlap(reference: CrossTeamCallupReference, playerIds: Iterable<string>) {
  const previous = new Set(reference.playerIds)
  return [...new Set(playerIds)].filter((id) => previous.has(id))
}

export function crossTeamCallupRestriction(reference: CrossTeamCallupReference, playerIds: Iterable<string>): string | null {
  if (!reference.enabled || !reference.matchId) return null
  if (!reference.confirmed) return 'Confirma el acta del último partido del otro equipo antes de publicar esta convocatoria.'
  const count = crossTeamCallupOverlap(reference, playerIds).length
  return count > CROSS_TEAM_CALLUP_LIMIT ? `Hay ${count} jugadoras de la última acta del otro equipo. Solo pueden repetirse ${CROSS_TEAM_CALLUP_LIMIT}.` : null
}

/** Mismo cálculo que SQL para la demo; en producción la referencia se consulta al abrir el editor. */
export function crossTeamCallupReference(match: Match, matches: Match[], lineups: MatchLineup[], enabled: boolean): CrossTeamCallupReference {
  const applies = enabled && match.status !== 'completed' && match.status !== 'cancelled' && match.match_kind === 'official' && Boolean(match.team_id && match.competition_id)
  const previous = applies ? matches.filter((other) => other.season_id === match.season_id
    && other.competition_id === match.competition_id && other.match_kind === 'official'
    && other.team_id && other.team_id !== match.team_id && other.status !== 'draft' && other.status !== 'cancelled'
    && (!match.internal_fixture_id || other.internal_fixture_id !== match.internal_fixture_id)
    && (other.match_date < match.match_date || (other.match_date === match.match_date
      && other.kickoff_time && match.kickoff_time && other.kickoff_time < match.kickoff_time)))
    .sort((a, b) => b.match_date.localeCompare(a.match_date)
      || (b.kickoff_time ?? '').localeCompare(a.kickoff_time ?? '') || b.id.localeCompare(a.id))[0] : undefined
  return {
    enabled: applies, matchId: previous?.id ?? null, teamName: previous?.season_teams?.name ?? null,
    matchDate: previous?.match_date ?? null,
    confirmed: Boolean(previous?.status === 'completed' && previous.report_events_reviewed && previous.lineup_published),
    playerIds: previous?.lineup_published ? [...new Set(lineups.filter((entry) => entry.match_id === previous.id).map((entry) => entry.player_id))] : [],
  }
}
