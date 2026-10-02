import { supabase } from '../lib/supabase'
import type { PlayerLicenseType } from '../types'

export async function savePlayerLicense(seasonId: string, playerId: string, license: PlayerLicenseType) {
  const { data, error } = await supabase.rpc('set_season_player_license', {
    checked_season_id: seasonId, checked_player_id: playerId, checked_license: license,
  })
  if (error) throw error
  return data ?? 0
}
