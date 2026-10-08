import type { Match, MatchAvailability } from '../../types'

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
