import type { Enums, Tables } from './lib/database.types'

export type Profile = Omit<Tables<'profiles'>, 'updated_at'>

export type ProfilePrivateDetails = Omit<Tables<'profile_private_details'>, 'created_at' | 'updated_at'>

export type ProfileDetailsValues = {
  displayName: string
  phone: string
  birthDate: string
}

export type ManagedProfileValues = ProfileDetailsValues & {
  isActive: boolean
  isPlayer: boolean
  isCoach: boolean
  isViewer: boolean
  isOwner: boolean
}

export type ProfilePhotoChange = File | null | undefined

export type Season = Tables<'seasons'>

export type SeasonPlayer = Tables<'season_players'>

export type TodayBirthday = {
  player_id: string
  display_name: string
}

export type SeasonBirthday = TodayBirthday & {
  season_id: string
  birthday_on: string
  age_turning: number
}

export type TaskStatus = Enums<'task_status'>

export type TrainingTask = Omit<Tables<'tasks'>, 'updated_at'> & {
  seasons: { name: string } | null
}

export type TeamAnnouncement = Tables<'team_announcements'> & {
  seasons: { name: string } | null
}

export type TaskResult = Tables<'task_results'>

export type TrainingSession = Tables<'training_sessions'>

export type TacticsElementType = 'player' | 'opponent' | 'cone' | 'ball' | 'shield' | 'run' | 'pass' | 'defense' | 'zone' | 'text'

export type TacticsElement = {
  id: string
  type: TacticsElementType
  x: number
  y: number
  rotation?: number
  scaleX?: number
  scaleY?: number
  label?: string
  color?: string
}

export type TacticsBoardData = {
  version: 1
  template: 'full' | 'half' | '22'
  elements: TacticsElement[]
}

export type TrainingExercise = Omit<Tables<'training_exercises'>, 'diagram_data'> & {
  diagram_data: TacticsBoardData
}

export type TrainingExercisePreset = Omit<Tables<'training_exercise_presets'>, 'diagram_data'> & {
  diagram_data: TacticsBoardData
}

export type TrainingPlan = Tables<'training_plans'> & {
  seasons: { name: string } | null
  training_exercises: TrainingExercise[]
}

export type TrainingPlanCalendarItem = Pick<Tables<'training_plans'>, 'id' | 'session_date' | 'title' | 'status'>

export type TrainingExerciseValues = {
  title: string
  description: string
  durationMinutes: number
  diagramData: TacticsBoardData
}

export type TrainingPlanValues = {
  seasonId: string
  sessionDate: string
  title: string
  objectives: string
  material: string
  status: TaskStatus
  exercises: TrainingExerciseValues[]
}

export type AttendanceRecord = Omit<Tables<'training_attendance'>, 'created_at'> & {
  training_sessions: { session_date: string } | null
}

export type ProvisionalPlayer = Tables<'provisional_players'>
export type ProvisionalAttendanceRecord = Omit<Tables<'provisional_training_attendance'>, 'created_at'> & {
  training_sessions: { session_date: string } | null
  provisional_players?: { display_name: string } | null
}
export type ProvisionalAttendanceEntry = { id?: string; displayName: string }

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

export type SeasonCallupReportPlayer = {
  playerId: string
  name: string
  officialCallups: number
  friendlyCallups: number
  starterCallups: number
  substituteCallups: number
  eligibleMatches: number
  availabilityResponded: number
  availabilityPercentage: number | null
  attendedSessions: number
  eligibleSessions: number
  attendancePercentage: number | null
}

export type PlayerSeasonMatch = {
  matchId: string
  date: string
  opponent: string
  kind: MatchKind
  format: RugbyFormat
  isHome: boolean
  availabilityStatus: AvailabilityStatus | null
  calledUp: boolean
  lineupRole: LineupRole | null
  slotNumber: number | null
}

export type PlayerSeasonSummary = {
  seasonId: string
  seasonName: string
  playerId: string
  playerName: string
  generatedOn: string
  callups: { official: number; friendly: number; starter: number; substitute: number }
  availability: {
    eligibleMatches: number
    responded: number
    available: number
    doubt: number
    unavailable: number
    unanswered: number
    percentage: number | null
  }
  attendance: { attended: number; eligibleSessions: number; percentage: number | null }
  matches: PlayerSeasonMatch[]
}

export type SeasonCallupReport = {
  seasonId: string
  seasonName: string
  generatedOn: string
  totals: {
    officialMatches: number
    friendlyMatches: number
    trainingSessions: number
  }
  players: SeasonCallupReportPlayer[]
}

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

export type ViewName = 'home' | 'statistics' | 'calendar' | 'training' | 'tasks' | 'matches' | 'competition' | 'attendance' | 'settings'

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

export type AnnouncementValues = {
  seasonId: string
  date: string
  title: string
  description: string
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
