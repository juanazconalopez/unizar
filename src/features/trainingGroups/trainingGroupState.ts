import { addDays, mondayFor, todayInMadridIso } from '../../lib/dates'
import type { Season } from '../../types'
import { generateTrainingGroups } from './generateTrainingGroups'
import type { TrainingGroupAssignment, TrainingGroupsApi, TrainingGroupSummary, TrainingGroupWorkspace } from './types'

export type GroupState = { summary: TrainingGroupSummary; workspace: TrainingGroupWorkspace; selectedId?: string; rosterDate: string; assignments: TrainingGroupAssignment[]; editing: boolean }

export async function fetchGroupState(api: TrainingGroupsApi, season: Season, canManage: boolean, date?: string, newProposal = false): Promise<GroupState> {
  const today = todayInMadridIso()
  const nextMonday = mondayFor(today) === today ? today : addDays(mondayFor(today), 7)
  const firstDate = nextMonday > season.start_date ? nextMonday : season.start_date
  const defaultDate = firstDate > season.end_date ? season.end_date : firstDate
  const summary = await api.summary(season.id)
  const newestFirst = [...summary.blocks].sort((a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at))
  const selected = newProposal ? undefined
    : canManage ? newestFirst.find((item) => item.status === 'draft') ?? newestFirst.find((item) => item.has_draft) ?? newestFirst.find((item) => item.status === 'published')
      : newestFirst.find((item) => item.status === 'published')
  const rosterDate = date ?? (selected ? selected.starts_on : defaultDate)
  const workspace = await api.workspace(season.id, selected?.id, rosterDate)
  const editing = canManage && season.end_date >= today && (newProposal || !selected || selected.has_draft || selected.status === 'draft')
  const assignments = selected ? workspace.draft ?? workspace.members.map(({ player_id, color }) => ({ player_id, color }))
    : newProposal ? generateTrainingGroups(workspace.candidates, workspace.members) : []
  return { summary, workspace, selectedId: selected?.id, rosterDate, assignments, editing }
}

