import { supabase } from '../lib/supabase'

export type SeasonHoliday = { season_id: string; holiday_date: string }

export async function fetchSeasonHolidays(seasonIds: string[]) {
  if (!seasonIds.length) return []
  const { data, error } = await supabase.from('season_holidays').select('season_id, holiday_date').in('season_id', seasonIds)
  if (error) throw error
  return data as SeasonHoliday[]
}

export async function saveSeasonHolidays(seasonId: string, dates: string[]) {
  const { error } = await supabase.rpc('set_season_holidays', { checked_season_id: seasonId, checked_dates: dates })
  if (error) throw error
}
