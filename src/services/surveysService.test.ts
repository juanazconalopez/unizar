import { describe, expect, test, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))
import { fetchMyPendingSurveys, saveSurveyDraft } from './surveysService'

describe('surveysService', () => {
  test('loads only the pending surveys returned by the protected RPC', async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: 'survey-1', title: 'Consulta' }], error: null })
    await expect(fetchMyPendingSurveys()).resolves.toEqual([{ id: 'survey-1', title: 'Consulta' }])
    expect(rpc).toHaveBeenCalledWith('get_my_pending_surveys')
  })

  test('saves the description with the draft and normalizes its text', async () => {
    rpc.mockResolvedValueOnce({ data: 'survey-1', error: null })

    await expect(saveSurveyDraft({
      seasonId: 'season-1', title: '  Recuperación  ', description: '  Explica cómo te encuentras.  ', startsOn: '2026-09-15', endsOn: '2026-09-21', visibility: 'team',
      questions: [{ prompt: ' ¿Cómo te encuentras? ', type: 'single', required: true, options: [{ label: ' Bien ' }, { label: ' Cansada ' }] }],
    })).resolves.toBe('survey-1')

    expect(rpc).toHaveBeenCalledWith('save_survey_draft', expect.objectContaining({
      checked_title: 'Recuperación', checked_description: 'Explica cómo te encuentras.', checked_visibility: 'team',
      checked_questions: [{ prompt: '¿Cómo te encuentras?', type: 'single', required: true, options: ['Bien', 'Cansada'] }],
    }))
  })
})
