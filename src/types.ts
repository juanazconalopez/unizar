export type Profile = {
  id: string
  display_name: string
  is_approved: boolean
  is_active: boolean
  is_collaborator: boolean
  is_owner: boolean
  created_at: string
}

export type Season = {
  id: string
  name: string
  start_date: string
  end_date: string
  created_by: string
  created_at: string
}

export type SeasonPlayer = {
  season_id: string
  player_id: string
  active_from: string
  active_until: string | null
}

export type TaskStatus = 'draft' | 'published' | 'cancelled'

export type TrainingTask = {
  id: string
  season_id: string
  week_start: string
  title: string
  description: string | null
  training_type: string | null
  status: TaskStatus
  created_by: string
  created_at: string
  seasons: { name: string } | null
}

export type TaskResult = {
  task_id: string
  player_id: string
  result_text: string
  fatigue_level: number
  performed_on: string
  completed_at: string
  updated_at: string
}

export type ViewName = 'home' | 'tasks' | 'seasons' | 'team'

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
