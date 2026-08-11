import { addDays, mondayFor, todayIso } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { NotificationFeedData } from '../features/notifications/notifications'

export async function fetchNotificationFeed(userId: string): Promise<NotificationFeedData> {
  const today = todayIso()
  const currentWeek = mondayFor(today)
  const [tasksResponse, membershipsResponse, matchesResponse] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, season_id, week_start, title, description, training_type, status, created_by, created_at, updated_at, seasons(name)')
      .eq('status', 'published')
      .gte('week_start', currentWeek)
      .lte('week_start', addDays(currentWeek, 28)),
    supabase.from('season_players').select('*').eq('player_id', userId),
    supabase
      .from('matches')
      .select('*, seasons(name)')
      .eq('status', 'published')
      .gte('match_date', today)
      .order('match_date', { ascending: true }),
  ])
  if (tasksResponse.error) throw tasksResponse.error
  if (membershipsResponse.error) throw membershipsResponse.error
  if (matchesResponse.error) throw matchesResponse.error

  const tasks = tasksResponse.data ?? []
  const matches = matchesResponse.data ?? []
  const [resultsResponse, availabilityResponse, lineupsResponse] = await Promise.all([
    tasks.length
      ? supabase.from('task_results').select('*').in('task_id', tasks.map((task) => task.id)).eq('player_id', userId)
      : Promise.resolve({ data: [], error: null }),
    matches.length
      ? supabase.from('match_availability').select('*').in('match_id', matches.map((match) => match.id)).eq('player_id', userId)
      : Promise.resolve({ data: [], error: null }),
    matches.length
      ? supabase.from('match_lineup').select('*').in('match_id', matches.map((match) => match.id))
      : Promise.resolve({ data: [], error: null }),
  ])
  if (resultsResponse.error) throw resultsResponse.error
  if (availabilityResponse.error) throw availabilityResponse.error
  if (lineupsResponse.error) throw lineupsResponse.error

  return {
    tasks,
    memberships: membershipsResponse.data ?? [],
    matches,
    results: resultsResponse.data ?? [],
    availability: availabilityResponse.data ?? [],
    lineups: lineupsResponse.data ?? [],
  }
}
