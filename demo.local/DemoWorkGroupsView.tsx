import { useMemo } from 'react'
import { WorkGroupsView } from '../src/features/workGroups/WorkGroupsView'
import { createDemoWorkGroupsApi } from '../src/features/workGroups/demoWorkGroups'
import { workGroupCandidates } from '../src/features/workGroups/workGroupSelectors'
import type { WorkGroupsApi, WorkGroupWorkspace } from '../src/features/workGroups/types'
import { todayInMadridIso } from '../src/lib/dates'
import type { Profile, Season, SeasonPlayer } from '../src/types'

export function DemoWorkGroupsView({ stores, profiles, seasons, memberships, userId, canManage, mode, onBack }: {
  stores: Map<string, WorkGroupWorkspace>; profiles: Profile[]; seasons: Season[]; memberships: SeasonPlayer[];
  userId: string; canManage: boolean; mode: 'work' | 'video'; onBack?: () => void
}) {
  const api = useMemo<WorkGroupsApi>(() => {
    const forSeason = (seasonId: string) => {
      let store = stores.get(seasonId)
      if (!store) {
        store = { version: 0, initial_derby_id: null, members: [], candidates: [], matches: [], assignments: [] }
        stores.set(seasonId, store)
      }
      const season = seasons.find((item) => item.id === seasonId)
      return createDemoWorkGroupsApi(store, canManage, season ? workGroupCandidates(profiles, memberships, season, todayInMadridIso()) : [])
    }
    return {
      load: (id) => forSeason(id).load(id),
      saveMembers: (id, version, members) => forSeason(id).saveMembers(id, version, members),
      saveAssignments: (id, version, assignments) => forSeason(id).saveAssignments(id, version, assignments),
    }
  }, [stores, profiles, seasons, memberships, canManage])
  return <WorkGroupsView seasons={seasons} userId={userId} canManage={canManage} mode={mode} api={api} onBack={onBack} />
}
