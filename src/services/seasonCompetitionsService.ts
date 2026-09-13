import { isSeasonCompetitionColor } from '../lib/seasonCompetitions'
import { supabase } from '../lib/supabase'
import type { SeasonCompetition, SeasonCompetitionColor } from '../types'

export type SeasonCompetitionValues = { name: string; color: SeasonCompetitionColor }

export async function fetchSeasonCompetitions(seasonIds: string[]): Promise<SeasonCompetition[]> {
  if (!seasonIds.length) return []
  const { data, error } = await supabase
    .from('season_competitions')
    .select('*, matches(count)')
    .in('season_id', seasonIds)
    .order('created_at')
  if (error) throw error
  return (data ?? []).map((row) => {
    if (!isSeasonCompetitionColor(row.color)) throw new Error(`Color de competición no reconocido: ${row.color}`)
    return {
      color: row.color,
      created_at: row.created_at,
      created_by: row.created_by,
      id: row.id,
      is_default: row.is_default,
      match_count: row.matches[0]?.count ?? 0,
      name: row.name,
      season_id: row.season_id,
      updated_at: row.updated_at,
    }
  })
}

export async function createSeasonCompetition(seasonId: string, values: SeasonCompetitionValues) {
  const { error } = await supabase.rpc('create_season_competition', {
    checked_season_id: seasonId,
    checked_name: values.name.trim(),
    checked_color: values.color,
  })
  if (error) throw error
}

export async function updateSeasonCompetition(competitionId: string, values: SeasonCompetitionValues) {
  const { error } = await supabase.rpc('update_season_competition', {
    checked_competition_id: competitionId,
    checked_name: values.name.trim(),
    checked_color: values.color,
  })
  if (error) throw error
}

export async function setDefaultSeasonCompetition(competitionId: string) {
  const { error } = await supabase.rpc('set_default_season_competition', { checked_competition_id: competitionId })
  if (error) throw error
}

export async function deleteSeasonCompetition(competitionId: string) {
  const { data, error } = await supabase.rpc('delete_season_competition', { checked_competition_id: competitionId })
  if (error) throw error
  return data
}
