import { VIDEO_POOLS } from './workGroupConfig'
import type { VideoAssignment, VideoMatch, WorkGroupMember } from './types'

export function poolMembers(key: string, members: WorkGroupMember[]) {
  const pool = VIDEO_POOLS.find((item) => item.key === key)
  return members.filter((member) => pool?.groups.includes(member.group_key))
}

export function firstDerby(matches: VideoMatch[]) {
  return [...matches].filter((match) => match.internal_fixture_id).sort(compareVideoMatches)[0]
}

export function compareVideoMatches(a: VideoMatch, b: VideoMatch) {
  return a.match_date.localeCompare(b.match_date) || (a.kickoff_time ?? '').localeCompare(b.kickoff_time ?? '') || a.id.localeCompare(b.id)
}

// Conserva lo guardado: ni reprogramar ni añadir partidos rehace responsabilidades.
// Primero participa cada grupo; después repiten más los grupos de mayor tamaño.
export function proposeVideoAssignments(matches: VideoMatch[], members: WorkGroupMember[], saved: VideoAssignment[], initialDerbyId?: string | null): VideoAssignment[] {
  const ordered = [...matches].sort(compareVideoMatches)
  const derby = initialDerbyId !== undefined ? matches.find((match) => match.id === initialDerbyId)
    : matches.find((match) => saved.some((entry) => entry.match_id === match.id && entry.locked)) ?? firstDerby(matches)
  const result = saved.filter((entry) => matches.some((match) => match.id === entry.match_id))
    .map((entry) => entry.match_id === derby?.id ? { ...entry, pool_key: 'merchan' as const, locked: true } : entry)
  if (derby && !result.some((entry) => entry.match_id === derby.id)) result.push({ match_id: derby.id, pool_key: 'merchan', locked: true })
  for (const match of ordered) {
    if (result.some((entry) => entry.match_id === match.id)) continue
    const pools = VIDEO_POOLS.map((pool, order) => ({ ...pool, order, size: poolMembers(pool.key, members).length, count: result.filter((entry) => entry.pool_key === pool.key).length }))
      .filter((pool) => pool.size > 0)
    const unused = pools.find((pool) => pool.count === 0)
    const chosen = unused ?? pools.sort((a, b) => (a.count + 1) / a.size - (b.count + 1) / b.size || b.size - a.size || a.order - b.order)[0]
    if (chosen) result.push({ match_id: match.id, pool_key: chosen.key })
  }
  return result.sort((a, b) => ordered.findIndex((match) => match.id === a.match_id) - ordered.findIndex((match) => match.id === b.match_id))
}

export function normalizedMemberName(name: string) {
  return name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLocaleLowerCase('es')
}
