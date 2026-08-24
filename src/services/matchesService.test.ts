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

import { createMatch, deleteMatch, fetchPlayerSeasonSummary, fetchSeasonCallupReport, saveMatchAvailability, saveMatchLineup, setPlayerMatchAvailability, unlockMatchLineup, updateMatch } from './matchesService'

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

    await unlockMatchLineup('match-1')
    expect(mocks.rpc).toHaveBeenCalledWith('unlock_match_lineup', { checked_match_id: 'match-1' })

    await setPlayerMatchAvailability('match-1', 'player-1', 'unavailable', '  Baja comunicada  ')
    expect(mocks.rpc).toHaveBeenCalledWith('set_player_match_availability', {
      checked_match_id: 'match-1', checked_player_id: 'player-1', checked_status: 'unavailable', checked_comment: 'Baja comunicada',
    })
  })

  test('deletes only the requested match', async () => {
    await deleteMatch('match-1')
    expect(mocks.delete).toHaveBeenCalledOnce()
    expect(mocks.eq).toHaveBeenCalledWith('id', 'match-1')
  })

  test('loads the accumulated report through its protected database function', async () => {
    const report = { seasonId: 'season-1', seasonName: '2026', generatedOn: '2026-08-14', totals: { officialMatches: 1, friendlyMatches: 0, trainingSessions: 2 }, players: [] }
    mocks.rpc.mockResolvedValueOnce({ data: report, error: null })

    await expect(fetchSeasonCallupReport('season-1')).resolves.toEqual(report)
    expect(mocks.rpc).toHaveBeenCalledWith('get_season_callup_report', { checked_season_id: 'season-1' })
  })

  test('loads one player season summary through its protected database function', async () => {
    const summary = { seasonId: 'season-1', playerId: 'player-1', matches: [] }
    mocks.rpc.mockResolvedValueOnce({ data: summary, error: null })

    await expect(fetchPlayerSeasonSummary('season-1', 'player-1')).resolves.toEqual(summary)
    expect(mocks.rpc).toHaveBeenCalledWith('get_player_season_summary', {
      checked_season_id: 'season-1', checked_player_id: 'player-1',
    })
  })
})
