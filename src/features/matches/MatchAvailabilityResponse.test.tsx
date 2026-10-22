import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeMatch } from '../../test/fixtures'
import type { MatchAvailability } from '../../types'
import { MatchAvailabilityResponse } from './MatchAvailabilityResponse'

const match = makeMatch({ status: 'published', match_date: '2026-11-21', lineup_published: false })
const initial: MatchAvailability = { match_id: match.id, player_id: 'player-1', status: 'doubt', comment: 'Pendiente del turno de trabajo', updated_at: '2026-10-22T10:00:00Z' }

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-22T12:00:00+02:00')) })
afterEach(() => vi.useRealTimers())

describe('MatchAvailabilityResponse', () => {
  test.each([
    ['En duda', 'doubt'],
    ['No asistiré', 'unavailable'],
  ] as const)('saves a first response from %s with its comment in a single operation', async (button, status) => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<MatchAvailabilityResponse match={match} onSave={onSave} />)
    expect(screen.getByRole('button', { name: 'Asistiré' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: button }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByLabelText('Respuesta')).toHaveValue(status)
    expect(dialog.getByLabelText('Comentario opcional')).toHaveFocus()
    expect(onSave).not.toHaveBeenCalled()
    await user.type(dialog.getByLabelText('Comentario opcional'), 'Pendiente de revisión')
    await user.click(dialog.getByRole('button', { name: 'Guardar respuesta' }))
    expect(onSave).toHaveBeenCalledExactlyOnceWith(match, status, 'Pendiente de revisión')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('a comment is optional when responding in doubt', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<MatchAvailabilityResponse match={match} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'En duda' }))
    await user.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    expect(onSave).toHaveBeenCalledExactlyOnceWith(match, 'doubt', '')
  })

  test('cancelling a first response leaves availability unanswered', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<MatchAvailabilityResponse match={match} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'En duda' }))
    await user.type(screen.getByLabelText('Comentario opcional'), 'Borrador sin guardar')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.queryByText('Tu respuesta')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No asistiré' }))
    expect(screen.getByLabelText('Respuesta')).toHaveValue('unavailable')
    expect(screen.getByLabelText('Comentario opcional')).toHaveValue('')
  })

  test('keeps the selected response and comment after an error and allows retrying', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('No se pudo guardar')).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<MatchAvailabilityResponse match={match} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'En duda' }))
    await user.type(screen.getByLabelText('Comentario opcional'), 'Espero confirmación del horario')
    await user.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument()
    expect(screen.getByLabelText('Respuesta')).toHaveValue('doubt')
    expect(screen.getByLabelText('Comentario opcional')).toHaveValue('Espero confirmación del horario')
    await user.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    expect(onSave).toHaveBeenCalledTimes(2)
    expect(onSave).toHaveBeenLastCalledWith(match, 'doubt', 'Espero confirmación del horario')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('prevents duplicate submissions and closing the form while saving', async () => {
    let finishSave!: () => void
    const onSave = vi.fn(() => new Promise<void>((resolve) => { finishSave = resolve }))
    const user = userEvent.setup()
    render(<MatchAvailabilityResponse match={match} onSave={onSave} />)
    await user.click(screen.getByRole('button', { name: 'En duda' }))
    await user.dblClick(screen.getByRole('button', { name: 'Guardar respuesta' }))
    expect(onSave).toHaveBeenCalledOnce()
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByLabelText('Respuesta')).toBeDisabled()
    expect(dialog.getByLabelText('Comentario opcional')).toBeDisabled()
    expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(dialog.getByRole('button', { name: 'Cerrar' })).toBeDisabled()
    await act(async () => { finishSave() })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('shows the saved response and restores its comment when modifying it', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<MatchAvailabilityResponse initial={initial} match={match} onSave={onSave} />)
    expect(screen.getByText('Estás en duda')).toBeInTheDocument()
    expect(screen.getByText(initial.comment!)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Modificar respuesta' }))
    expect(screen.getByLabelText('Respuesta')).toHaveValue('doubt')
    expect(screen.getByLabelText('Comentario opcional')).toHaveValue(initial.comment)
    await user.selectOptions(screen.getByLabelText('Respuesta'), 'unavailable')
    await user.click(screen.getByRole('button', { name: 'Guardar respuesta' }))
    expect(onSave).toHaveBeenCalledExactlyOnceWith(match, 'unavailable', initial.comment)
  })

  test.each([
    { status: 'draft' as const },
    { status: 'completed' as const },
    { status: 'cancelled' as const },
    { match_date: '2026-10-21' },
    { lineup_published: true },
  ])('does not offer any response when availability is closed: %j', (overrides) => {
    render(<MatchAvailabilityResponse match={{ ...match, ...overrides }} onSave={vi.fn()} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
