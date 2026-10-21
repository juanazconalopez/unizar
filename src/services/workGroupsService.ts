import { supabase } from '../lib/supabase'
import type { WorkGroupsApi, WorkGroupWorkspace } from '../features/workGroups/types'

export const workGroupsApi: WorkGroupsApi = {
  async load(seasonId) {
    const { data, error } = await supabase.rpc('get_work_group_workspace', { checked_season_id: seasonId })
    if (error) throw error
    return data as unknown as WorkGroupWorkspace
  },
  async saveMembers(seasonId, version, members) {
    const { error } = await supabase.rpc('save_work_group_members', { checked_season_id: seasonId, expected_version: version, checked_members: members })
    if (error) throw error
  },
  async saveAssignments(seasonId, version, assignments) {
    const { error } = await supabase.rpc('save_video_analysis_assignments', { checked_season_id: seasonId, expected_version: version, checked_assignments: assignments })
    if (error) throw error
  },
}
