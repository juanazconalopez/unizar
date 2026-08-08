import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { formatWeek } from '../../lib/dates'
import { makeResult, makeTask } from '../../test/fixtures'
import { TaskCard } from './TaskCard'

describe('TaskCard', () => {
  test('submits a new result using the values entered by the player', async () => {
    const user = userEvent.setup()
    const task = makeTask()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<TaskCard task={task} onSave={onSave} />)

    await user.click(screen.getByRole('button', { name: 'Completar' }))
    expect(screen.queryByRole('button', { name: 'Completar' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Resultado del entrenamiento'), 'Series completadas sin molestias.')
    const performedOn = screen.getByLabelText('Fecha de realización')
    await user.clear(performedOn)
    await user.type(performedOn, '2026-08-04')
    await user.click(screen.getByRole('radio', { name: /Alta/ }))
    await user.click(screen.getByRole('button', { name: 'Enviar y completar' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(task, {
      resultText: 'Series completadas sin molestias.',
      fatigueLevel: 4,
      performedOn: '2026-08-04',
    }))
    expect(screen.queryByRole('button', { name: 'Enviar y completar' })).not.toBeInTheDocument()
  })

  test('shows save errors and keeps the form open', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue(new Error('No se pudo guardar'))
    render(<TaskCard task={makeTask()} onSave={onSave} />)

    await user.click(screen.getByRole('button', { name: 'Completar' }))
    await user.type(screen.getByLabelText('Resultado del entrenamiento'), 'Resultado de prueba')
    await user.click(screen.getByRole('button', { name: 'Enviar y completar' }))

    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar y completar' })).toBeInTheDocument()
  })

  test('allows editing an existing result but not completing a draft', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<TaskCard task={makeTask()} result={makeResult()} onSave={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Resultado del entrenamiento')).toHaveValue('Trabajo completado.')
    expect(screen.getByRole('radio', { name: /Media/ })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()

    rerender(<TaskCard task={makeTask({ status: 'draft' })} onSave={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Completar' })).not.toBeInTheDocument()
  })

  test('opens the complete task detail from the card and can hide its repeated week', async () => {
    const user = userEvent.setup()
    const task = makeTask({
      description: 'Primera línea con indicaciones.\nSegunda línea.\nTercera línea que solo se consulta en el detalle.',
    })
    render(<TaskCard hideWeek task={task} onSave={vi.fn()} />)

    expect(screen.queryByText(formatWeek(task.week_start))).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `Ver detalle de ${task.title}` }))

    const dialog = screen.getByRole('dialog', { name: task.title })
    expect(within(dialog).getByText(formatWeek(task.week_start))).toBeInTheDocument()
    expect(dialog.querySelector('.task-detail-description p')).toHaveTextContent(
      'Primera línea con indicaciones. Segunda línea. Tercera línea que solo se consulta en el detalle.',
    )

    await user.click(within(dialog).getByRole('button', { name: 'Cerrar detalle' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
