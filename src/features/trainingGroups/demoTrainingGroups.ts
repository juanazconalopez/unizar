import { addDays, todayInMadridIso } from '../../lib/dates'
import type { TrainingGroupsApi, TrainingGroupAssignment, TrainingGroupBlock, TrainingGroupMember, TrainingGroupPlayer } from './types'
import { currentTrainingGroupBlock } from './trainingGroupSelectors'
import { generateTrainingGroups } from './generateTrainingGroups'

export type DemoTrainingGroupStore = {
  blocks: Array<TrainingGroupBlock & { draft: TrainingGroupAssignment[] | null }>
  members: Record<string, Array<TrainingGroupMember & { notified_at: string }>>
}

// Plantilla ampliada solo para este escenario. No altera los partidos ni la asistencia de la demo.
export function demoExtraGroupPlayers(): TrainingGroupPlayer[] {
  const names = ['Alba Navarro','Ana Beltrán','Andrea Gil','Beatriz Torres','Carla Romero','Celia Ortiz','Daniela Sanz','Elisa Rubio','Eva Molina','Irene Pascual','Julia Moreno','Lara Medina','Lucía Ramos','María Vidal','Nadia Ferrer','Noa Cortés','Olivia Rivas','Paula Soler','Raquel León','Rocío Vega','Silvia Marín','Teresa Cano','Valeria Peña','Vera Santos','Inés Costa','Alicia Rey']
  return names.map((display_name, index) => ({
    player_id: `demo-group-player-${index}`, display_name,
    team_id: index < 11 ? 'demo-group-a' : index < 22 ? 'demo-group-b' : index < 24 ? 'demo-group-mixed' : null,
    team_name: index < 11 ? 'Equipo A' : index < 22 ? 'Equipo B' : index < 24 ? 'Mixto' : 'Solo entrenamientos',
    position_group: index === 23 ? 'unassigned' : index % 2 === 0 ? 'forwards' : 'backs',
  }))
}

export function createDemoTrainingGroupStore(seasonId: string, seasonStart: string, players: TrainingGroupPlayer[]): DemoTrainingGroupStore {
  const today = todayInMadridIso()
  const startsOn = addDays(today, -22) < seasonStart ? seasonStart : addDays(today, -22)
  const created = `${startsOn}T10:00:00.000Z`
  const block = { id: 'demo-training-group-current', season_id: seasonId, starts_on: startsOn, status: 'published' as const, created_at: created, published_at: created, version: 1, has_draft: false, draft: null }
  const assignments = generateTrainingGroups(players)
  return { blocks: [block], members: { [block.id]: assignments.map((entry) => ({ ...players.find((player) => player.player_id === entry.player_id)!, ...entry, notified_at: created })) } }
}

