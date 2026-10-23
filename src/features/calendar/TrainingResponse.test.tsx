import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { TrainingPlanCalendarItem } from '../../types'
import { CalendarTrainingPlans } from './CalendarTrainingPlans'

const plan: TrainingPlanCalendarItem = { id: 'p', session_date: '2099-10-23', title: 'Entrenamiento viernes 23 oct', status: 'draft', schedule_version: 2 }
afterEach(() => vi.useRealTimers())
describe('respuesta personal de entrenamientos', () => {
  test.each([0, 1, 12])('muestra el total %s a las jugadoras, también en borradores', (count) => {
    render(<CalendarTrainingPlans player plans={[{ ...plan, attending_count: count }]} onRespond={vi.fn()} />)
    const badge = screen.getByRole('status', { name: `${count} ${count === 1 ? 'jugadora ha' : 'jugadoras han'} confirmado su asistencia` })
    expect(badge).toHaveTextContent(String(count))
    expect(badge).toHaveTextContent(count === 1 ? 'asistirá' : 'asistirán')
    expect(screen.queryByText('Borrador')).not.toBeInTheDocument()
  })
  test('mantiene el total de confirmadas después del registro real y lo muestra al staff', () => {
    render(<CalendarTrainingPlans plans={[{ ...plan, attendance_recorded: true, attending_count: 12 }]} />)
    expect(screen.getByRole('status', { name: '12 jugadoras han confirmado su asistencia' })).toHaveTextContent('12confirmadas')
  })
  test('explica la autogestión y conserva la respuesta cerrada tras el registro automático', () => {
    render(<CalendarTrainingPlans player plans={[{ ...plan, self_managed: true, own_attending: false, attendance_recorded: true }]} onRespond={vi.fn()} />)
    expect(screen.getByText(/Viernes autogestionado/)).toBeInTheDocument()
    expect(screen.getByText('Tu respuesta: Rechazado')).toBeInTheDocument()
    expect(screen.getByText(/Asistencia registrada automáticamente/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Modificar respuesta' })).not.toBeInTheDocument()
  })
  test('no inventa un cero cuando todavía no se conoce el total', () => {
    render(<CalendarTrainingPlans player plans={[plan]} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  test('permite rechazar directamente con comentario y mantiene la respuesta al modificar', async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<CalendarTrainingPlans player plans={[plan]} onRespond={save} />)
    expect(screen.queryByText('Borrador')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver entrenamiento' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'En duda' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Rechazar' }))
    expect(screen.getByLabelText('Tu asistencia')).toHaveValue('false')
    await user.type(screen.getByLabelText('Comentario (opcional)'), 'Trabajo')
    expect(save).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    expect(save).toHaveBeenCalledWith(plan, false, 'Trabajo')
    rerender(<CalendarTrainingPlans player plans={[{ ...plan, own_attending: false, own_comment: 'Trabajo' }]} onRespond={save} />)
    expect(screen.getByText('Tu respuesta: Rechazado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Modificar respuesta' }))
    expect(screen.getByLabelText('Comentario (opcional)')).toHaveValue('Trabajo')
    await user.selectOptions(screen.getByLabelText('Tu asistencia'), 'true')
    await user.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'p' }), true, 'Trabajo')
  })
  test('muestra la respuesta guardada sin modificación al registrar la asistencia real', () => {
    render(<CalendarTrainingPlans player plans={[{ ...plan, own_attending: true, attendance_recorded: true }]} onRespond={vi.fn()} />)
    expect(screen.getByText('Tu respuesta: Asistiré')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Modificar respuesta' })).not.toBeInTheDocument()
  })
  test('cierra los controles si la página sigue abierta al terminar el entrenamiento', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-23T21:29:59+02:00'))
    render(<CalendarTrainingPlans player plans={[{ ...plan, session_date: '2026-10-23', own_attending: true }]} onRespond={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Modificar respuesta' })).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByRole('button', { name: 'Modificar respuesta' })).not.toBeInTheDocument()
    expect(screen.getByText('Tu respuesta: Asistiré')).toBeInTheDocument()
  })
})
