import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

const surveys = vi.hoisted(() => ({
  fetchManageSurveys: vi.fn(),
  fetchSurveyDraft: vi.fn(),
  fetchSurveyResults: vi.fn(),
  publishSurvey: vi.fn(),
  saveSurveyDraft: vi.fn(),
}))
vi.mock('../../services/surveysService', () => surveys)
import { SurveysView } from './SurveysView'

const aggregateResults = {
  survey: { id: 'survey-1', title: 'Consulta', description: null, visibility: 'team' as const, status: 'published', startsOn: '2026-09-01', endsOn: '2026-09-07' },
  participation: { recipients: 2, responses: 1 },
  recipientStatus: [
    { playerId: 'player-1', playerName: 'Alba García', respondedAt: '2026-09-02T11:30:00Z' },
    { playerId: 'player-2', playerName: 'Bea Martín', respondedAt: null },
  ],
  questions: [{ id: 'question-1', prompt: '¿Cómo estás?', type: 'single', options: [{ id: 'option-1', label: 'Bien', count: 1 }], longAnswers: [] }],
}

describe('SurveysView owner response tracking', () => {
  test('keeps recipient lists collapsed and loads an individual response after selecting a respondent', async () => {
    const user = userEvent.setup()
    surveys.fetchManageSurveys.mockResolvedValueOnce([{ id: 'survey-1', title: 'Consulta', description: null, seasonId: 'season-1', visibility: 'team', startsOn: '2026-09-01', endsOn: '2026-09-07', responses: 1, recipients: 2, status: 'published' }])
    surveys.fetchSurveyResults.mockResolvedValueOnce(aggregateResults).mockResolvedValueOnce({
      ...aggregateResults,
      questions: [{ ...aggregateResults.questions[0], selectedAnswer: { text: null, optionIds: ['option-1'] } }],
    })

    render(<SurveysView isOwner />)
    await user.click(await screen.findByRole('button', { name: /consulta/i }))
    await screen.findByText('Seguimiento de respuestas')

    expect(screen.getByText(/^Han respondido/).closest('details')).not.toHaveAttribute('open')
    await user.click(screen.getByText(/^Han respondido/))
    await user.click(screen.getByRole('button', { name: /alba garcía/i }))

    await waitFor(() => expect(surveys.fetchSurveyResults).toHaveBeenLastCalledWith('survey-1', 'player-1'))
    expect(await screen.findByText(/Respuestas de/)).toHaveTextContent('Alba García')
    expect(screen.getByText('Bien', { selector: 'p' })).toBeInTheDocument()
  })
})
