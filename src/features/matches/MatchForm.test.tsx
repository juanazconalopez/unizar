import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { makeSeason, makeSeasonCompetition } from '../../test/fixtures'
import { MatchForm } from './MatchForm'

describe('MatchForm competitions', () => {
  test('selects the default competition when creating an official match', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<MatchForm competitions={[makeSeasonCompetition()]} initialDate="2026-09-20" seasons={[makeSeason()]} onCancel={vi.fn()} onSubmit={onSubmit} />)

    expect(screen.getByRole('combobox', { name: 'Competición' })).toHaveValue('competition-1')
    await user.type(screen.getByLabelText('Rival'), 'Fénix CR')
    await user.click(screen.getByRole('button', { name: 'Guardar partido' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      competitionId: 'competition-1', matchKind: 'official', matchDate: '2026-09-20', opponent: 'Fénix CR',
    }))
  })

  test('removes the competition assignment for friendlies', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<MatchForm competitions={[makeSeasonCompetition()]} initialDate="2026-09-20" seasons={[makeSeason()]} onCancel={vi.fn()} onSubmit={onSubmit} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo de partido' }), 'friendly')
    expect(screen.queryByRole('combobox', { name: 'Competición' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Rival'), 'Quebrantahuesos')
    await user.click(screen.getByRole('button', { name: 'Guardar partido' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ competitionId: '', matchKind: 'friendly' }))
  })

  test('prevents creating an official match before the season has a competition', () => {
    render(<MatchForm initialDate="2026-09-20" seasons={[makeSeason()]} onCancel={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByText('Crea primero una competición dentro de esta temporada.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar partido' })).toBeDisabled()
  })
})
