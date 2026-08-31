import { todayIso } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { Profile, Season, SeasonPlayer } from '../types'
import { invalidateBirthdayCache } from './birthdayService'

export async function setSeasonMembership(season: Season, player: Profile, active: boolean, existing?: SeasonPlayer) {
  if (active) {
    if (existing) return
    const today = todayIso()
    const activeFrom = today < season.start_date ? season.start_date : today > season.end_date ? season.end_date : today
    const activeUntil = today > season.end_date ? season.end_date : null
    const { error } = await supabase.from('season_players').insert({
      season_id: season.id,
      player_id: player.id,
      active_from: activeFrom,
      active_until: activeUntil,
    })
    if (error) throw error
    invalidateBirthdayCache()
    return
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
