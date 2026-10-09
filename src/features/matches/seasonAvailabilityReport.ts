import type { Match, MatchAvailability, MatchLineup, PlayerSeasonSummary, SeasonPlayer, SeasonTeam } from '../../types'
import { fixtureAvailability } from './internalFixtures'
import { matchParticipationWindow } from '../../lib/matchParticipation'
import { membershipCoversDate } from '../../lib/selectors'
import { matchAvailabilityRestriction } from '../../lib/playerLicenses'

/** Equipo en la fecha del partido + una oportunidad por viernes–domingo (entre semana, por día). */
export function seasonAvailabilityReport(matches: Match[], availability: MatchAvailability[], playerId: string,
  memberships: SeasonPlayer[], teams: SeasonTeam[], lineups: MatchLineup[]) {
  const calledUp = new Set(lineups.filter((entry) => entry.player_id === playerId).map((entry) => entry.match_id))
  const membershipFor = (match: Match) => memberships.find((entry) => entry.player_id === playerId
    && entry.season_id === match.season_id && membershipCoversDate(entry, match.match_date))
  const ownTeam = (match: Match) => Boolean(membershipFor(match)?.season_team_id && membershipFor(match)?.season_team_id === match.team_id)
  const responseFor = (match: Match) => fixtureAvailability(match, matches, availability).find((entry) => entry.player_id === playerId)
  const priority = (item: Match) => (calledUp.has(item.id) ? 4 : 0) + (ownTeam(item) ? 2 : 0) + (responseFor(item) ? 1 : 0)
  const compare = (a: Match, b: Match) => priority(b) - priority(a) || a.match_date.localeCompare(b.match_date)
    || (a.kickoff_time ?? '24:00:00').localeCompare(b.kickoff_time ?? '24:00:00') || Number(b.is_home) - Number(a.is_home) || a.id.localeCompare(b.id)
  const fixtures = new Map<string, Match>()
  for (const match of matches) {
    if (!['published', 'completed'].includes(match.status) || matchAvailabilityRestriction(match, memberships, playerId)) continue
    const membership = membershipFor(match)
    const mixed = teams.some((team) => team.id === membership?.season_team_id && team.season_id === match.season_id && team.is_mixed)
    if (!ownTeam(match) && !mixed && !calledUp.has(match.id)
      && !(match.match_kind === 'friendly' && !membership?.season_team_id && !match.team_id)) continue
    const key = `${match.season_id}:${matchParticipationWindow(match.match_date)}`
    const previous = fixtures.get(key)
    if (!previous || compare(match, previous) < 0) fixtures.set(key, match)
  }
  const fixtureMatches = [...fixtures.values()]
  const responses = fixtureMatches.flatMap((match) => fixtureAvailability(match, matches, availability).filter((response) => response.player_id === playerId))
  const eligibleMatches = fixtureMatches.length
  const responded = responses.length
  const totals: PlayerSeasonSummary['availability'] = {
    eligibleMatches, responded,
    available: responses.filter((response) => response.status === 'available').length,
    doubt: responses.filter((response) => response.status === 'doubt').length,
    unavailable: responses.filter((response) => response.status === 'unavailable').length,
    unanswered: eligibleMatches - responded,
    percentage: eligibleMatches ? Math.round(responded * 100 / eligibleMatches) : null,
  }
  return { matches: fixtureMatches, responses, totals }
}
