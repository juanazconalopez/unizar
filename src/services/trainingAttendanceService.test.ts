import { beforeEach, describe, expect, test, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { saveTrainingAttendance } from './trainingService'

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}))

describe('saveTrainingAttendance', () => {
  beforeEach(() => vi.mocked(supabase.rpc).mockReset())

  test('sends the whole attendance update through the atomic database function', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: undefined, error: null } as never)

    await saveTrainingAttendance('2026-08-10', ['player-1', 'player-2'], ['player-2'])

    expect(supabase.rpc).toHaveBeenCalledWith('save_training_attendance', {
      attendance_date: '2026-08-10',
      checked_player_ids: ['player-1', 'player-2'],
      attended_player_ids: ['player-2'],
    })
  })
})
