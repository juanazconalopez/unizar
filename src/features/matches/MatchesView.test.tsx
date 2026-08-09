import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { addDays, todayIso } from '../../lib/dates'
import { makeMembership, makeProfile, makeSeason } from '../../test/fixtures'
import type { Match } from '../../types'
import { MatchesView } from './MatchesView'

const match = (overrides: Partial<Match> = {}): Match => ({
  id: 'match-1', season_id: 'season-1', opponent: 'Rival Rugby', match_date: addDays(todayIso(), 7), kickoff_time: '12:00:00', venue: 'Campo central', is_home: true, notes: 'Llegar con antelación.', status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: false, created_by: 'owner-1', created_at: new Date().toISOString(), seasons: { name: 'Temporada 2026' }, ...overrides,
})

const common = { seasons: [makeSeason()], memberships: [makeMembership()], profiles: [makeProfile()], lineups: [], availability: [], matches: [match()], userId: 'player-1', onDelete: vi.fn(), onSaveLineup: vi.fn(), onSaveMatch: vi.fn() }

describe('MatchesView', () => {
  test('lets a player accept attendance directly', async () => {
    const user = userEvent.setup(); const onSaveAvailability = vi.fn().mockResolvedValue(undefined)
    render(<MatchesView {...common} isOwner={false} onSaveAvailability={onSaveAvailability} />)
    expect(screen.getByRole('region', { name: 'Calendario de partidos' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    await user.click(screen.getByRole('button', { name: 'Asistiré' }))
    expect(onSaveAvailability).toHaveBeenCalledWith(expect.objectContaining({ id: 'match-1' }), 'available', '')
  })

  test('asks for detail when a player rejects attendance', async () => {
    const user = userEvent.setup(); const onSaveAvailability = vi.fn().mockResolvedValue(undefined)
    render(<MatchesView {...common} isOwner={false} onSaveAvailability={onSaveAvailability} />)
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    await user.click(screen.getByRole('button', { name: 'Rechazar' }))
    const dialog = screen.getByRole('dialog', { name: /Partido contra/ })
    await user.selectOptions(within(dialog).getByLabelText('Respuesta'), 'doubt')
    await user.type(within(dialog).getByLabelText('Comentario opcional'), 'Molestias leves')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar respuesta' }))
    expect(onSaveAvailability).toHaveBeenCalledWith(expect.objectContaining({ id: 'match-1' }), 'doubt', 'Molestias leves')
  })

  test('hides drafts from players in calendar and list views', async () => {
    const user = userEvent.setup()
    render(<MatchesView {...common} matches={[match({ status: 'draft', opponent: 'Rival secreto' })]} isOwner={false} onSaveAvailability={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Calendario de partidos' })).toHaveTextContent('P · Día de partido')
    expect(screen.queryByText('Rival secreto')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    expect(screen.queryByText('Rival secreto')).not.toBeInTheDocument()
  })

  test('shows the lineup button only after a non-empty lineup is published', async () => {
    const user = userEvent.setup()
    const lineup = [{ match_id: 'match-1', player_id: 'player-1', role: 'starter' as const, position: null, slot_number: 1, sort_order: 1, updated_at: new Date().toISOString() }]
    const view = render(<MatchesView {...common} lineups={lineup} isOwner={false} onSaveAvailability={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    expect(screen.queryByRole('button', { name: 'Ver convocatoria' })).not.toBeInTheDocument()

    view.rerender(<MatchesView {...common} lineups={lineup} matches={[match({ lineup_published: true })]} isOwner={false} onSaveAvailability={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Ver convocatoria' })).toBeInTheDocument()
    expect(screen.getByText('Disponibilidad cerrada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asistiré' })).not.toBeInTheDocument()
  })

  test('lets the owner open availability grouped by response', async () => {
    const user = userEvent.setup()
    const profiles = [
      makeProfile({ id: 'available-1', display_name: 'Ana Disponible' }),
      makeProfile({ id: 'doubt-1', display_name: 'Diana En Duda' }),
      makeProfile({ id: 'unavailable-1', display_name: 'Noa No Disponible' }),
    ]
    const availability = [
      { match_id: 'match-1', player_id: 'available-1', status: 'available' as const, comment: null, updated_at: new Date().toISOString() },
      { match_id: 'match-1', player_id: 'doubt-1', status: 'doubt' as const, comment: 'Pendiente del trabajo', updated_at: new Date().toISOString() },
      { match_id: 'match-1', player_id: 'unavailable-1', status: 'unavailable' as const, comment: 'Lesión', updated_at: new Date().toISOString() },
    ]
    render(<MatchesView {...common} availability={availability} profiles={profiles} isOwner userId="owner-1" onSaveAvailability={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    await user.click(screen.getByRole('button', { name: '1 dudas' }))
    const dialog = screen.getByRole('dialog', { name: /Partido contra Rival Rugby/ })
    expect(dialog).toHaveTextContent('Disponibles1')
    expect(dialog).toHaveTextContent('En duda1')
    expect(dialog).toHaveTextContent('No disponibles1')
    expect(dialog).toHaveTextContent('Ana Disponible')
    expect(dialog).toHaveTextContent('Diana En Duda')
    expect(dialog).toHaveTextContent('Pendiente del trabajo')
    expect(dialog).toHaveTextContent('Noa No Disponible')
  })

  test('lets an owner select players and publish the lineup', async () => {
    const user = userEvent.setup(); const onSaveLineup = vi.fn().mockResolvedValue(undefined)
    render(<MatchesView {...common} availability={[{ match_id: 'match-1', player_id: 'player-1', status: 'available', comment: null, updated_at: new Date().toISOString() }]} isOwner userId="owner-1" onSaveAvailability={vi.fn()} onSaveLineup={onSaveLineup} />)
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    await user.click(screen.getByRole('button', { name: 'Gestionar alineación' }))
    const dialog = screen.getByRole('dialog', { name: /Partido contra/ })
    await user.click(within(dialog).getByRole('button', { name: 'Añadir' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Publicar convocatoria para las jugadoras' }))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar alineación' }))
    const confirmation = screen.getByRole('dialog', { name: 'Hay titulares sin rellenar' })
    expect(confirmation).toHaveTextContent('Dorsales sin asignar: 2, 3, 4')
    await user.click(within(confirmation).getByRole('button', { name: 'Publicar igualmente' }))
    expect(onSaveLineup).toHaveBeenCalledWith(expect.objectContaining({ id: 'match-1' }), [expect.objectContaining({ player_id: 'player-1', role: 'starter', slot_number: 1 })], true)
  })
})
