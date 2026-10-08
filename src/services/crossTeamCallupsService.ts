import { supabase } from '../lib/supabase'
import type { CrossTeamCallupReference } from '../lib/crossTeamCallups'

export async function fetchCrossTeamCallupReference(matchId: string): Promise<CrossTeamCallupReference> {
  const { data, error } = await supabase.rpc('get_cross_team_callup_reference', { checked_match_id: matchId })
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || typeof data.enabled !== 'boolean' || typeof data.confirmed !== 'boolean'
    || !Array.isArray(data.playerIds) || data.playerIds.some((id) => typeof id !== 'string')
    || !['matchId', 'teamName', 'matchDate'].every((key) => data[key] === null || typeof data[key] === 'string')) {
    throw new Error('No se ha podido comprobar el límite entre equipos. Vuelve a abrir la convocatoria.')
  }
  return data as unknown as CrossTeamCallupReference
}
