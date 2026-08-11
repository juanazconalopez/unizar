import { supabase } from '../lib/supabase'
import type { CompetitionFixture, CompetitionPlayerStat, CompetitionSeason, CompetitionStanding } from '../types'

export type CompetitionSeasonData = {
  fixtures: CompetitionFixture[]
  standings: CompetitionStanding[]
  playerStats: CompetitionPlayerStat[]
}

export async function fetchCompetitionSeasons(): Promise<CompetitionSeason[]> {
  const { data, error } = await supabase
    .from('competition_seasons')
    .select('id, name, starts_on, source_label, synced_at')
    .order('starts_on', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    sourceLabel: row.source_label,
    updatedAt: row.synced_at,
  }))
}

export async function fetchCompetitionSeasonData(seasonId: string): Promise<CompetitionSeasonData> {
  const [fixturesResponse, standingsResponse, statsResponse] = await Promise.all([
    supabase.from('competition_fixtures').select('*').eq('competition_season_id', seasonId).order('match_date'),
    supabase.from('competition_standings').select('*').eq('competition_season_id', seasonId).order('position'),
    supabase.from('competition_player_stats').select('*').eq('competition_season_id', seasonId).order('points', { ascending: false }),
  ])
  if (fixturesResponse.error) throw fixturesResponse.error
  if (standingsResponse.error) throw standingsResponse.error
  if (statsResponse.error) throw statsResponse.error
  return {
    fixtures: (fixturesResponse.data ?? []).map((row) => ({
      id: row.id,
      competitionSeasonId: row.competition_season_id,
      round: row.round,
      roundOrder: row.round_order,
      matchDate: row.match_date,
      kickoffTime: row.kickoff_time,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      homeScore: row.home_score,
      awayScore: row.away_score,
      status: competitionFixtureStatus(row.status),
    })),
    standings: (standingsResponse.data ?? []).map((row) => ({
      competitionSeasonId: row.competition_season_id,
      position: row.position,
      team: row.team,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      pointsFor: row.points_for,
      pointsAgainst: row.points_against,
      difference: row.difference,
      offensiveBonus: row.offensive_bonus,
      defensiveBonus: row.defensive_bonus,
      points: row.points,
    })),
    playerStats: (statsResponse.data ?? []).map((row) => ({
      competitionSeasonId: row.competition_season_id,
      player: row.player,
      team: row.team,
      points: row.points,
      tries: row.tries,
      conversions: row.conversions,
      penalties: row.penalties,
      drops: row.drops,
      yellowCards: row.yellow_cards,
      redCards: row.red_cards,
    })),
  }
}

export async function syncCompetition() {
  const { data, error } = await supabase.functions.invoke('sync-competition', { body: {} })
  if (error) {
    const context = 'context' in error ? error.context : null
    if (context instanceof Response) {
      const body = await context.clone().json().catch(() => null) as { error?: string } | null
      if (body?.error) throw new Error(body.error)
    }
    throw error
  }
  return data as { season: string; fixtures: number; standings: number; playerStats: number; syncedAt: string }
}

function competitionFixtureStatus(status: string): CompetitionFixture['status'] {
  if (status === 'scheduled' || status === 'final' || status === 'postponed') return status
  throw new Error(`Estado de partido de competición no reconocido: ${status}`)
}
