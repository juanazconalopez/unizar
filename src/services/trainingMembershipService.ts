import { todayIso } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { Profile, Season, SeasonPlayer } from '../types'
import { invalidateBirthdayCache } from './birthdayService'

export async function setSeasonMembership(season: Season, player: Profile, active: boolean, existing?: SeasonPlayer) {
  void player
  if (active) {
    if (existing) return
    throw new Error('Las jugadoras se incorporan automáticamente a la temporada y se organizan desde Equipos.')
  }
  if (existing) {
    const today = todayIso()
    const candidateEnd = today < existing.active_from ? existing.active_from : today
    const activeUntil = candidateEnd > season.end_date ? season.end_date : candidateEnd
    const { error } = await supabase.from('season_players').update({ active_until: activeUntil }).eq('id', existing.id)
    if (error) throw error
    invalidateBirthdayCache()
  }
}
