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
})
