import type { Match } from '../../types'

/** Una ficha por derbi en el calendario; los entrenadores ven la de su equipo. */
export function visibleFixtureMatches(matches: Match[]): Match[] {
  const homeFixtures = new Set(matches.filter((match) => match.internal_fixture_id && match.is_home).map((match) => match.internal_fixture_id))
  return matches.filter((match) => !match.internal_fixture_id || match.is_home || !homeFixtures.has(match.internal_fixture_id))
}
