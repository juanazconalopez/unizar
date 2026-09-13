import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { makeSeason, makeSeasonCompetition } from '../../test/fixtures'
import { SeasonCompetitionsDialog } from './SeasonCompetitionsDialog'

describe('SeasonCompetitionsDialog', () => {
  test('creates a competition with the first available palette color', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<SeasonCompetitionsDialog competitions={[makeSeasonCompetition()]} season={makeSeason()} onClose={vi.fn()} onCreate={onCreate} onDelete={vi.fn()} onSetDefault={vi.fn()} onUpdate={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Nueva competición' }))
    await user.type(screen.getByLabelText('Nombre'), 'Copa Aragón')
    expect(screen.getByRole('radio', { name: 'Azul' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Crear competición' }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ id: 'season-1' }), { name: 'Copa Aragón', color: 'blue' })
  })

  test('changes the default and warns with the affected match count before deletion', async () => {
    const user = userEvent.setup()
    const cup = makeSeasonCompetition({ id: 'competition-2', name: 'Copa Aragón', color: 'orange', is_default: false, match_count: 3 })
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const onSetDefault = vi.fn().mockResolvedValue(undefined)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SeasonCompetitionsDialog competitions={[makeSeasonCompetition(), cup]} season={makeSeason()} onClose={vi.fn()} onCreate={vi.fn()} onDelete={onDelete} onSetDefault={onSetDefault} onUpdate={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Hacer predeterminada' }))
    expect(onSetDefault).toHaveBeenCalledWith(cup)
    await user.click(screen.getByRole('button', { name: 'Eliminar Copa Aragón' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Se eliminarán 3 partidos'))
    expect(onDelete).toHaveBeenCalledWith(cup)
  })
})
