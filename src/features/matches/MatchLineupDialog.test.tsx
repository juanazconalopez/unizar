import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { addDays, todayIso } from '../../lib/dates'
import { makeMembership, makeProfile } from '../../test/fixtures'
import type { Match } from '../../types'
import { MatchLineupDialog } from './MatchLineupDialog'

function match(overrides: Partial<Match> = {}): Match {
  return { id: 'match-1', season_id: 'season-1', opponent: 'Rival', match_date: addDays(todayIso(), 7), kickoff_time: null, venue: null, is_home: true, notes: null, status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: false, created_by: 'owner-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), seasons: { name: 'Temporada' }, ...overrides }
}

describe('MatchLineupDialog', () => {
  test('offers 23 numbered places for an official match', () => {
    render(<MatchLineupDialog availability={[]} entries={[]} match={match()} memberships={[makeMembership()]} profiles={[makeProfile()]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getAllByText('Suelta aquí')).toHaveLength(23)
    expect(screen.getByText('Suplentes')).toBeInTheDocument()
  })

  test('limits a friendly Seven lineup to its seven starters', () => {
    render(<MatchLineupDialog availability={[]} entries={[]} match={match({ match_kind: 'friendly', rugby_format: 'sevens' })} memberships={[makeMembership()]} profiles={[makeProfile()]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getAllByText('Suelta aquí')).toHaveLength(7)
    expect(screen.queryByText('Suplentes')).not.toBeInTheDocument()
  })

  test('keeps a player-coach eligible for the lineup', () => {
    const coach = makeProfile({ is_coach: true, display_name: 'Andrea López' })
    render(<MatchLineupDialog availability={[{ match_id: 'match-1', player_id: 'player-1', status: 'available', comment: null, updated_at: new Date().toISOString() }]} entries={[]} match={match()} memberships={[makeMembership()]} profiles={[coach]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByText('Andrea López')).toBeInTheDocument()
  })

  test('excludes a coach-only profile even if an old membership remains', () => {
    const coach = makeProfile({ is_coach: true, is_player: false, display_name: 'Andrea López' })
    render(<MatchLineupDialog availability={[]} entries={[]} match={match()} memberships={[makeMembership()]} profiles={[coach]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.queryByText('Andrea López')).not.toBeInTheDocument()
  })

  test('removes a provisional selection when the player is no longer available', () => {
    const entry = { match_id: 'match-1', player_id: 'player-1', role: 'starter' as const, position: null, slot_number: 1, sort_order: 1, updated_at: new Date().toISOString() }
    render(<MatchLineupDialog availability={[{ match_id: 'match-1', player_id: 'player-1', status: 'doubt', comment: null, updated_at: new Date().toISOString() }]} entries={[entry]} match={match()} memberships={[makeMembership()]} profiles={[makeProfile()]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.queryByText('Ana Martín')).not.toBeInTheDocument()
    expect(screen.getAllByText('Suelta aquí')).toHaveLength(23)
  })

  test('renders an already published lineup as read-only even if a save callback is supplied', () => {
    render(<MatchLineupDialog availability={[]} entries={[]} match={match({ lineup_published: true })} memberships={[makeMembership()]} profiles={[makeProfile()]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByText('CONVOCATORIA')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar alineación' })).not.toBeInTheDocument()
  })

  test('requires confirmation before a coach unlocks and edits a published lineup', async () => {
    const user = userEvent.setup()
    const onUnlock = vi.fn().mockResolvedValue(undefined)
    const entry = { match_id: 'match-1', player_id: 'player-1', role: 'starter' as const, position: null, slot_number: 1, sort_order: 1, updated_at: new Date().toISOString() }
    render(<MatchLineupDialog
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
      <MatchLineupDialog
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

  test('shows player identity above a position selector containing only free slots', async () => {
    const user = userEvent.setup()
    const ana = makeProfile({ id: 'player-1', display_name: 'Ana Martín' })
    const bea = makeProfile({ id: 'player-2', display_name: 'Beatriz López' })
    const entries = [
      { match_id: 'match-1', player_id: ana.id, role: 'starter' as const, position: null, slot_number: 1, sort_order: 1, updated_at: new Date().toISOString() },
      { match_id: 'match-1', player_id: bea.id, role: 'starter' as const, position: null, slot_number: 2, sort_order: 2, updated_at: new Date().toISOString() },
    ]
    render(<MatchLineupDialog
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
    const beaSelector = screen.getByRole('combobox', { name: 'Posición de Beatriz López' })
    expect(within(beaSelector).getByRole('option', { name: '1' })).toBeInTheDocument()
    expect(within(beaSelector).queryByRole('option', { name: '3' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quitar a Ana Martín' }))
    expect(within(screen.getByRole('combobox', { name: 'Posición de Beatriz López' })).getByRole('option', { name: '3' })).toBeInTheDocument()
  })
})
