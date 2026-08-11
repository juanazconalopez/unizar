import type { Enums, Tables } from './lib/database.types'

export type Profile = Omit<Tables<'profiles'>, 'updated_at'>

export type Season = Tables<'seasons'>

export type SeasonPlayer = Tables<'season_players'>

export type TaskStatus = Enums<'task_status'>

export type TrainingTask = Omit<Tables<'tasks'>, 'updated_at'> & {
  seasons: { name: string } | null
}

export type TaskResult = Tables<'task_results'>

export type TrainingSession = Tables<'training_sessions'>

export type AttendanceRecord = Omit<Tables<'training_attendance'>, 'created_at'> & {
  training_sessions: { session_date: string } | null
}

export type MatchStatus = Enums<'match_status'>
export type MatchKind = Enums<'match_kind'>
export type RugbyFormat = Enums<'rugby_format'>
export type AvailabilityStatus = Enums<'availability_status'>
export type LineupRole = Enums<'lineup_role'>

export type Match = Tables<'matches'> & {
  seasons: { name: string } | null
}

export type MatchAvailability = Tables<'match_availability'>
export type MatchLineup = Tables<'match_lineup'>

export type CompetitionSeason = {
  id: string
  name: string
  startsOn: string
  sourceLabel: string
  updatedAt: string | null
}

export type CompetitionFixture = {
  id: string
  competitionSeasonId: string
  round: string
  roundOrder: number
  matchDate: string
  kickoffTime: string | null
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  status: 'scheduled' | 'final' | 'postponed'
}

export type CompetitionStanding = {
  competitionSeasonId: string
  position: number
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  pointsFor: number
  pointsAgainst: number
  difference: number
  offensiveBonus: number
  defensiveBonus: number
  points: number
}

export type CompetitionPlayerStat = {
  competitionSeasonId: string
  player: string
  team: string
  points: number
  tries: number
  conversions: number
  penalties: number
  drops: number
  yellowCards: number
  redCards: number
}

export type ViewName = 'home' | 'statistics' | 'tasks' | 'matches' | 'competition' | 'attendance' | 'settings'

export type ResultValues = {
  resultText: string
  fatigueLevel: number
  performedOn: string
}

export type TaskValues = {
  seasonId: string
  date: string
  title: string
  description: string
  trainingType: string
  status: TaskStatus
}

export type SeasonValues = {
  name: string
  start_date: string
  end_date: string
}

export type MatchValues = {
  seasonId: string
  opponent: string
  matchDate: string
  kickoffTime: string
  venue: string
  isHome: boolean
  notes: string
  status: MatchStatus
  matchKind: MatchKind
  rugbyFormat: RugbyFormat
}
