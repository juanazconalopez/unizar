import { describe, expect, test } from 'vitest'
import { makeMembership, makeProfile, makeSeason, makeSeasonTeam } from '../../test/fixtures'
import type { TrainingGroupAssignment, TrainingGroupBlock, TrainingGroupPlayer } from './types'
import { eligibleTrainingGroupPlayers, currentTrainingGroupBlock, trainingGroupBalance, trainingGroupBucket, trainingGroupRenewal } from './trainingGroupSelectors'
import { generateTrainingGroups, reconcileTrainingGroups } from './generateTrainingGroups'

function randomSource(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
}
const players: TrainingGroupPlayer[] = Array.from({ length: 59 }, (_, index) => ({
  player_id: `p-${index}`, display_name: `Jugadora ${index}`, team_id: index < 27 ? 'a' : index < 48 ? 'b' : index < 53 ? 'mixed' : null,
  team_name: `Equipo ${index < 27 ? 'A' : index < 48 ? 'B' : index < 53 ? 'Mixto' : 'Solo entrenamientos'}`,
  position_group: index % 11 === 0 ? 'unassigned' : index % 3 === 0 ? 'backs' : 'forwards',
}))

describe('training group eligibility', () => {
  test('excludes Sin ficha and federated players without a team; includes training-only and accumulated player roles', () => {
    const profiles = ['regional','national','training','none','orphan','coach','inactive','archived','unapproved','expired'].map((id) => makeProfile({
      id, display_name: id, primary_position: id === 'training' ? 'wing' : 'prop',
      is_coach: id === 'coach', is_active: id !== 'inactive', is_archived: id === 'archived', is_approved: id !== 'unapproved',
    }))
    const memberships = profiles.map((profile) => makeMembership({ player_id: profile.id, season_team_id: ['training','none','orphan'].includes(profile.id) ? null : 'team-1',
      license_type: profile.id === 'training' ? 'training' : profile.id === 'none' ? 'none' : profile.id === 'national' ? 'national' : 'regional', active_until: profile.id === 'expired' ? '2026-09-01' : null }))
    const roster = eligibleTrainingGroupPlayers(profiles, memberships, [makeSeasonTeam({ id: 'team-1' })], makeSeason(), '2026-10-21')
    expect(roster.map((player) => player.player_id)).toEqual(['coach','national','regional','training'])
    expect(roster.find((player) => player.player_id === 'training')).toMatchObject({ team_id: null, team_name: 'Solo entrenamientos', position_group: 'backs' })
    expect(roster.find((player) => player.player_id === 'regional')).toMatchObject({ position_group: 'forwards' })
  })
  test('uses only the latest covered team period if historical periods overlap', () => {
    const membership = makeMembership({ season_team_id: 'team-old', active_from: '2026-01-01', active_until: '2026-10-21' })
    const next = makeMembership({ id: 'period-new', season_team_id: 'team-new', active_from: '2026-10-21' })
    const roster = eligibleTrainingGroupPlayers([makeProfile()], [membership, next], [makeSeasonTeam({ id: 'team-old' }), makeSeasonTeam({ id: 'team-new', name: 'Equipo B' })], makeSeason(), '2026-10-21')
    expect(roster).toHaveLength(1)
    expect(roster[0].team_name).toBe('Equipo B')
  })
  test('respects season boundaries even when membership is open, and never includes staff-only profiles', () => {
    expect(eligibleTrainingGroupPlayers([makeProfile()], [makeMembership()], [makeSeasonTeam({ id: 'team-1' })], makeSeason(), '2027-01-01')).toEqual([])
    expect(eligibleTrainingGroupPlayers([makeProfile({ is_player: false, is_coach: true })], [makeMembership()], [makeSeasonTeam({ id: 'team-1' })], makeSeason(), '2026-10-21')).toEqual([])
  })
})

