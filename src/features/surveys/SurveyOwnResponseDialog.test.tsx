import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetchMySurveyResponse: vi.fn() }))
vi.mock('../../services/surveysService', () => ({ fetchMySurveyResponse: mocks.fetchMySurveyResponse }))
import { SurveyOwnResponseDialog } from './SurveyOwnResponseDialog'

describe('SurveyOwnResponseDialog', () => {
  test('uses an injected response in the local demo without requesting Supabase', () => {
    render(<SurveyOwnResponseDialog
      initialResponse={{
        survey: { id: 'survey-1', title: 'Organización del viaje', description: 'Información para preparar el autobús.', visibility: 'management', endsOn: '2026-09-28' },
        submittedAt: '2026-09-16T10:00:00.000Z',
        questions: [{ id: 'question-1', prompt: '¿Necesitas plaza?', type: 'single', options: [{ id: 'yes', label: 'Sí, necesito plaza' }], selectedAnswer: { text: null, optionIds: ['yes'] } }],
      }}
      onClose={vi.fn()}
      surveyId="survey-1"
    />)

    expect(screen.getByText('Respuesta enviada.')).toBeInTheDocument()
    expect(screen.getByText('Sí, necesito plaza')).toBeInTheDocument()
    expect(mocks.fetchMySurveyResponse).not.toHaveBeenCalled()
  })
})
