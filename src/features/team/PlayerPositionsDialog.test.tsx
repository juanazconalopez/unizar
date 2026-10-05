import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { makeProfile } from '../../test/fixtures'
import { PlayerPositionsDialog } from './PlayerPositionsDialog'

test('saves several positions with a principal selected among them', async () => {
  const user = userEvent.setup()
  const player = makeProfile({ playing_positions: ['prop'], primary_position: 'prop' })
  const onSave = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(<PlayerPositionsDialog person={player} onSave={onSave} onClose={onClose} />)
  expect(screen.getByRole('checkbox', { name: 'Pilar' })).toBeChecked()
  await user.click(screen.getByRole('checkbox', { name: 'Ala' }))
  await user.selectOptions(screen.getByRole('combobox', { name: 'Posición principal' }), 'wing')
  expect(onSave).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: /^Guardar$/ }))
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(player, { positions: ['prop', 'wing'], primaryPosition: 'wing' }))
  expect(onClose).toHaveBeenCalledOnce()
})

test('removing the last position clears the principal and cancelling writes nothing', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<PlayerPositionsDialog person={makeProfile({ playing_positions: ['hooker'], primary_position: 'hooker' })} onSave={onSave} onClose={onClose} />)
  await user.click(screen.getByRole('checkbox', { name: 'Talonadora' }))
  expect(screen.getByRole('combobox')).toHaveValue('')
  expect(screen.getByRole('combobox')).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(onSave).not.toHaveBeenCalled()
  expect(onClose).toHaveBeenCalledOnce()
})

test('a failed save preserves selected positions for retry', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockRejectedValue(new Error('No hay conexión'))
  const onClose = vi.fn()
  render(<PlayerPositionsDialog person={makeProfile()} onSave={onSave} onClose={onClose} />)
  await user.click(screen.getByRole('checkbox', { name: 'Centro' }))
  await user.click(screen.getByRole('button', { name: /^Guardar$/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión')
  expect(screen.getByRole('checkbox', { name: 'Centro' })).toBeChecked()
  expect(screen.getByRole('combobox')).toHaveValue('centre')
  expect(onClose).not.toHaveBeenCalled()
})
