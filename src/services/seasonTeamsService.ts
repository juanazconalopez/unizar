import { supabase } from '../lib/supabase'
import type { SeasonTeam, SeasonTeamCoach } from '../types'
import type { SeasonTeamCoachRole } from '../features/seasons/seasonTeamCoachRoles'

export type SeasonTeamCoachChange = { coachId: string; assigned: boolean; role: SeasonTeamCoachRole }

export type SeasonTeamValues = {
  name: string
  isMixed: boolean
  isActive: boolean
}

export async function fetchSeasonTeams(seasonIds: string[]): Promise<SeasonTeam[]> {
  if (!seasonIds.length) return []
  const { data, error } = await supabase.from('season_teams').select('*').in('season_id', seasonIds).order('created_at')
  if (error) throw error
  return data ?? []
}

export async function fetchSeasonTeamCoaches(teamIds: string[]): Promise<SeasonTeamCoach[]> {
  if (!teamIds.length) return []
  const { data, error } = await supabase.from('season_team_coaches').select('*').in('season_team_id', teamIds)
  if (error) throw error
  return data ?? []
}

export async function fetchPublishedMatchCoachNames(matchId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_published_match_coaches', { checked_match_id: matchId })
  if (error) throw error
  return (data ?? []).map((coach) => coach.display_name)
}

export async function createSeasonTeam(seasonId: string, values: Pick<SeasonTeamValues, 'name' | 'isMixed'>) {
  const { error } = await supabase.rpc('create_season_team', {
    checked_season_id: seasonId,
    checked_name: values.name.trim(),
    checked_is_mixed: values.isMixed,
  })
  if (error) throw error
}

export async function updateSeasonTeam(team: SeasonTeam, values: SeasonTeamValues) {
  const { error } = await supabase.rpc('update_season_team', {
    checked_team_id: team.id,
    checked_name: values.name.trim(),
    checked_is_mixed: values.isMixed,
    checked_is_active: values.isActive,
  })
  if (error) throw error
}

export async function deleteSeasonTeam(teamId: string) {
  const { error } = await supabase.rpc('delete_season_team', { checked_team_id: teamId })
  if (error) throw error
}

export async function assignSeasonPlayerTeam(seasonId: string, playerId: string, teamId: string) {
  const { error } = await supabase.rpc('assign_season_player_team', {
    checked_season_id: seasonId,
    checked_player_id: playerId,
    checked_team_id: teamId,
  })
  if (error) throw error
}

export async function saveSeasonTeamCoaches(teamId: string, changes: SeasonTeamCoachChange[]) {
  const { error } = await supabase.rpc('save_season_team_coaches', {
    checked_team_id: teamId,
    checked_assignments: changes.map(({ coachId, assigned, role }) => ({ coach_id: coachId, assigned, role })),
  })
  if (error) throw error
}
