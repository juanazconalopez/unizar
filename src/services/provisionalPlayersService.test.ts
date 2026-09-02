import { beforeEach, describe, expect, test, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { linkProvisionalPlayer } from './provisionalPlayersService'

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}))

describe('provisionalPlayersService', () => {
  beforeEach(() => vi.mocked(supabase.rpc).mockReset())

  test('links the selected provisional history through the owner RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: undefined, error: null } as never)

    await linkProvisionalPlayer('guest-1', 'player-1')

    expect(supabase.rpc).toHaveBeenCalledWith('link_provisional_player', {
      checked_provisional_player_id: 'guest-1',
      checked_profile_id: 'player-1',
    })
  })
})
