import { beforeEach, describe, expect, test, vi } from 'vitest'
import { makeMatch } from '../test/fixtures'
import type { MatchReportValues } from '../lib/matchMinutes'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), storageFrom: vi.fn(), order: vi.fn(), eq: vi.fn(), select: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from, storage: { from: mocks.storageFrom } } }))
import { loadMatchReportEvents, saveMatchReport } from './matchReportService'

const values: MatchReportValues = { scores: { team: 46, opponent: 7 }, duration: 80, events: [{ event_type: 'substitution', event_minute: 55, player_id: 'player-1', replacement_player_id: 'player-2', return_minute: null }] }

describe('match report data persistence', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ error: null }) })
  test('sends only reviewed result data through the atomic RPC without storage operations', async () => {
    await saveMatchReport(makeMatch(), values)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('save_match_report', { checked_match_id: 'match-1', checked_team_score: 46, checked_opponent_score: 7, checked_duration: 80, checked_events: values.events })
    expect(mocks.storageFrom).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
  test('propagates save errors without additional writes', async () => {
    mocks.rpc.mockResolvedValue({ error: new Error('Sin conexión') })
    await expect(saveMatchReport(makeMatch(), values)).rejects.toThrow('Sin conexión')
    expect(mocks.storageFrom).not.toHaveBeenCalled()
  })
  test('loads only event fields in chronological order, retaining order at the same minute', async () => {
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ order: mocks.order })
    mocks.order.mockReturnValueOnce({ order: mocks.order }).mockResolvedValueOnce({ data: values.events, error: null })
    expect(await loadMatchReportEvents('match-1')).toEqual(values.events)
    expect(mocks.eq).toHaveBeenCalledWith('match_id', 'match-1')
    expect(mocks.order.mock.calls).toEqual([['event_minute'], ['sort_order']])
    expect(mocks.storageFrom).not.toHaveBeenCalled()
  })
})