describe('balanced distribution', () => {
  test('balances totals, each team and every team-position bucket over many random proposals', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const assignments = generateTrainingGroups(players, [], randomSource(seed))
      expect(assignments).toHaveLength(players.length)
      expect(new Set(assignments.map((entry) => entry.player_id)).size).toBe(players.length)
      expect(trainingGroupBalance(players, assignments).balanced).toBe(true)
      for (const position of ['forwards', 'backs', 'unassigned']) {
        const ids = new Set(players.filter((player) => player.position_group === position).map((player) => player.player_id))
        const red = assignments.filter((entry) => ids.has(entry.player_id) && entry.color === 'red').length
        expect(Math.abs(red - (ids.size - red))).toBeLessThanOrEqual(1)
      }
      for (const team of new Set(players.map((player) => player.team_id))) {
        const members = players.filter((player) => player.team_id === team)
        const red = assignments.filter((entry) => entry.color === 'red' && members.some((player) => player.player_id === entry.player_id)).length
        expect(Math.abs(red - (members.length - red))).toBeLessThanOrEqual(1)
      }
    }
  })
  test('changes teammates where the balance permits it, rather than only exchanging colors', () => {
    const sameBucket = players.slice(0, 12).map((player) => ({ ...player, team_id: 'a', position_group: 'forwards' as const }))
    const previous = sameBucket.map((player, index) => ({ player_id: player.player_id, color: index < 6 ? 'red' as const : 'white' as const }))
    const next = generateTrainingGroups(sameBucket, previous, randomSource(7))
    const red = new Set(next.filter((entry) => entry.color === 'red').map((entry) => entry.player_id))
    const previousRed = previous.filter((entry) => entry.color === 'red')
    const common = previousRed.filter((entry) => red.has(entry.player_id)).length
    expect(common).toBe(3)
    expect(trainingGroupBalance(sameBucket, next).balanced).toBe(true)
  })
  test('handles empty rosters and a single unpositioned player', () => {
    expect(generateTrainingGroups([])).toEqual([])
    expect(generateTrainingGroups(players.slice(0, 1))).toHaveLength(1)
  })
  test('assigns arrivals without reshuffling existing members and removes players who lose eligibility', () => {
    const initial = generateTrainingGroups(players.slice(0, 10), [], randomSource(3))
    const next = reconcileTrainingGroups(players.slice(1, 13), initial)
    expect(next).toHaveLength(12)
    expect(next.some((entry) => entry.player_id === players[0].player_id)).toBe(false)
    for (const entry of initial.slice(0).filter((entry) => entry.player_id !== players[0].player_id)) expect(next).toContainEqual(entry)
    expect(new Set(next.map((entry) => entry.player_id)).size).toBe(12)
    expect(trainingGroupBucket(players[0])).not.toBe(trainingGroupBucket(players[1]))
  })
})

const block = (id: string, starts_on: string, status: TrainingGroupBlock['status'] = 'published'): TrainingGroupBlock => ({ id, season_id: 'season-1', starts_on, status, created_at: '2026-10-01T10:00:00Z', published_at: status === 'published' ? '2026-10-01T10:00:00Z' : null, version: 1, has_draft: status === 'draft' })
describe('effective dates and renewal', () => {
  test('keeps the last published group past 21 days, ignores drafts and does not activate a future block early', () => {
    const blocks = [block('old','2026-09-01'), block('new','2026-10-26'),block('draft','2026-10-21','draft')]
    expect(currentTrainingGroupBlock(blocks,'2026-10-21')?.id).toBe('old')
    expect(currentTrainingGroupBlock(blocks,'2026-10-26')?.id).toBe('new')
    expect(trainingGroupRenewal(block('old','2026-09-01'),'2026-09-21')).toMatchObject({ overdue: false, soon: true })
    expect(trainingGroupRenewal(block('old','2026-09-01'),'2026-09-22')).toMatchObject({ overdue: true, weeks: 3, renewOn: '2026-09-22' })
  })
  test('manual changes are reflected in the balance warning', () => {
    const assignments: TrainingGroupAssignment[] = players.map((player) => ({ player_id: player.player_id, color: 'red' }))
    expect(trainingGroupBalance(players, assignments).balanced).toBe(false)
  })
})
