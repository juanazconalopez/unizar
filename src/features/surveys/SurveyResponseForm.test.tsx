import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { SurveyResponseForm } from './SurveyResponseForm'

const questions = [
  { id: 'long', prompt: '¿Cómo estás?', type: 'long' as const, required: true, options: [] },
  { id: 'single', prompt: 'Elige una', type: 'single' as const, required: true, options: [{ id: 'a', label: 'Sí' }, { id: 'b', label: 'No' }] },
  { id: 'multiple', prompt: 'Opcional', type: 'multiple' as const, required: false, options: [{ id: 'c', label: 'Una' }] },
]

describe('SurveyResponseForm', () => {
  test('starts single-choice questions without a preselected answer', () => {
    render(<SurveyResponseForm questions={questions} onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('Sí')).not.toBeChecked()
    expect(screen.getByLabelText('No')).not.toBeChecked()
  })

  test('requires mandatory long and option answers before submitting', async () => {
    const user = userEvent.setup(); const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<SurveyResponseForm questions={questions} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Enviar respuesta' }))
    expect(await screen.findByText('Responde todas las preguntas obligatorias.')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Escribe tu respuesta…'), 'Muy bien')
    await user.click(screen.getByLabelText('Sí'))
    await user.click(screen.getByRole('button', { name: 'Enviar respuesta' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ questionId: 'long', text: 'Muy bien' }), expect.objectContaining({ questionId: 'single', optionIds: ['a'] })]))
  })

  test('prefills a previous response and uses the update action', () => {
    render(<SurveyResponseForm
      answers={[{ questionId: 'long', text: 'Algo cansada' }, { questionId: 'single', optionIds: ['b'] }]}
      questions={questions}
      submitLabel="Guardar cambios"
      onSubmit={vi.fn()}
    />)

    expect(screen.getByPlaceholderText('Escribe tu respuesta…')).toHaveValue('Algo cansada')
    expect(screen.getByLabelText('No')).toBeChecked()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })
})
