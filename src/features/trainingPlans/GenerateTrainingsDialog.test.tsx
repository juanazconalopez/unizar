import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { GenerateTrainingsDialog } from './GenerateTrainingsDialog'
test('muestra los festivos y existentes y solo escribe al confirmar el número de sesiones nuevas', async () => {
  const user = userEvent.setup()
  const generate = vi.fn().mockResolvedValueOnce([
    { session_date: '2026-12-01', title: 'Martes', result: 'new' },
    { session_date: '2026-12-03', title: 'Jueves', result: 'existing' },
    { session_date: '2026-12-08', title: 'Festivo', result: 'holiday' },
  ]).mockResolvedValueOnce([{ session_date: '2026-12-01', title: 'Martes', result: 'created' }])
  const done = vi.fn()
  render(<GenerateTrainingsDialog onGenerate={generate} onDone={done} onClose={vi.fn()} />)
  await screen.findByText('Festivo')
  expect(generate).toHaveBeenCalledExactlyOnceWith(false)
  await user.click(screen.getByRole('button', { name: 'Generar 1 entrenamiento' }))
  expect(generate).toHaveBeenLastCalledWith(true)
  expect(done).toHaveBeenCalledWith([{ session_date: '2026-12-01', title: 'Martes', result: 'created' }])
})
