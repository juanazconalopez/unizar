import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Match, MatchLineup, MatchValues } from '../types'

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
}))

import { createMatch, deleteMatch, saveMatchAvailability, saveMatchLineup, updateMatch } from './matchesService'

const values: MatchValues = {
  seasonId: 'season-1',
  opponent: '  Fénix CR  ',
  matchDate: '2026-09-12',
  kickoffTime: '',
  venue: '  ',
  isHome: true,
  notes: '  Partido de liga  ',
  status: 'published',
  matchKind: 'official',
  rugbyFormat: 'xv',
}

describe('matchesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insert.mockResolvedValue({ error: null })
    mocks.eq.mockResolvedValue({ error: null })
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.delete.mockReturnValue({ eq: mocks.eq })
    mocks.upsert.mockResolvedValue({ error: null })
    mocks.rpc.mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({
      delete: mocks.delete,
      insert: mocks.insert,
      update: mocks.update,
      upsert: mocks.upsert,
    })
  })

  test('creates and updates matches with normalized optional values', async () => {
    await createMatch(values, 'owner-1')
    expect(mocks.insert).toHaveBeenCalledWith({
      season_id: 'season-1', opponent: 'Fénix CR', match_date: '2026-09-12',
      kickoff_time: null, venue: null, is_home: true, notes: 'Partido de liga',
      status: 'published', match_kind: 'official', rugby_format: 'xv', created_by: 'owner-1',
    })

    await updateMatch('match-1', values)
    expect(mocks.update).toHaveBeenCalledWith(expect.not.objectContaining({ created_by: expect.anything() }))
    expect(mocks.eq).toHaveBeenCalledWith('id', 'match-1')
  })

  test('persists availability and lineup through their database contracts', async () => {
    await saveMatchAvailability('match-1', 'player-1', 'doubt', '  Lesión leve  ')
    expect(mocks.upsert).toHaveBeenCalledWith({
      match_id: 'match-1', player_id: 'player-1', status: 'doubt', comment: 'Lesión leve',
    }, { onConflict: 'match_id,player_id' })

    const match = { id: 'match-1' } as Match
    const entries = [{ player_id: 'player-1', role: 'starter', position: null, slot_number: 1, sort_order: 1 }] satisfies Omit<MatchLineup, 'match_id' | 'updated_at'>[]
    await saveMatchLineup(match, entries, true)
    expect(mocks.rpc).toHaveBeenCalledWith('save_match_lineup', {
      checked_match_id: 'match-1', lineup_entries: entries, publish_lineup: true,
    })
  })

  test('deletes only the requested match', async () => {
    await deleteMatch('match-1')
    expect(mocks.delete).toHaveBeenCalledOnce()
    expect(mocks.eq).toHaveBeenCalledWith('id', 'match-1')
  })
})
