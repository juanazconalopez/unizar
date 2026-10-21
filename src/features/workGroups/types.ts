export type WorkGroupKey = 'botiquin' | 'equipaciones' | 'terceros' | 'eventos' | 'material' | 'merchan' | 'camara' | 'fichas' | 'entrenadores'
export type VideoPoolKey = Exclude<WorkGroupKey, 'camara' | 'fichas' | 'entrenadores'> | 'staff'
export type WorkGroupMember = { id: string; group_key: WorkGroupKey; profile_id: string | null; display_name: string }
export type VideoMatch = {
  id: string; match_date: string; kickoff_time: string | null; title: string; competition: string;
  notes: string | null; internal_fixture_id: string | null; status: 'published' | 'completed'
}
export type VideoAssignment = { match_id: string; pool_key: VideoPoolKey; locked?: boolean }
export type WorkGroupWorkspace = {
  initial_derby_id: string | null; version: number; members: WorkGroupMember[]; candidates: { id: string; display_name: string }[];
  matches: VideoMatch[]; assignments: VideoAssignment[]
}
export type WorkGroupsApi = {
  load: (seasonId: string) => Promise<WorkGroupWorkspace>
  saveMembers: (seasonId: string, version: number, members: WorkGroupMember[]) => Promise<void>
  saveAssignments: (seasonId: string, version: number, assignments: VideoAssignment[]) => Promise<void>
}
