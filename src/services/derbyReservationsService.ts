import { supabase } from '../lib/supabase'
import type { MatchLineupReservation } from '../lib/matchParticipation'

export async function fetchMatchLineupReservations(matchId: string): Promise<MatchLineupReservation[]> {
  const { data, error } = await supabase.rpc('get_match_lineup_reservations', { checked_match_id: matchId })
  if (error) throw error
  if (!Array.isArray(data) || data.some((entry) => !entry || typeof entry.player_id !== 'string'
    || typeof entry.match_id !== 'string' || typeof entry.team_name !== 'string'
    || typeof entry.match_date !== 'string' || typeof entry.is_derby !== 'boolean')) {
    throw new Error('No se han podido comprobar las reservas de otros partidos.')
  }
  return data
}

export async function fetchDerbyReservedPlayers(matchId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_derby_reserved_player_ids', { checked_match_id: matchId })
  if (error) throw error
  if (!Array.isArray(data) || data.some((id) => typeof id !== 'string')) {
    throw new Error('No se han podido comprobar las reservas del otro equipo.')
  }
  return data
}
