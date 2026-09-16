import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetchSurveyForResponse: vi.fn(), submitSurveyResponse: vi.fn() }))
vi.mock('../../services/surveysService', () => mocks)
import { SurveyResponseDialog } from './SurveyResponseDialog'

describe('SurveyResponseDialog', () => {
  test('shows the survey description before its questions', async () => {
    mocks.fetchSurveyForResponse.mockResolvedValueOnce({
      id: 'survey-1', title: 'Recuperación', description: 'Responde pensando en cómo te has sentido después del último partido.', endsOn: '2026-09-21',
      questions: [{ id: 'question-1', prompt: '¿Cómo te encuentras?', type: 'long', required: true, options: [] }],
    })

    render(<SurveyResponseDialog onClose={vi.fn()} onDone={vi.fn().mockResolvedValue(undefined)} surveyId="survey-1" />)

    expect(await screen.findByText('Responde pensando en cómo te has sentido después del último partido.')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Escribe tu respuesta…')).toBeInTheDocument()
  })

  test('renders an injected survey without requesting Supabase, for the local preview', () => {
    mocks.fetchSurveyForResponse.mockClear()
    render(<SurveyResponseDialog initialSurvey={{
      id: 'demo-survey', title: 'Disponibilidad de ejemplo', description: 'Así verá la jugadora la encuesta.', endsOn: '2026-10-10',
      questions: [{ id: 'question-1', prompt: '¿Puedes asistir?', type: 'single', required: true, options: [{ id: 'yes', label: 'Disponible seguro' }, { id: 'maybe', label: 'No, duda o depende' }] }],
    }} onClose={vi.fn()} onDone={vi.fn().mockResolvedValue(undefined)} surveyId="demo-survey" />)

    expect(screen.getByRole('dialog', { name: 'Disponibilidad de ejemplo' })).toBeInTheDocument()
    expect(screen.getByLabelText('Disponible seguro')).toBeInTheDocument()
    expect(mocks.fetchSurveyForResponse).not.toHaveBeenCalled()
  })

  test('makes responder más tarde the visible close action without a redundant cross', () => {
    render(<SurveyResponseDialog initialSurvey={{
      id: 'demo-survey', title: 'Disponibilidad de ejemplo', description: null, endsOn: '2026-10-10', responded: true,
      answers: [{ questionId: 'question-1', optionIds: ['yes'] }],
      questions: [{ id: 'question-1', prompt: '¿Puedes asistir?', type: 'single', required: true, options: [{ id: 'yes', label: 'Disponible seguro' }] }],
    }} onClose={vi.fn()} onDone={vi.fn().mockResolvedValue(undefined)} surveyId="demo-survey" />)

    expect(screen.getByRole('button', { name: 'Responder más tarde y cerrar encuesta' })).toHaveClass('primary-button')
    expect(screen.queryByRole('button', { name: 'Cerrar encuesta' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })
})
