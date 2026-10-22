import { membershipCoversDate } from '../lib/selectors'
import type { SeasonPlayer } from '../types'
import { trainingGroupsApi } from './trainingGroupsService'
import { addDays, todayIso } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { NotificationFeedData } from '../features/notifications/notifications'
import { fetchAllPages } from './queryPagination'
import { fetchMatchAvailability } from './matchAvailabilityService'

export async function fetchNotificationFeed(userId: string, canManageAvailability = false, includeTrainingGroups = false): Promise<NotificationFeedData> {
  const today = todayIso()
  const [membershipsResponse, matchesResponse, announcementsResponse] = await Promise.all([
    supabase.rpc('get_player_season_memberships', { checked_player_id: userId }),
    fetchAllPages((from, to) => supabase
      .from('matches')
      .select('*, training_exceptions:match_training_exceptions(player_id), seasons(name), season_competitions(id,name,color,is_default,competition_level,is_league)')
      .eq('status', 'published')
      .gte('match_date', today)
      .lte('match_date', addDays(today, 84))
      .order('match_date', { ascending: true }).order('id').range(from, to)),
    fetchAllPages((from, to) => supabase
      .from('team_announcements')
      .select('*, seasons(name)')
      .eq('status', 'published')
      .gte('announcement_date', today)
      .lte('announcement_date', addDays(today, 84))
      .order('announcement_date', { ascending: true }).order('id').range(from, to)),
  ])
  if (membershipsResponse.error) throw membershipsResponse.error
  if (matchesResponse.error) throw matchesResponse.error
  if (announcementsResponse.error) throw announcementsResponse.error

  const matches = matchesResponse.data ?? []
  const [availability, lineupsResponse, trainingGroups] = await Promise.all([
    fetchMatchAvailability(matches.map((match) => match.id), canManageAvailability ? undefined : userId),
    matches.length
      ? fetchAllPages((from, to) => supabase.from('match_lineup').select('*').in('match_id', matches.map((match) => match.id)).order('match_id').order('player_id').range(from, to))
      : Promise.resolve({ data: [], error: null }),
    includeTrainingGroups ? fetchOwnTrainingGroupNotifications(today, userId, membershipsResponse.data ?? []) : Promise.resolve([]),
  ])
  if (lineupsResponse.error) throw lineupsResponse.error

  return {
    // La campana utiliza avisos, partidos, convocatorias y perfil. No necesita
    // volver a descargar las tareas y sus resultados que ya carga cada vista.
    tasks: [],
    trainingGroups,
    memberships: membershipsResponse.data ?? [],
    matches,
    results: [],
    availability,
    lineups: lineupsResponse.data ?? [],
    announcements: announcementsResponse.data ?? [],
  }
}

async function fetchOwnTrainingGroupNotifications(today: string, userId: string, memberships: SeasonPlayer[]) {
  const { data, error } = await supabase.from('seasons').select('id').lte('start_date', today).gte('end_date', today).maybeSingle()
  if (error) throw error
  if (!data || !memberships.some((membership) => membership.player_id === userId && membership.season_id === data.id && membershipCoversDate(membership, today))) return []
  return (await trainingGroupsApi.summary(data.id)).own_groups
}
