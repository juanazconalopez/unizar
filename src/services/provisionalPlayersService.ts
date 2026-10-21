import { supabase } from '../lib/supabase'
import { fetchAllPages } from './queryPagination'
import type { ProvisionalAttendanceRecord, ProvisionalPlayer } from '../types'

const provisionalAttendanceSelect = 'session_id, provisional_player_id, marked_by, updated_at, training_sessions(session_date), provisional_players(display_name)'

export async function fetchUnlinkedProvisionalPlayers(): Promise<ProvisionalPlayer[]> {
  const { data, error } = await fetchAllPages((from, to) => supabase
    .from('provisional_players')
    .select('*')
    .is('linked_at', null)
    .order('display_name').order('id').range(from, to))
  if (error) throw error
  return data ?? []
}

export async function fetchAllProvisionalAttendance(): Promise<ProvisionalAttendanceRecord[]> {
  const { data, error } = await fetchAllPages((from, to) => supabase
    .from('provisional_training_attendance')
    .select(provisionalAttendanceSelect)
    .order('updated_at', { ascending: false }).order('session_id').order('provisional_player_id').range(from, to))
  if (error) throw error
  return data ?? []
}

export async function linkProvisionalPlayers(provisionalPlayerIds: string[], profileId: string) {
  const { error } = await supabase.rpc('link_provisional_players', {
    checked_provisional_player_ids: provisionalPlayerIds,
    checked_profile_id: profileId,
  })
  if (error) throw error
}
