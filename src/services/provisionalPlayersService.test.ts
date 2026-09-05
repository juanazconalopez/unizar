import { beforeEach, describe, expect, test, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { linkProvisionalPlayers } from './provisionalPlayersService'

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}))

describe('provisionalPlayersService', () => {
  beforeEach(() => vi.mocked(supabase.rpc).mockReset())

  test('links all selected provisional histories through the owner RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: undefined, error: null } as never)

    await linkProvisionalPlayers(['guest-1', 'guest-2'], 'player-1')

    expect(supabase.rpc).toHaveBeenCalledWith('link_provisional_players', {
      checked_provisional_player_ids: ['guest-1', 'guest-2'],
      checked_profile_id: 'player-1',
    })
  })
})
