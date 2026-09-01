import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

import { updateManagedProfileDetails, updateOwnProfileDetails } from './profilesService'

describe('profile persistence', () => {
  beforeEach(() => vi.clearAllMocks())

  test('updates the authenticated profile details through the restricted function', async () => {
    mocks.rpc.mockResolvedValue({ data: undefined, error: null })
    await expect(updateOwnProfileDetails({ displayName: 'María López', phone: '+34 600 123 123', birthDate: '1997-05-12' })).resolves.toBeUndefined()
    expect(mocks.rpc).toHaveBeenCalledWith('update_own_profile_details', {
      new_display_name: 'María López', new_phone: '+34 600 123 123', new_birth_date: '1997-05-12',
    })
  })

  test('lets the owner update another profile without sending an email', async () => {
    mocks.rpc.mockResolvedValue({ data: undefined, error: null })
    await expect(updateManagedProfileDetails('player-2', {
      displayName: 'Lucía Pérez', phone: '+34 611 222 333', birthDate: '1999-10-02',
    })).resolves.toBeUndefined()
    expect(mocks.rpc).toHaveBeenCalledWith('update_profile_details_as_owner', {
      checked_profile_id: 'player-2',
      new_display_name: 'Lucía Pérez',
      new_phone: '+34 611 222 333',
      new_birth_date: '1999-10-02',
    })
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('email')
  })
})
