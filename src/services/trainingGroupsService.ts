import { supabase } from '../lib/supabase'
import type { TrainingGroupsApi, TrainingGroupSummary, TrainingGroupWorkspace } from '../features/trainingGroups/types'
import type { SessionQueryCache } from './sessionQueryCache'

export function cachedTrainingGroupsApi(cache: SessionQueryCache): TrainingGroupsApi {
  return {
    summary: (seasonId) => cache.load(`group-summary:${seasonId}`, () => trainingGroupsApi.summary(seasonId)),
    workspace: (seasonId, blockId, date) => cache.load(`group-workspace:${seasonId}:${blockId}:${date}`, () => trainingGroupsApi.workspace(seasonId, blockId, date)),
    saveDraft: async (values) => { const result = await trainingGroupsApi.saveDraft(values); cache.clear(); return result },
    publish: async (id, version) => { await trainingGroupsApi.publish(id, version); cache.clear() },
    discardDraft: async (id, version) => { await trainingGroupsApi.discardDraft(id, version); cache.clear() },
  }
}

export const trainingGroupsApi: TrainingGroupsApi = {
  async summary(seasonId) {
    const { data, error } = await supabase.rpc('get_training_group_summary', { checked_season_id: seasonId })
    if (error) throw error
    return data as unknown as TrainingGroupSummary
  },
  async workspace(seasonId, blockId, rosterDate) {
    const { data, error } = await supabase.rpc('get_training_group_workspace', { checked_season_id: seasonId, checked_block_id: blockId, roster_date: rosterDate })
    if (error) throw error
    return data as unknown as TrainingGroupWorkspace
  },
  async saveDraft(values) {
    const { data, error } = await supabase.rpc('save_training_group_draft', {
      checked_season_id: values.seasonId, starts_on: values.startsOn, members: values.members,
      checked_block_id: values.blockId, expected_version: values.expectedVersion,
    })
    if (error) throw error
    return data
  },
  async publish(blockId, expectedVersion) {
    const { error } = await supabase.rpc('publish_training_group_block', { checked_block_id: blockId, expected_version: expectedVersion })
    if (error) throw error
  },
  async discardDraft(blockId, expectedVersion) {
    const { error } = await supabase.rpc('discard_training_group_draft', { checked_block_id: blockId, expected_version: expectedVersion })
    if (error) throw error
  },
}
