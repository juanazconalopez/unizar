import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { makeSeason, makeSeasonTeam } from '../../test/fixtures'
import { SeasonTeamsDialog } from './SeasonTeamsDialog'

test('loads the current team color, cancels changes, and saves a chosen color', async () => {
  const user = userEvent.setup()
  const team = makeSeasonTeam({ name: 'Unizar A', color: 'purple' })
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(<SeasonTeamsDialog season={makeSeason()} teams={[team]} profiles={[]} memberships={[]} coaches={[]} onClose={vi.fn()} onCreate={vi.fn()} onDelete={vi.fn()} onSave={onSave} onAssignPlayer={vi.fn()} onAssignCoach={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Editar equipo Unizar A' }))
  expect(screen.getByRole('radio', { name: 'Morado' })).toBeChecked()
  await user.click(screen.getByRole('radio', { name: 'Verde' }))
  await user.click(screen.getByRole('button', { name: 'Volver a equipos' }))
  expect(onSave).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Editar equipo Unizar A' }))
  expect(screen.getByRole('radio', { name: 'Morado' })).toBeChecked()
  await user.click(screen.getByRole('radio', { name: 'Azul' }))
  await user.click(screen.getByRole('button', { name: 'Guardar equipo' }))
  expect(onSave).toHaveBeenCalledWith(team, { name: 'Unizar A', isMixed: false, isActive: true, color: 'blue' })
})

test('suggests an unused color for a new team and sends it when creating', async () => {
  const user = userEvent.setup()
  const onCreate = vi.fn().mockResolvedValue(undefined)
  render(<SeasonTeamsDialog season={makeSeason()} teams={[makeSeasonTeam({ color: 'purple' })]} profiles={[]} memberships={[]} coaches={[]} onClose={vi.fn()} onCreate={onCreate} onDelete={vi.fn()} onSave={vi.fn()} onAssignPlayer={vi.fn()} onAssignCoach={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Nuevo equipo' }))
  expect(screen.getByRole('radio', { name: 'Verde' })).toBeChecked()
  await user.type(screen.getByLabelText('Nombre'), 'Unizar B')
  await user.click(screen.getByRole('button', { name: 'Guardar equipo' }))
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Unizar B', isMixed: false, color: 'green' }))
})
