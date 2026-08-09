import { supabase } from '../lib/supabase'
import type { AvailabilityStatus, Match, MatchLineup, MatchValues } from '../types'

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

export async function saveMatchLineup(match: Match, entries: Omit<MatchLineup, 'match_id' | 'updated_at'>[], published: boolean) {
  const { error } = await supabase.rpc('save_match_lineup', {
    checked_match_id: match.id,
    lineup_entries: entries,
    publish_lineup: published,
  })
  if (error) throw error
}
