import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { makePlayerAbsence, makeProfile } from '../../test/fixtures'
import { PlayerAbsenceDialog } from './PlayerAbsenceDialog'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-24T12:00:00+02:00'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('keeps the current absence open when discharge confirmation is cancelled', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const onDischarge = vi.fn()
  const onClose = vi.fn()
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<PlayerAbsenceDialog person={makeProfile()} absences={[makePlayerAbsence()]} editAbsenceId="absence-1" onSave={vi.fn()} onClose={onClose} onDischarge={onDischarge} />)

  await user.click(screen.getByRole('button', { name: 'Dar de alta hoy' }))

  expect(onDischarge).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
})

test('shows a discharge error and leaves the action available for retry', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const onDischarge = vi.fn().mockRejectedValue(new Error('No se pudo registrar el alta.'))
  const onClose = vi.fn()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<PlayerAbsenceDialog person={makeProfile()} absences={[makePlayerAbsence()]} editAbsenceId="absence-1" onSave={vi.fn()} onClose={onClose} onDischarge={onDischarge} />)

  await user.click(screen.getByRole('button', { name: 'Dar de alta hoy' }))

  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo registrar el alta.')
  expect(screen.getByRole('button', { name: 'Dar de alta hoy' })).toBeEnabled()
  expect(onClose).not.toHaveBeenCalled()
})

test.each([
  { starts_on: '2026-09-25', ends_on: null, discharged_on: null },
  { starts_on: '2026-09-01', ends_on: '2026-09-23', discharged_on: null },
  { starts_on: '2026-09-01', ends_on: null, discharged_on: '2026-09-24' },
])('does not discharge a scheduled or ended absence while editing: %j', async (dates) => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const absence = makePlayerAbsence(dates)
  render(<PlayerAbsenceDialog person={makeProfile()} absences={[absence]} onSave={vi.fn()} onClose={vi.fn()} onDischarge={vi.fn()} />)

  expect(screen.queryByRole('button', { name: 'Dar de alta hoy' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Editar' }))
  expect(screen.queryByRole('button', { name: 'Dar de alta hoy' })).not.toBeInTheDocument()
})
