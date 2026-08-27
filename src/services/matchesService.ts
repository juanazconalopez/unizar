import { supabase } from '../lib/supabase'
import type { AvailabilityStatus, Match, MatchLineup, MatchValues, PlayerSeasonSummary, SeasonCallupReport } from '../types'

function matchPayload(values: MatchValues) {
  return {
    season_id: values.seasonId,
    opponent: values.opponent.trim(),
    match_date: values.matchDate,
    kickoff_time: values.kickoffTime || null,
    venue: values.venue.trim() || null,
    is_home: values.isHome,
    notes: values.notes.trim() || null,
    status: values.status,
    match_kind: values.matchKind,
    rugby_format: values.rugbyFormat,
  }
}

export async function createMatch(values: MatchValues, userId: string) {
  const { error } = await supabase.from('matches').insert({ ...matchPayload(values), created_by: userId })
  if (error) throw error
}

export async function updateMatch(matchId: string, values: MatchValues) {
  const { error } = await supabase.from('matches').update(matchPayload(values)).eq('id', matchId)
  if (error) throw error
}

export async function deleteMatch(matchId: string) {
  const { error } = await supabase.from('matches').delete().eq('id', matchId)
  if (error) throw error
}

export async function saveMatchAvailability(matchId: string, playerId: string, status: AvailabilityStatus, comment: string) {
  const { error } = await supabase.from('match_availability').upsert({
    match_id: matchId, player_id: playerId, status, comment: comment.trim() || null,
  }, { onConflict: 'match_id,player_id' })
  if (error) throw error
}

export async function setPlayerMatchAvailability(matchId: string, playerId: string, status: AvailabilityStatus, comment: string) {
  const { error } = await supabase.rpc('set_player_match_availability', {
    checked_match_id: matchId,
    checked_player_id: playerId,
    checked_status: status,
    checked_comment: comment.trim(),
  })
  if (error) throw error
}

export async function saveMatchLineup(match: Match, entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) {
  const { error } = await supabase.rpc('save_match_lineup', {
    checked_match_id: match.id,
    lineup_entries: entries,
    publish_lineup: published,
  })
  if (error) throw error
}

export async function unlockMatchLineup(matchId: string) {
  const { error } = await supabase.rpc('unlock_match_lineup', { checked_match_id: matchId })
  if (error) throw error
}

export async function fetchSeasonCallupReport(seasonId: string): Promise<SeasonCallupReport> {
  const { data, error } = await supabase.rpc('get_season_callup_report', { checked_season_id: seasonId })
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('El resumen de convocatorias no tiene un formato válido.')
  return data as unknown as SeasonCallupReport
}

export async function fetchSeasonAttendanceReport(seasonId: string): Promise<SeasonCallupReport> {
  const { data, error } = await supabase.rpc('get_season_attendance_report', { checked_season_id: seasonId })
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('El resumen de asistencia no tiene un formato válido.')
  return data as unknown as SeasonCallupReport
}

export async function fetchPlayerSeasonSummary(seasonId: string, playerId: string): Promise<PlayerSeasonSummary> {
  const { data, error } = await supabase.rpc('get_player_season_summary', {
    checked_season_id: seasonId,
    checked_player_id: playerId,
  })
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('El resumen personal no tiene un formato válido.')
  return data as unknown as PlayerSeasonSummary
}
