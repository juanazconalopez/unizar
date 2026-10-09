import type { Match, MatchAvailability, MatchLineup } from '../../types'
import { matchParticipationWindow } from '../../lib/matchParticipation'
import type { MatchLineupReservation } from '../../lib/matchParticipation'

/** Las propuestas guardadas, incluidas las del otro equipo del derbi, reservan el periodo. */
export function reservedLineupPlayerIds(match: Match, matches: Match[], lineups: MatchLineup[]): string[] {
  return [...new Set(lineupReservations(match, matches, lineups).map((entry) => entry.player_id))]
}

/** La vista local complementa la RPC que también ve reservas de borradores ajenos. */
export function lineupReservations(match: Match, matches: Match[], lineups: MatchLineup[]): MatchLineupReservation[] {
  const otherMatches = new Map(matches.filter((item) => item.id !== match.id
    && item.status !== 'cancelled' && matchParticipationWindow(item.match_date) === matchParticipationWindow(match.match_date))
    .map((item) => [item.id, item]))
  return lineups.flatMap((entry) => {
    const other = otherMatches.get(entry.match_id)
    return other ? [{ player_id: entry.player_id, match_id: other.id, team_name: other.season_teams?.name ?? 'Otro equipo',
      match_date: other.match_date, is_derby: Boolean(match.internal_fixture_id && other.internal_fixture_id === match.internal_fixture_id) }] : []
  })
}

/** Disponibilidad única por jugadora para ambas fichas, sin duplicar datos guardados. */
export function fixtureAvailability(match: Match, matches: Match[], availability: MatchAvailability[]): MatchAvailability[] {
  const matchIds = new Set(matches.filter((item) => item.id === match.id || (
    match.internal_fixture_id && item.internal_fixture_id === match.internal_fixture_id
    && item.season_id === match.season_id && item.match_date === match.match_date
  )).map((item) => item.id))
  matchIds.add(match.id)
  const latest = new Map<string, MatchAvailability>()
  for (const response of availability) {
    if (!matchIds.has(response.match_id)) continue
    const previous = latest.get(response.player_id)
    if (!previous || Date.parse(response.updated_at) > Date.parse(previous.updated_at)
      || (Date.parse(response.updated_at) === Date.parse(previous.updated_at) && response.match_id < previous.match_id)) {
      latest.set(response.player_id, response)
    }
  }
  return [...latest.values()].map((response) => ({ ...response, match_id: match.id }))
}

/** Una ficha por derbi en el calendario; los entrenadores ven la de su equipo. */
export function visibleFixtureMatches(matches: Match[]): Match[] {
  const homeFixtures = new Set(matches.filter((match) => match.internal_fixture_id && match.is_home).map((match) => match.internal_fixture_id))
  return matches.filter((match) => !match.internal_fixture_id || match.is_home || !homeFixtures.has(match.internal_fixture_id))
}
