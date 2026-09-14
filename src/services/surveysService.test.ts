import { describe, expect, test, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))
import { fetchMyPendingSurveys, fetchSurveyCalendarResults, saveSurveyDraft } from './surveysService'

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

  test('adapts protected aggregate results for the calendar modal', async () => {
    rpc.mockResolvedValueOnce({ data: {
      survey: { id: 'survey-1', title: 'Valoración semanal', description: 'Queremos ajustar los entrenamientos.', visibility: 'team', status: 'published', startsOn: '2026-09-01', endsOn: '2026-09-07' },
      participation: { responses: 3, recipients: 5 },
      questions: [{ id: 'question-1', prompt: '¿Cómo estás?', type: 'long', options: [], longAnswers: [{ text: 'Muy bien.' }] }],
    }, error: null })

    await expect(fetchSurveyCalendarResults('survey-1')).resolves.toEqual({
      title: 'Valoración semanal', description: 'Queremos ajustar los entrenamientos.', responses: 3, recipients: 5,
      questions: [{ prompt: '¿Cómo estás?', options: [], longAnswers: [{ text: 'Muy bien.' }] }],
    })
    expect(rpc).toHaveBeenCalledWith('get_survey_results', { checked_survey_id: 'survey-1' })
  })
})
