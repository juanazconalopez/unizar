import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { addDays, todayIso } from '../../lib/dates'
import { makeMembership, makeProfile } from '../../test/fixtures'
import type { Match } from '../../types'
import { MatchLineupDialog } from './MatchLineupDialog'

function match(overrides: Partial<Match> = {}): Match {
  return { id: 'match-1', season_id: 'season-1', opponent: 'Rival', match_date: addDays(todayIso(), 7), kickoff_time: null, venue: null, callup_time: null, callup_venue: null, is_home: true, notes: null, status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: false, created_by: 'owner-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), seasons: { name: 'Temporada' }, ...overrides }
}

describe('MatchLineupDialog', () => {
  test('excluye reservas del otro equipo sin borrar coincidencias previas y las libera al actualizar', () => {
    const player = makeProfile()
    const other = makeProfile({ id: 'other', display_name: 'Beatriz López' })
    const props = {
      demo: true, match: match({ internal_fixture_id: 'derby' }),
      availability: [player, other].map((item) => ({ match_id: 'match-1', player_id: item.id, status: 'available' as const, comment: null, updated_at: item.created_at })),
      entries: [{ match_id: 'match-1', player_id: other.id, slot_number: 1, sort_order: 1, role: 'starter' as const, position: null, updated_at: other.created_at }],
      memberships: [makeMembership(), makeMembership({ player_id: other.id })], profiles: [player, other], onClose: vi.fn(), onSave: vi.fn(),
    }
    const view = render(<MatchLineupDialog {...props} reservedPlayerIds={[player.id, other.id]} />)
    const pool = screen.getByRole('dialog').querySelector('.available-player-pool')!
    expect(pool).not.toHaveTextContent(player.display_name)
    expect(screen.getByRole('button', { name: 'Quitar a Beatriz López' })).toBeInTheDocument()
    fireEvent.drop(screen.getByRole('dialog').querySelectorAll('.lineup-slot')[1], { dataTransfer: { getData: () => player.id } })
    expect(screen.queryByRole('combobox', { name: 'Posición de Ana Martín' })).not.toBeInTheDocument()
    view.rerender(<MatchLineupDialog {...props} reservedPlayerIds={[]} />)
    expect(pool).toHaveTextContent(player.display_name)
    fireEvent.click(within(pool as HTMLElement).getByRole('button', { name: 'Añadir' }))
    expect(screen.getByRole('combobox', { name: 'Posición de Ana Martín' })).toHaveValue('2')
  })

  test('a coach edits positions through a public profile without losing the lineup draft', async () => {
    const user = userEvent.setup()
    const player = makeProfile({ playing_positions: ['prop'], primary_position: 'prop' })
    const updated = { ...player, playing_positions: ['prop', 'wing'], primary_position: 'wing' }
    const onSave = vi.fn()
    const props = { demo: true, availability: [{ match_id: 'match-1', player_id: player.id, status: 'available' as const, comment: null, updated_at: player.created_at }], entries: [], match: match(), memberships: [makeMembership()], profiles: [player], onClose: vi.fn(), onSave }
    const savePositions = vi.fn().mockImplementation(async () => { view.rerender(<MatchLineupDialog {...props} profiles={[updated]} onSavePositions={savePositions} />) })
    const view = render(<MatchLineupDialog {...props} onSavePositions={savePositions} />)
    await user.click(screen.getByRole('button', { name: 'Añadir' }))
    await user.click(screen.getByRole('button', { name: 'Datos de perfil de Ana Martín' }))
    expect(screen.queryByText('Email', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText('Fecha de nacimiento', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText('Teléfono', { exact: true })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Acciones de Ana Martín' }))
    expect(screen.queryByRole('button', { name: 'Editar datos' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Modificar posiciones' }))
    await user.click(screen.getByRole('checkbox', { name: 'Ala' }))
    await user.selectOptions(screen.getByRole('combobox'), 'wing')
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }))
    expect(savePositions).toHaveBeenCalledWith(player, { positions: ['prop', 'wing'], primaryPosition: 'wing' })
    await user.click(screen.getByRole('button', { name: 'Acciones de Ana Martín' }))
    await user.click(screen.getByRole('button', { name: /^Cerrar$/ }))
    expect(screen.getByRole('combobox', { name: 'Posición de Ana Martín' })).toHaveValue('1')
    const distribution = within(screen.getByLabelText('Distribución por posición principal'))
    expect(distribution.getByText('Línea').closest('span')).toHaveTextContent('Línea 1')
    expect(distribution.getByText('Delanteras').closest('span')).toHaveTextContent('Delanteras 0')
  })

  test('a coach can select a training-only player without a team for a friendly', () => {
    render(<MatchLineupDialog demo canBorrowFromOtherTeams={false} availability={[{ match_id: 'match-1', player_id: 'player-1', status: 'available', comment: null, updated_at: new Date().toISOString() }]} entries={[]} match={match({ match_kind: 'friendly', team_id: 'team-1' })} memberships={[makeMembership({ license_type: 'training', season_team_id: null })]} profiles={[makeProfile()]} onClose={vi.fn()} onSave={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    expect(screen.getByRole('button', { name: 'Guardar alineación' })).toBeEnabled()
    expect(screen.queryByText(/prestada de otro equipo/)).not.toBeInTheDocument()
  })

  test('an old available response does not make a training-only player eligible for an official lineup', () => {
    render(<MatchLineupDialog demo availability={[{ match_id: 'match-1', player_id: 'player-1', status: 'available', comment: null, updated_at: new Date().toISOString() }]} entries={[]} match={match()} memberships={[makeMembership({ license_type: 'training', season_team_id: null })]} profiles={[makeProfile()]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Añadir' })).not.toBeInTheDocument()
  })

  test('offers 23 numbered places for an official match', () => {
    render(<MatchLineupDialog demo availability={[]} entries={[]} match={match()} memberships={[makeMembership()]} profiles={[makeProfile()]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getAllByText('Suelta aquí')).toHaveLength(23)
    expect(screen.getByText('Suplentes')).toBeInTheDocument()
  })

  test('limits a friendly Seven lineup to its seven starters', () => {
    render(<MatchLineupDialog demo availability={[]} entries={[]} match={match({ match_kind: 'friendly', rugby_format: 'sevens' })} memberships={[makeMembership()]} profiles={[makeProfile()]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getAllByText('Suelta aquí')).toHaveLength(7)
    expect(screen.queryByText('Suplentes')).not.toBeInTheDocument()
  })

  test('keeps a player-coach eligible for the lineup', () => {
    const coach = makeProfile({ is_coach: true, display_name: 'Andrea López' })
    render(<MatchLineupDialog demo availability={[{ match_id: 'match-1', player_id: 'player-1', status: 'available', comment: null, updated_at: new Date().toISOString() }]} entries={[]} match={match()} memberships={[makeMembership()]} profiles={[coach]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByText('Andrea López')).toBeInTheDocument()
  })

  test('excludes a coach-only profile even if an old membership remains', () => {
    const coach = makeProfile({ is_coach: true, is_player: false, display_name: 'Andrea López' })
    render(<MatchLineupDialog demo availability={[]} entries={[]} match={match()} memberships={[makeMembership()]} profiles={[coach]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.queryByText('Andrea López')).not.toBeInTheDocument()
  })

  test('removes a provisional selection when the player is no longer available', () => {
    const entry = { match_id: 'match-1', player_id: 'player-1', role: 'starter' as const, position: null, slot_number: 1, sort_order: 1, updated_at: new Date().toISOString() }
    render(<MatchLineupDialog demo availability={[{ match_id: 'match-1', player_id: 'player-1', status: 'doubt', comment: null, updated_at: new Date().toISOString() }]} entries={[entry]} match={match()} memberships={[makeMembership()]} profiles={[makeProfile()]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.queryByText('Ana Martín')).not.toBeInTheDocument()
    expect(screen.getAllByText('Suelta aquí')).toHaveLength(23)
  })

  test('renders an already published lineup as read-only even if a save callback is supplied', () => {
    render(<MatchLineupDialog demo availability={[]} entries={[]} match={match({ lineup_published: true })} memberships={[makeMembership()]} profiles={[makeProfile()]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByText('CONVOCATORIA')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar alineación' })).not.toBeInTheDocument()
  })

  test('opens the owner graphic from a published lineup and keeps text copy available', async () => {
    const user = userEvent.setup()
    const entry = { match_id: 'match-1', player_id: 'player-1', role: 'starter' as const, position: null, slot_number: 1, sort_order: 1, updated_at: new Date().toISOString() }
    render(<MatchLineupDialog demo availability={[]} canGraphicExport entries={[entry]} match={match({ lineup_published: true })}
      memberships={[makeMembership()]} profiles={[makeProfile()]} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Vista gráfica' }))
    expect(screen.getByRole('dialog', { name: 'Vista gráfica' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.getByRole('button', { name: 'Copiar convocatoria' })).toBeInTheDocument()
  })

  test('requires confirmation before a coach unlocks and edits a published lineup', async () => {
    const user = userEvent.setup()
    const onUnlock = vi.fn().mockResolvedValue(undefined)
    const entry = { match_id: 'match-1', player_id: 'player-1', role: 'starter' as const, position: null, slot_number: 1, sort_order: 1, updated_at: new Date().toISOString() }
    render(<MatchLineupDialog demo
      availability={[{ match_id: 'match-1', player_id: 'player-1', status: 'available', comment: null, updated_at: new Date().toISOString() }]}
      entries={[entry]}
      match={match({ lineup_published: true })}
      memberships={[makeMembership()]}
      profiles={[makeProfile()]}
      onClose={vi.fn()}
      onSave={vi.fn()}
      onUnlock={onUnlock}
    />)

    await user.click(screen.getByRole('button', { name: 'Desbloquear para editar' }))
    const confirmation = screen.getByRole('dialog', { name: '¿Volver a editar la convocatoria?' })
    expect(confirmation).toHaveTextContent('tendrás que publicarla de nuevo')
    expect(onUnlock).not.toHaveBeenCalled()

    await user.click(within(confirmation).getByRole('button', { name: 'Sí, desbloquear' }))
    expect(onUnlock).toHaveBeenCalledOnce()
    expect(await screen.findByRole('button', { name: 'Guardar alineación' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Publicar convocatoria para las jugadoras' })).not.toBeChecked()
  })

  test('shows the database message when saving a lineup fails', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockRejectedValue({ message: 'La convocatoria contiene una jugadora que ya no está disponible' })
    render(
      <MatchLineupDialog demo
        availability={[{ match_id: 'match-1', player_id: 'player-1', status: 'available', comment: null, updated_at: new Date().toISOString() }]}
        entries={[]}
        match={match()}
        memberships={[makeMembership()]}
        profiles={[makeProfile()]}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Añadir' }))
    await user.click(screen.getByRole('button', { name: 'Guardar alineación' }))
    expect(await screen.findByText('La convocatoria contiene una jugadora que ya no está disponible')).toBeInTheDocument()
  })

  test('explains that the owner must save a lineup containing a borrowed player', async () => {
    const user = userEvent.setup()
    const borrowed = makeProfile({ id: 'borrowed', display_name: 'Beatriz López' })
    const entry = { match_id: 'match-1', player_id: borrowed.id, role: 'starter' as const, position: null, slot_number: 1, sort_order: 1, updated_at: new Date().toISOString() }
    render(<MatchLineupDialog demo
      availability={[{ match_id: 'match-1', player_id: borrowed.id, status: 'available', comment: null, updated_at: new Date().toISOString() }]}
      canBorrowFromOtherTeams={false}
      entries={[entry]}
      match={match({ team_id: 'team-a' })}
      memberships={[makeMembership({ player_id: borrowed.id, season_team_id: 'team-b' })]}
      profiles={[borrowed]}
      seasonTeams={[{ id: 'team-b', season_id: 'season-1', name: 'Unizar B', is_mixed: false, is_default: false, is_active: true, created_by: 'owner-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]}
      onClose={vi.fn()}
      onSave={vi.fn()}
    />)

    expect(screen.getByText(/El owner debe guardar los cambios mientras permanezca asignada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar alineación' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Quitar a Beatriz López' }))
    expect(screen.getByRole('button', { name: 'Guardar alineación' })).toBeEnabled()
  })

  test('offers only free dorsals and requires removing an occupant before assigning its place', async () => {
    const user = userEvent.setup()
    const ana = makeProfile({ id: 'player-1', display_name: 'Ana Martín' })
    const bea = makeProfile({ id: 'player-2', display_name: 'Beatriz López' })
    const entries = [
      { match_id: 'match-1', player_id: ana.id, role: 'starter' as const, position: null, slot_number: 1, sort_order: 1, updated_at: new Date().toISOString() },
      { match_id: 'match-1', player_id: bea.id, role: 'starter' as const, position: null, slot_number: 2, sort_order: 2, updated_at: new Date().toISOString() },
    ]
    render(<MatchLineupDialog demo
      availability={[
        { match_id: 'match-1', player_id: ana.id, status: 'available', comment: null, updated_at: new Date().toISOString() },
        { match_id: 'match-1', player_id: bea.id, status: 'available', comment: null, updated_at: new Date().toISOString() },
      ]}
      entries={entries}
      match={match()}
      memberships={[makeMembership(), makeMembership({ id: 'membership-2', player_id: bea.id })]}
      profiles={[ana, bea]}
      onClose={vi.fn()}
      onSave={vi.fn()}
    />)

    const anaSelector = screen.getByRole('combobox', { name: 'Posición de Ana Martín' })
    expect(within(anaSelector).getByRole('option', { name: '1' })).toBeInTheDocument()
    expect(within(anaSelector).queryByRole('option', { name: '2' })).not.toBeInTheDocument()
    expect(within(anaSelector).getByRole('option', { name: '3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar a Ana Martín' })).toHaveClass('lineup-remove-button')

    await user.selectOptions(anaSelector, '3')
    expect(screen.getByRole('combobox', { name: 'Posición de Ana Martín' })).toHaveValue('3')
    expect(screen.getByRole('combobox', { name: 'Posición de Beatriz López' })).toHaveValue('2')
    expect(within(screen.getByRole('combobox', { name: 'Posición de Beatriz López' })).getByRole('option', { name: '1' })).toBeInTheDocument()

    const occupiedSlot = screen.getByRole('combobox', { name: 'Posición de Beatriz López' }).closest('.lineup-slot')
    expect(occupiedSlot).not.toBeNull()
    fireEvent.drop(occupiedSlot!, { dataTransfer: { getData: () => ana.id } })
    expect(screen.getByRole('combobox', { name: 'Posición de Ana Martín' })).toHaveValue('3')
    expect(screen.getByRole('combobox', { name: 'Posición de Beatriz López' })).toHaveValue('2')

    await user.click(screen.getByRole('button', { name: 'Quitar a Beatriz López' }))
    const freeSelector = screen.getByRole('combobox', { name: 'Posición de Ana Martín' })
    expect(within(freeSelector).getByRole('option', { name: '2' })).toBeInTheDocument()
    await user.selectOptions(freeSelector, '2')
    expect(screen.getByRole('combobox', { name: 'Posición de Ana Martín' })).toHaveValue('2')

    await user.click(screen.getByRole('button', { name: 'Quitar a Ana Martín' }))
    expect(screen.queryByRole('combobox', { name: 'Posición de Ana Martín' })).not.toBeInTheDocument()
  })
})
