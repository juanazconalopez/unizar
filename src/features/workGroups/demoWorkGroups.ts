import { INITIAL_WORK_MEMBERS, WORK_GROUPS } from './workGroupConfig'
import { firstDerby, proposeVideoAssignments } from './videoAssignments'
import type { VideoMatch, WorkGroupsApi, WorkGroupWorkspace } from './types'

// Escenario de la demo: calendario consultado el 21/10/2026, con jornadas
// reprogramadas y las dos fichas de cada derbi representadas una sola vez.
const schedule = [
  ['2026-10-17', 'Unizar Femenino A vs CEFA Unizar B', '1', 'derby-1'],
  ['2026-11-07', 'Ibero CR vs CEFA Unizar B', '2'],
  ['2026-11-21', 'Ibero CR vs Unizar Femenino A', '3'],
  ['2026-12-12', 'Unizar Femenino A vs Fénix CR', '2'],
  ['2026-12-19', 'CEFA Unizar B vs Fénix CR', '4'],
  ['2026-12-19', 'Ingenieros de Soria vs Unizar Femenino A', '4'],
  ['2027-01-17', 'CEFA Unizar B vs Ingenieros de Soria', '5'],
  ['2027-01-30', 'Fénix CR vs CEFA Unizar B', '6'],
  ['2027-02-06', 'Unizar Femenino A vs Ingenieros de Soria', '7'],
  ['2027-02-20', 'CEFA Unizar B vs Ibero CR', '8'],
  ['2027-03-07', 'Fénix CR vs Unizar Femenino A', '8'],
  ['2027-03-13', 'Unizar Femenino A vs Ibero CR', '9'],
  ['2027-03-13', 'Ingenieros de Soria vs CEFA Unizar B', '9'],
  ['2027-03-20', 'CEFA Unizar B vs Unizar Femenino A', '10', 'derby-10'],
  ['2027-04-17', 'Unizar Femenino A vs FINAL femenina', ''],
]

export function createDemoWorkGroupStore(): WorkGroupWorkspace {
  const members = WORK_GROUPS.flatMap((group) => INITIAL_WORK_MEMBERS[group.key].map((display_name) => ({ id: crypto.randomUUID(), group_key: group.key, profile_id: null, display_name })))
  const matches: VideoMatch[] = schedule.map(([match_date, title, round, derby], index) => ({
    id: `demo-video-${String(index).padStart(2, '0')}`, match_date, title, notes: round ? `Jornada ${round}` : 'Final',
    internal_fixture_id: derby ?? null, kickoff_time: index === 0 ? '14:30:00' : null, competition: 'Liga Aragonesa', status: 'published',
  }))
  return { version: 1, initial_derby_id: firstDerby(matches)?.id ?? null, members, candidates: [], matches, assignments: proposeVideoAssignments(matches, members, []) }
}

export function createDemoWorkGroupsApi(store: WorkGroupWorkspace, canManage: boolean, candidates: WorkGroupWorkspace['candidates']): WorkGroupsApi {
  function check(version: number) {
    if (!canManage) throw new Error('Solo el owner puede organizar estos grupos.')
    if (store.version !== version) throw new Error('El reparto ha cambiado. Vuelve a abrir la sección antes de guardar.')
  }
  return {
    async load() { return structuredClone({ ...store, candidates: canManage ? candidates : [] }) },
    async saveMembers(_seasonId, version, members) { check(version); store.members = structuredClone(members); store.version += 1 },
    async saveAssignments(_seasonId, version, assignments) {
      check(version)
      if (store.initial_derby_id && !assignments.some((entry) => entry.match_id === store.initial_derby_id && entry.pool_key === 'merchan')) throw new Error('El derbi inicial debe seguir asignado a Merchan.')
      store.assignments = structuredClone(assignments); store.version += 1
    },
  }
}
