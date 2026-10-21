import { describe, expect, test } from 'vitest'
import { createDemoWorkGroupStore } from './demoWorkGroups'
import { poolMembers, proposeVideoAssignments } from './videoAssignments'
import { VIDEO_POOLS } from './workGroupConfig'
import { workGroupCandidates } from './workGroupSelectors'
import { makeMembership, makeProfile, makeSeason } from '../../test/fixtures'

test('los grupos de trabajo admiten entrenadores y cualquier ficha, y respetan actividad y vinculación', () => {
  const season = makeSeason()
  const profiles = ['player','training','none','coach','expired','other-season','inactive'].map((id) => makeProfile({ id, is_player: id !== 'coach', is_coach: id === 'coach', is_active: id !== 'inactive' }))
  const memberships = profiles.filter((profile) => profile.is_player).map((profile) => makeMembership({ player_id: profile.id, season_id: profile.id === 'other-season' ? 'other' : season.id, active_until: profile.id === 'expired' ? '2026-08-01' : null, license_type: profile.id === 'none' ? 'none' : profile.id === 'training' ? 'training' : 'regional' }))
  expect(workGroupCandidates(profiles, memberships, season, '2026-10-21').map((profile) => profile.id)).toEqual(['player','training','none','coach'])
})

describe('reparto de vídeo análisis por partido', () => {
  test('conserva 43 integrantes, agrupa Cámara/Fichas/Entrenadores y da más repeticiones a grupos grandes', () => {
    const store = createDemoWorkGroupStore()
    expect(store.members).toHaveLength(43)
    expect(poolMembers('staff', store.members)).toHaveLength(6)
    expect(store.matches).toHaveLength(15)
    expect(new Set(store.assignments.map((entry) => entry.match_id)).size).toBe(15)
    const counts = VIDEO_POOLS.map((pool) => ({ key: pool.key, size: poolMembers(pool.key, store.members).length, count: store.assignments.filter((entry) => entry.pool_key === pool.key).length }))
    expect(counts.every((pool) => pool.count >= 1)).toBe(true)
    expect(counts.find((pool) => pool.key === 'material')!.count).toBeGreaterThan(counts.find((pool) => pool.key === 'eventos')!.count)
    expect(store.assignments.find((entry) => entry.match_id === store.initial_derby_id)).toMatchObject({ pool_key: 'merchan', locked: true })
  })
  test('dos partidos de la misma jornada en distintas fechas mantienen su propia responsabilidad', () => {
    const { matches, members } = createDemoWorkGroupStore()
    const round2 = matches.filter((match) => match.notes === 'Jornada 2')
    const assignments = proposeVideoAssignments(matches, members, [])
    expect(round2.map((match) => match.match_date)).toEqual(['2026-11-07', '2026-12-12'])
    expect(new Set(round2.map((match) => assignments.find((entry) => entry.match_id === match.id)!.pool_key)).size).toBe(2)
  })
  test('respeta lo guardado al reprogramar e incorporar nuevos partidos, incluso al mover el derbi inicial después del segundo', () => {
    const store = createDemoWorkGroupStore()
    const matches = [...store.matches.map((match) => match.id === store.initial_derby_id ? { ...match, match_date: '2027-04-30' } : match), { ...store.matches[1], id: 'new-match', match_date: '2027-05-01' }]
    const next = proposeVideoAssignments(matches, store.members, store.assignments, store.initial_derby_id)
    for (const entry of store.assignments) expect(next).toContainEqual(entry)
    expect(next).toHaveLength(16)
  })
  test('no traslada la reserva de Merchan al segundo derbi cuando el inicial está cancelado', () => {
    const store = createDemoWorkGroupStore()
    const matches = store.matches.filter((match) => match.id !== store.initial_derby_id)
    const next = proposeVideoAssignments(matches, store.members, store.assignments, store.initial_derby_id)
    expect(next).toEqual(store.assignments.filter((entry) => entry.match_id !== store.initial_derby_id))
  })
  test('excluye grupos vacíos de las nuevas propuestas y admite una plantilla vacía', () => {
    const store = createDemoWorkGroupStore()
    const members = store.members.filter((member) => member.group_key === 'material')
    const matches = store.matches.filter((match) => !match.internal_fixture_id)
    expect(proposeVideoAssignments(matches, members, []).every((entry) => entry.pool_key === 'material')).toBe(true)
    expect(proposeVideoAssignments(matches, [], [])).toEqual([])
  })
})
