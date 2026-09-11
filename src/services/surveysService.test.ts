import { describe, expect, test, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))
import { fetchMyPendingSurveys } from './surveysService'

describe('surveysService', () => {
  test('loads only the pending surveys returned by the protected RPC', async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: 'survey-1', title: 'Consulta' }], error: null })
    await expect(fetchMyPendingSurveys()).resolves.toEqual([{ id: 'survey-1', title: 'Consulta' }])
    expect(rpc).toHaveBeenCalledWith('get_my_pending_surveys')
  })
})
