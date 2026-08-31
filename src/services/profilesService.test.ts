import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

import { updateOwnProfileDetails } from './profilesService'

describe('profile persistence', () => {
  beforeEach(() => vi.clearAllMocks())

  test('updates the authenticated profile details through the restricted function', async () => {
    mocks.rpc.mockResolvedValue({ data: undefined, error: null })
    await expect(updateOwnProfileDetails({ displayName: 'María López', phone: '+34 600 123 123', birthDate: '1997-05-12' })).resolves.toBeUndefined()
    expect(mocks.rpc).toHaveBeenCalledWith('update_own_profile_details', {
      new_display_name: 'María López', new_phone: '+34 600 123 123', new_birth_date: '1997-05-12',
    })
  })
})
