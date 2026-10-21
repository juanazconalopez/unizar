import { supabase } from '../lib/supabase'
import { fetchAllPages } from './queryPagination'
import type { MatchAvailability } from '../types'

// Cada ficha recibe la última respuesta al derbi, aunque se guardara en la otra.
// La RPC aplica los permisos de lectura y devuelve match_id de la ficha solicitada.
export async function fetchMatchAvailability(matchIds: string[], playerId?: string): Promise<MatchAvailability[]> {
  if (!matchIds.length) return []
  const { data, error } = await fetchAllPages((from, to) => supabase.rpc('get_match_availability', {
    checked_match_ids: matchIds,
    ...(playerId ? { checked_player_id: playerId } : {}),
  }).order('match_id').order('player_id').range(from, to))
  if (error) throw error
  return data ?? []
}
