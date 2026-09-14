import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { SurveyCalendarResultsDialog } from './SurveyCalendarResultsDialog'

describe('SurveyCalendarResultsDialog', () => {
  test('shows aggregate results and closes without navigating away', async () => {
    const onClose = vi.fn()
    render(<SurveyCalendarResultsDialog
      onClose={onClose}
      onLoad={vi.fn().mockResolvedValue({
        title: 'Valoración semanal', description: 'Queremos ajustar los entrenamientos.', responses: 3, recipients: 5,
        questions: [{ prompt: '¿Cómo estás?', options: [], longAnswers: [{ text: 'Muy bien.' }] }],
      })}
      surveyId="survey-1"
    />)

    expect(await screen.findByText('Queremos ajustar los entrenamientos.')).toBeInTheDocument()
    expect(screen.getByText('“Muy bien.”')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar resultados' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
