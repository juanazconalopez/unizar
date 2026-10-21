import type { PlayingGroup } from '../../lib/playerPositions'

export type TrainingGroupColor = 'red' | 'white'
export type TrainingGroupPlayer = {
  player_id: string
  display_name: string
  team_id: string | null
  team_name: string
  position_group: PlayingGroup
}
export type TrainingGroupAssignment = { player_id: string; color: TrainingGroupColor }
export type TrainingGroupMember = TrainingGroupPlayer & TrainingGroupAssignment
export type TrainingGroupBlock = {
  id: string
  season_id: string
  starts_on: string
  status: 'draft' | 'published'
  created_at: string
  published_at: string | null
  version: number
  has_draft: boolean
}
export type OwnTrainingGroup = {
  block_id: string
  starts_on: string
  color: TrainingGroupColor
  notified_at: string
}
export type TrainingGroupSummary = { blocks: TrainingGroupBlock[]; own_groups: OwnTrainingGroup[] }
export type TrainingGroupWorkspace = {
  candidates: TrainingGroupPlayer[]
  members: TrainingGroupMember[]
  draft: TrainingGroupAssignment[] | null
}
export type SaveTrainingGroupDraft = {
  seasonId: string
  startsOn: string
  members: TrainingGroupAssignment[]
  blockId?: string
  expectedVersion?: number
}
export type TrainingGroupsApi = {
  summary: (seasonId: string) => Promise<TrainingGroupSummary>
  workspace: (seasonId: string, blockId: string | undefined, rosterDate: string, refresh?: boolean) => Promise<TrainingGroupWorkspace>
  saveDraft: (values: SaveTrainingGroupDraft) => Promise<string>
  publish: (blockId: string, expectedVersion: number) => Promise<void>
  discardDraft: (blockId: string, expectedVersion: number) => Promise<void>
}