export function createDemoTrainingGroupsApi({ store, playersOn, userId, canManage, canPublish, seasonEnd }: {
  store: DemoTrainingGroupStore; playersOn: (seasonId: string, date: string) => TrainingGroupPlayer[]; userId: string; canManage: boolean; canPublish: boolean; seasonEnd: (seasonId: string) => string
}): TrainingGroupsApi {
  const today = todayInMadridIso()
  function checkedBlock(id: string, version: number) {
    if (!canManage) throw new Error('No tienes permiso para preparar grupos.')
    const block = store.blocks.find((item) => item.id === id)
    if (!block) throw new Error('No se ha encontrado el reparto.')
    if (block.version !== version) throw new Error('Otro entrenador ha modificado el reparto. Recarga para revisar sus cambios.')
    return block
  }
  return {
    async summary(seasonId) {
      const blocks = store.blocks.filter((block) => block.season_id === seasonId && (canManage || block.status === 'published')).sort((a, b) => b.starts_on.localeCompare(a.starts_on))
      const current = currentTrainingGroupBlock(blocks, today)
      const next = blocks.filter((block) => block.status === 'published' && block.starts_on > today).at(-1)
      return {
        blocks: blocks.map(({ draft, ...block }) => ({ ...block, has_draft: canManage && draft !== null })),
        own_groups: [current, next].flatMap((block) => {
          if (!block || today > seasonEnd(seasonId) || !playersOn(seasonId, block.starts_on > today ? block.starts_on : today).some((player) => player.player_id === userId)) return []
          const member = store.members[block.id]?.find((entry) => entry.player_id === userId)
          return member ? [{ block_id: block.id, starts_on: block.starts_on, color: member.color, notified_at: member.notified_at }] : []
        }),
      }
    },
    async workspace(seasonId, blockId, date) {
      const block = blockId ? store.blocks.find((item) => item.id === blockId && item.season_id === seasonId) : currentTrainingGroupBlock(store.blocks.filter((item) => item.season_id === seasonId), today)
      if (block?.status === 'draft' && !canManage) throw new Error('No tienes permiso para consultar este borrador.')
      const effectiveDate = blockId && block?.status === 'published' ? block.starts_on > today ? block.starts_on : today > seasonEnd(seasonId) ? seasonEnd(seasonId) : today : date
      const candidates = playersOn(seasonId, effectiveDate)
      const current = currentTrainingGroupBlock(store.blocks.filter((item) => item.season_id === seasonId), today)
      const historical = block && (today > seasonEnd(seasonId) || current && current.starts_on > block.starts_on)
      const members = block ? (store.members[block.id] ?? []).filter((member) => historical || candidates.some((player) => player.player_id === member.player_id)) : []
      const draft = blockId && canManage ? store.blocks.find((item) => item.id === blockId)?.draft ?? null : null
      return { candidates: canManage ? candidates : [], members, draft }
    },
    async saveDraft(values) {
      if (!canManage) throw new Error('No tienes permiso para preparar grupos.')
      const block = values.blockId ? checkedBlock(values.blockId, values.expectedVersion!) : undefined
      if (!block && store.blocks.some((item) => item.season_id === values.seasonId && item.status === 'draft')) throw new Error('Ya hay un borrador pendiente.')
      if (store.blocks.some((item) => item.id !== block?.id && item.season_id === values.seasonId && item.starts_on === values.startsOn)) throw new Error('Ya existe un reparto para esa fecha.')
      const eligible = new Set(playersOn(values.seasonId, values.startsOn > today ? values.startsOn : today).map((player) => player.player_id))
      if (values.members.length > 2000 || new Set(values.members.map((entry) => entry.player_id)).size !== values.members.length || values.members.some((entry) => !['red', 'white'].includes(entry.color))) throw new Error('Revisa las jugadoras y los colores del reparto.')
      if (values.members.some((entry) => !eligible.has(entry.player_id))) throw new Error('La plantilla ha cambiado. Actualiza las jugadoras elegibles.')
      if (block) { block.draft = structuredClone(values.members); block.version += 1; block.has_draft = true; block.starts_on = values.startsOn; return block.id }
      const id = crypto.randomUUID()
      store.blocks.unshift({ id, season_id: values.seasonId, starts_on: values.startsOn, status: 'draft', created_at: new Date().toISOString(), published_at: null, version: 1, has_draft: true, draft: structuredClone(values.members) })
      return id
    },
    async publish(id, version) {
      if (!canPublish) throw new Error('No tienes permiso para publicar grupos.')
      const block = checkedBlock(id, version)
      const candidates = playersOn(block.season_id, block.starts_on > today ? block.starts_on : today)
      if (!block.draft || block.draft.length > 2000 || new Set(block.draft.map((entry) => entry.player_id)).size !== block.draft.length || block.draft.some((entry) => !['red', 'white'].includes(entry.color) || !candidates.some((player) => player.player_id === entry.player_id))) throw new Error('La plantilla ha cambiado. Actualiza el borrador antes de publicar.')
      const lastNotification = Object.values(store.members).flat().reduce((latest, member) => Math.max(latest, Date.parse(member.notified_at)), 0)
      const now = new Date(Math.max(Date.now(), lastNotification + 1)).toISOString()
      store.members[id] = block.draft.map((entry) => ({ ...candidates.find((player) => player.player_id === entry.player_id)!, ...entry, notified_at: now }))
      block.status = 'published'; block.has_draft = false; block.draft = null; block.published_at = now; block.version += 1
    },
    async discardDraft(id, version) {
      const block = checkedBlock(id, version)
      if (block.status === 'draft') { store.blocks = store.blocks.filter((item) => item.id !== id); delete store.members[id] }
      else { block.draft = null; block.has_draft = false; block.version += 1 }
    },
  }
}
