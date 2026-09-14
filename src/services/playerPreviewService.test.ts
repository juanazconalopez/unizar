import { describe, expect, test, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { rpc, from } }))
import { fetchPlayerPreview, fetchPlayerPreviewSurveyClosures } from './playerPreviewService'

describe('playerPreviewService', () => {
  test('validates the owner and target before loading preview data', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null })

    await expect(fetchPlayerPreview('player-1')).rejects.toThrow('No tienes permiso para abrir esta vista previa.')
    expect(rpc).toHaveBeenCalledWith('can_preview_player', { checked_player_id: 'player-1' })
    expect(from).not.toHaveBeenCalled()
  })

  test('loads shared survey closures for the player preview calendar', async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: 'survey-1', title: 'Valoración semanal', result_date: '2026-09-15' }], error: null })

    await expect(fetchPlayerPreviewSurveyClosures('player-1', '2026-09-01', '2026-09-30')).resolves.toEqual([
      { id: 'survey-1', title: 'Valoración semanal', result_date: '2026-09-15' },
    ])
    expect(rpc).toHaveBeenCalledWith('get_player_preview_survey_closures', {
      checked_player_id: 'player-1', checked_from: '2026-09-01', checked_until: '2026-09-30',
    })
  })
})
