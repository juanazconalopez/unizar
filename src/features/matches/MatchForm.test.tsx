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
      competitionId: 'competition-1', matchKind: 'official', matchDate: '2026-09-20', opponent: 'Fénix CR', callupTime: '', callupVenue: '',
    }))
  })

  test('saves optional meeting time and place separately from the match venue', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<MatchForm competitions={[makeSeasonCompetition()]} initialDate="2026-09-20" seasons={[makeSeason()]} onCancel={vi.fn()} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Rival'), 'Quebrantahuesos')
    await user.type(screen.getByLabelText('Hora de convocatoria'), '10:30')
    await user.type(screen.getByLabelText('Lugar de convocatoria'), 'Aparcamiento del campus')
    await user.click(screen.getByRole('button', { name: 'Guardar partido' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      callupTime: '10:30', callupVenue: 'Aparcamiento del campus',
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

  test('offers a paired internal match only to the owner and sends both teams', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const teams = [
      { id: 'team-1', season_id: 'season-1', name: 'Unizar A', is_default: true, is_active: true, is_mixed: false },
      { id: 'team-2', season_id: 'season-1', name: 'Unizar B', is_default: false, is_active: true, is_mixed: false },
    ] as Parameters<typeof MatchForm>[0]['teams']
    render(<MatchForm canManageInternal competitions={[makeSeasonCompetition()]} initialDate="2026-09-20" seasons={[makeSeason()]} teams={teams} onCancel={vi.fn()} onSubmit={onSubmit} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo de rival' }), 'internal')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Equipo visitante' }), 'team-2')
    expect(screen.queryByLabelText('Rival')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar partido' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'team-1', opponentTeamId: 'team-2', opponent: 'Unizar B' }))
  })

  test('excludes the mixed group from both sides of an internal match', async () => {
    const user = userEvent.setup()
    const teams = [
      { id: 'mixed', season_id: 'season-1', name: 'Mixto', is_default: true, is_active: true, is_mixed: true },
      { id: 'team-a', season_id: 'season-1', name: 'Unizar A', is_default: false, is_active: true, is_mixed: false },
      { id: 'team-b', season_id: 'season-1', name: 'Unizar B', is_default: false, is_active: true, is_mixed: false },
    ] as Parameters<typeof MatchForm>[0]['teams']
    render(<MatchForm canManageInternal competitions={[makeSeasonCompetition()]} initialDate="2026-09-20" seasons={[makeSeason()]} teams={teams} onCancel={vi.fn()} onSubmit={vi.fn()} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo de rival' }), 'internal')
    const home = screen.getByRole('combobox', { name: 'Equipo local' })
    const away = screen.getByRole('combobox', { name: 'Equipo visitante' })
    expect(home).toHaveValue('team-a')
    expect(screen.queryByRole('option', { name: 'Mixto · Mixto' })).not.toBeInTheDocument()
    expect(away).toHaveTextContent('Unizar B')
    expect(away).not.toHaveTextContent('Mixto')
  })

  test('explains why an internal match cannot be created with fewer than two competitive teams', async () => {
    const user = userEvent.setup()
    const teams = [
      { id: 'team-a', season_id: 'season-1', name: 'Unizar A', is_default: true, is_active: true, is_mixed: false },
      { id: 'mixed', season_id: 'season-1', name: 'Mixto', is_default: false, is_active: true, is_mixed: true },
    ] as Parameters<typeof MatchForm>[0]['teams']
    render(<MatchForm canManageInternal competitions={[makeSeasonCompetition()]} initialDate="2026-09-20" seasons={[makeSeason()]} teams={teams} onCancel={vi.fn()} onSubmit={vi.fn()} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo de rival' }), 'internal')
    expect(screen.getByText('Crea dos equipos competitivos activos en esta temporada para organizar un derbi.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar partido' })).toBeDisabled()
  })

  test('prevents creating an official match before the season has a competition', () => {
    render(<MatchForm initialDate="2026-09-20" seasons={[makeSeason()]} onCancel={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByText('Crea primero una competición dentro de esta temporada.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar partido' })).toBeDisabled()
  })
})
