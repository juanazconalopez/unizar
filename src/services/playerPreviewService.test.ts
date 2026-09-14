import { describe, expect, test, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { rpc, from } }))
import { fetchPlayerPreview } from './playerPreviewService'

describe('playerPreviewService', () => {
  test('validates the owner and target before loading preview data', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null })

    await expect(fetchPlayerPreview('player-1')).rejects.toThrow('No tienes permiso para abrir esta vista previa.')
    expect(rpc).toHaveBeenCalledWith('can_preview_player', { checked_player_id: 'player-1' })
    expect(from).not.toHaveBeenCalled()
  })
})
