import { supabase } from '../lib/supabase'
import type { Match, MatchAvailability, MatchLineup, Profile, Season, SeasonPlayer, TaskResult, TeamAnnouncement, TrainingTask } from '../types'
import type { SurveyClosure } from './surveysService'

export type PlayerPreviewData = {
  player: Profile
  seasons: Season[]
  memberships: SeasonPlayer[]
  profiles: Profile[]
  tasks: TrainingTask[]
  results: TaskResult[]
  announcements: TeamAnnouncement[]
  matches: Match[]
  availability: MatchAvailability[]
  lineups: MatchLineup[]
  holidays: string[]
}

const profileFields = 'id, display_name, avatar_path, is_approved, is_active, is_player, is_coach, is_viewer, is_owner, is_archived, created_at'

export async function fetchPlayerPreview(playerId: string): Promise<PlayerPreviewData> {
  const authorization = await supabase.rpc('can_preview_player', { checked_player_id: playerId })
  if (authorization.error) throw authorization.error
  if (!authorization.data) throw new Error('No tienes permiso para abrir esta vista previa.')
  const playerResponse = await supabase.from('profiles').select(profileFields).eq('id', playerId).single()
  if (playerResponse.error) throw playerResponse.error
  const player = playerResponse.data as Profile
  if (!player.is_player || !player.is_approved || !player.is_active || player.is_archived) throw new Error('La jugadora no tiene acceso activo para previsualizar.')

  const membershipsResponse = await supabase.from('season_players').select('*').eq('player_id', playerId)
  if (membershipsResponse.error) throw membershipsResponse.error
  const memberships = membershipsResponse.data ?? []
  const seasonIds = memberships.map((membership) => membership.season_id)
  const [seasonsResponse, profilesResponse, tasksResponse, resultsResponse, announcementsResponse, matchesResponse, holidaysResponse] = await Promise.all([
    seasonIds.length ? supabase.from('seasons').select('*').in('id', seasonIds).order('start_date', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    supabase.from('profiles').select(profileFields).eq('is_approved', true).eq('is_active', true).eq('is_archived', false).order('display_name'),
    seasonIds.length ? supabase.from('tasks').select('id, season_id, week_start, title, description, training_type, sort_order, status, created_by, created_at, seasons(name)').in('season_id', seasonIds).eq('status', 'published') : Promise.resolve({ data: [], error: null }),
    supabase.from('task_results').select('*').eq('player_id', playerId),
    seasonIds.length ? supabase.from('team_announcements').select('*, seasons(name)').in('season_id', seasonIds).eq('status', 'published') : Promise.resolve({ data: [], error: null }),
    seasonIds.length ? supabase.from('matches').select('*, seasons(name), season_competitions(id,name,color,is_default), season_teams(id,name,is_mixed,is_default)').in('season_id', seasonIds).in('status', ['published', 'completed']).order('match_date') : Promise.resolve({ data: [], error: null }),
    seasonIds.length ? supabase.from('season_holidays').select('holiday_date').in('season_id', seasonIds) : Promise.resolve({ data: [], error: null }),
  ])
  for (const response of [seasonsResponse, profilesResponse, tasksResponse, resultsResponse, announcementsResponse, matchesResponse, holidaysResponse]) if (response.error) throw response.error
  const matches = matchesResponse.data ?? []
  const matchIds = matches.map((match) => match.id)
  const [availabilityResponse, lineupsResponse] = await Promise.all([
    matchIds.length ? supabase.from('match_availability').select('*').in('match_id', matchIds).eq('player_id', playerId) : Promise.resolve({ data: [], error: null }),
    matchIds.length ? supabase.from('match_lineup').select('*').in('match_id', matchIds).order('sort_order') : Promise.resolve({ data: [], error: null }),
  ])
  if (availabilityResponse.error) throw availabilityResponse.error
  if (lineupsResponse.error) throw lineupsResponse.error
  return {
    player, seasons: seasonsResponse.data ?? [], memberships,
    profiles: profilesResponse.data ?? [], tasks: tasksResponse.data ?? [], results: resultsResponse.data ?? [],
    announcements: announcementsResponse.data ?? [], matches, availability: availabilityResponse.data ?? [], lineups: lineupsResponse.data ?? [],
    holidays: (holidaysResponse.data ?? []).map((holiday) => holiday.holiday_date),
  }
}

export async function fetchPlayerPreviewSurveyClosures(playerId: string, from: string, until: string): Promise<SurveyClosure[]> {
  const { data, error } = await supabase.rpc('get_player_preview_survey_closures', {
    checked_player_id: playerId,
    checked_from: from,
    checked_until: until,
  })
  if (error) throw error
  return Array.isArray(data) ? data as SurveyClosure[] : []
}
