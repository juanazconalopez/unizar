import { beforeEach, describe, expect, test, vi } from 'vitest'
import { makeMembership, makeProfile, makeSeason } from '../test/fixtures'

const mocks = vi.hoisted(() => ({ eq: vi.fn(), from: vi.fn(), update: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))

import { setSeasonMembership } from './trainingService'

describe('season membership persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.eq.mockResolvedValue({ error: null })
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockReturnValue({ update: mocks.update })
  })

  test('never closes a historical membership after its season end', async () => {
    const season = makeSeason({ end_date: '2026-06-30' })
    const membership = makeMembership({ active_until: null })

    await setSeasonMembership(season, makeProfile(), false, membership)

    expect(mocks.update).toHaveBeenCalledWith({ active_until: '2026-06-30' })
    expect(mocks.eq).toHaveBeenCalledWith('id', membership.id)
  })
})
