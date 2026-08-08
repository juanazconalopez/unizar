import { mondayFor, todayIso } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type {
  AttendanceRecord,
  Profile,
  ResultValues,
  Season,
  SeasonPlayer,
  SeasonValues,
  TaskResult,
  TaskStatus,
  TaskValues,
  TrainingSession,
  TrainingTask,
} from '../types'

export type TrainingData = {
  profile: Profile
  seasons: Season[]
  memberships: SeasonPlayer[]
  profiles: Profile[]
  tasks: TrainingTask[]
  results: TaskResult[]
  trainingSessions: TrainingSession[]
  attendance: AttendanceRecord[]
}

export async function fetchTrainingData(userId: string): Promise<TrainingData> {
  const { data: ownProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, is_approved, is_active, is_collaborator, is_owner, is_archived, created_at')
    .eq('id', userId)
    .single()

  if (profileError) throw profileError
  const profile = ownProfile as Profile
  const emptyData = {
    profile,
    seasons: [],
    memberships: [],
    profiles: [],
    tasks: [],
    results: [],
    trainingSessions: [],
    attendance: [],
  }
  if (!profile.is_approved || profile.is_archived) return emptyData

  const resultsQuery = supabase.from('task_results').select('*')
  const [seasonsResponse, tasksResponse, resultsResponse, membershipsResponse, attendanceResponse] = await Promise.all([
    supabase.from('seasons').select('*').order('start_date', { ascending: false }),
    supabase
      .from('tasks')
      .select('id, season_id, week_start, title, description, training_type, status, created_by, created_at, seasons(name)')
      .order('week_start', { ascending: false }),
    profile.is_owner ? resultsQuery : resultsQuery.eq('player_id', userId),
    supabase.from('season_players').select('*'),
    supabase
      .from('training_attendance')
      .select('session_id, player_id, attended, marked_by, updated_at, training_sessions(session_date)')
      .order('updated_at', { ascending: false }),
  ])

  if (seasonsResponse.error) throw seasonsResponse.error
  if (tasksResponse.error) throw tasksResponse.error
  if (resultsResponse.error) throw resultsResponse.error
  if (membershipsResponse.error) throw membershipsResponse.error
  if (attendanceResponse.error) throw attendanceResponse.error

  let profiles: Profile[] = []
  let trainingSessions: TrainingSession[] = []
  if (profile.is_owner) {
    const [profilesResponse, sessionsResponse] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, is_approved, is_active, is_collaborator, is_owner, is_archived, created_at')
        .order('display_name'),
      supabase.from('training_sessions').select('*').order('session_date', { ascending: false }),
    ])
    if (profilesResponse.error) throw profilesResponse.error
    if (sessionsResponse.error) throw sessionsResponse.error
    profiles = (profilesResponse.data ?? []) as Profile[]
    trainingSessions = (sessionsResponse.data ?? []) as TrainingSession[]
  }

  return {
    profile,
    seasons: (seasonsResponse.data ?? []) as Season[],
    tasks: (tasksResponse.data ?? []) as unknown as TrainingTask[],
    results: (resultsResponse.data ?? []) as TaskResult[],
    memberships: (membershipsResponse.data ?? []) as SeasonPlayer[],
    profiles,
    trainingSessions,
    attendance: (attendanceResponse.data ?? []) as unknown as AttendanceRecord[],
  }
}

export async function saveTaskResult(
  task: TrainingTask,
  values: ResultValues,
  userId: string,
  exists: boolean,
) {
  const payload = {
    task_id: task.id,
    player_id: userId,
    result_text: values.resultText.trim(),
    fatigue_level: values.fatigueLevel,
    performed_on: values.performedOn,
    updated_at: new Date().toISOString(),
  }

  const response = exists
    ? await supabase.from('task_results').update(payload).eq('task_id', task.id).eq('player_id', userId)
    : await supabase.from('task_results').insert(payload)

  if (response.error) throw response.error
}

export async function createTrainingTask(values: TaskValues, userId: string) {
  const { error } = await supabase.from('tasks').insert({
    season_id: values.seasonId,
    week_start: mondayFor(values.date),
    title: values.title.trim(),
    description: values.description.trim() || null,
    training_type: values.trainingType,
    status: values.status,
    created_by: userId,
  })
  if (error) throw error
}

export async function updateTrainingTask(taskId: string, values: TaskValues) {
  const { error } = await supabase.from('tasks').update({
    season_id: values.seasonId,
    week_start: mondayFor(values.date),
    title: values.title.trim(),
    description: values.description.trim() || null,
    training_type: values.trainingType,
    status: values.status,
  }).eq('id', taskId)
  if (error) throw error
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
  if (error) throw error
}

export async function createSeason(values: SeasonValues, userId: string) {
  const { error } = await supabase.from('seasons').insert({
    ...values,
    name: values.name.trim(),
    created_by: userId,
  })
  if (error) throw error
}

export async function updateProfilePermissions(profile: Profile) {
  const { error } = await supabase
    .from('profiles')
    .update({
      is_approved: profile.is_approved,
      is_active: profile.is_active,
      is_collaborator: profile.is_collaborator,
      is_owner: profile.is_owner,
      is_archived: profile.is_archived,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
  if (error) throw error
}

export async function saveTrainingAttendance(
  attendanceDate: string,
  playerIds: string[],
  attendedPlayerIds: string[],
  userId: string,
) {
  const now = new Date().toISOString()
  const { data: session, error: sessionError } = await supabase
    .from('training_sessions')
    .upsert(
      { session_date: attendanceDate, created_by: userId, updated_at: now },
      { onConflict: 'session_date' },
    )
    .select('id')
    .single()

  if (sessionError) throw sessionError
  if (!playerIds.length) return

  const attended = new Set(attendedPlayerIds)
  const rows = playerIds.map((playerId) => ({
    session_id: session.id,
    player_id: playerId,
    attended: attended.has(playerId),
    marked_by: userId,
    updated_at: now,
  }))
  const { error } = await supabase
    .from('training_attendance')
    .upsert(rows, { onConflict: 'session_id,player_id' })
  if (error) throw error
}

export async function setSeasonMembership(
  season: Season,
  player: Profile,
  active: boolean,
  existing?: SeasonPlayer,
) {
  if (active && !existing) {
    const activeFrom = todayIso() < season.start_date ? season.start_date : todayIso()
    const { error } = await supabase.from('season_players').insert({
      season_id: season.id,
      player_id: player.id,
      active_from: activeFrom,
    })
    if (error) throw error
    return
  }

  if (!active && existing) {
    const activeUntil = todayIso() < existing.active_from ? existing.active_from : todayIso()
    const { error } = await supabase
      .from('season_players')
      .update({ active_until: activeUntil })
      .eq('season_id', season.id)
      .eq('player_id', player.id)
    if (error) throw error
    return
  }

  if (active && existing?.active_until) {
    const { error } = await supabase
      .from('season_players')
      .update({ active_until: null })
      .eq('season_id', season.id)
      .eq('player_id', player.id)
    if (error) throw error
  }
}
