import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), select: vi.fn(), in: vi.fn(), order: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))

import { createSeasonCompetition, deleteSeasonCompetition, fetchSeasonCompetitions, setDefaultSeasonCompetition, updateSeasonCompetition } from './seasonCompetitionsService'

describe('seasonCompetitionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.select.mockReturnValue({ in: mocks.in })
    mocks.in.mockReturnValue({ order: mocks.order })
    mocks.order.mockResolvedValue({ data: [], error: null })
    mocks.rpc.mockResolvedValue({ data: null, error: null })
  })

  test('loads competitions with their match counts', async () => {
    mocks.order.mockResolvedValueOnce({ data: [{ id: 'competition-1', season_id: 'season-1', name: 'Liga Aragonesa', color: 'purple', is_default: true, created_by: 'owner-1', created_at: '2026-09-01', updated_at: '2026-09-01', matches: [{ count: 4 }] }], error: null })
    await expect(fetchSeasonCompetitions(['season-1'])).resolves.toEqual([expect.objectContaining({ id: 'competition-1', color: 'purple', match_count: 4 })])
    expect(mocks.in).toHaveBeenCalledWith('season_id', ['season-1'])
  })

  test('uses protected functions for all competition mutations', async () => {
    await createSeasonCompetition('season-1', { name: '  Copa Aragón  ', color: 'orange' })
    await updateSeasonCompetition('competition-1', { name: 'Liga Catalana', color: 'blue' })
    await setDefaultSeasonCompetition('competition-1')
    mocks.rpc.mockResolvedValueOnce({ data: 2, error: null })
    await expect(deleteSeasonCompetition('competition-1')).resolves.toBe(2)

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'create_season_competition', { checked_season_id: 'season-1', checked_name: 'Copa Aragón', checked_color: 'orange' })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'update_season_competition', { checked_competition_id: 'competition-1', checked_name: 'Liga Catalana', checked_color: 'blue' })
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, 'set_default_season_competition', { checked_competition_id: 'competition-1' })
    expect(mocks.rpc).toHaveBeenNthCalledWith(4, 'delete_season_competition', { checked_competition_id: 'competition-1' })
  })
})
