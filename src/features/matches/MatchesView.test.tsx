import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { addDays, todayIso } from '../../lib/dates'
import { makeMembership, makeProfile, makeSeason } from '../../test/fixtures'
import type { Match } from '../../types'
import { MatchesView } from './MatchesView'

const match = (overrides: Partial<Match> = {}): Match => ({
  id: 'match-1', season_id: 'season-1', opponent: 'Rival Rugby', match_date: addDays(todayIso(), 7), kickoff_time: '12:00:00', venue: 'Campo central', is_home: true, notes: 'Llegar con antelación.', status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: false, created_by: 'owner-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), seasons: { name: 'Temporada 2026' }, ...overrides,
})

const common = { seasons: [makeSeason()], memberships: [makeMembership()], profiles: [makeProfile()], lineups: [], availability: [], matches: [match()], userId: 'player-1', canManage: false, canViewAvailability: false, isPlayer: true, onDelete: vi.fn(), onSaveLineup: vi.fn(), onSaveMatch: vi.fn() }

describe('MatchesView', () => {
  test('opens the accumulated report for owners and coaches', async () => {
    const user = userEvent.setup()
    const onLoadCallupReport = vi.fn().mockResolvedValue({
      seasonId: 'season-1', seasonName: 'Temporada 2026', generatedOn: todayIso(),
      totals: { officialMatches: 1, friendlyMatches: 0, trainingSessions: 2 }, players: [],
    })
    render(<MatchesView {...common} canViewReport canManage canViewAvailability isPlayer={false} onLoadCallupReport={onLoadCallupReport} onSaveAvailability={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Resumen de convocatorias' }))
    expect(await screen.findByRole('heading', { name: 'Resumen de convocatorias' })).toBeInTheDocument()
    expect(onLoadCallupReport).toHaveBeenCalledWith('season-1')
    expect(screen.getByRole('button', { name: 'Volver a partidos' })).toBeInTheDocument()
  })

  test('lets a player accept attendance directly', async () => {
    const user = userEvent.setup(); const onSaveAvailability = vi.fn().mockResolvedValue(undefined)
    render(<MatchesView {...common} onSaveAvailability={onSaveAvailability} />)
    expect(screen.getByRole('region', { name: 'Calendario de partidos' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    await user.click(screen.getByRole('button', { name: 'Asistiré' }))
    expect(onSaveAvailability).toHaveBeenCalledWith(expect.objectContaining({ id: 'match-1' }), 'available', '')
  })

  test('asks for detail when a player rejects attendance', async () => {
    const user = userEvent.setup(); const onSaveAvailability = vi.fn().mockResolvedValue(undefined)
    render(<MatchesView {...common} onSaveAvailability={onSaveAvailability} />)
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
    render(<MatchesView {...common} matches={[match({ status: 'draft', opponent: 'Rival secreto' })]} onSaveAvailability={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Calendario de partidos' })).toHaveTextContent('P · Día de partido')
    expect(screen.queryByText('Rival secreto')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    expect(screen.queryByText('Rival secreto')).not.toBeInTheDocument()
  })

  test('shows the lineup button only after a non-empty lineup is published', async () => {
    const user = userEvent.setup()
    const lineup = [{ match_id: 'match-1', player_id: 'player-1', role: 'starter' as const, position: null, slot_number: 1, sort_order: 1, updated_at: new Date().toISOString() }]
    const view = render(<MatchesView {...common} lineups={lineup} onSaveAvailability={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    expect(screen.queryByRole('button', { name: 'Ver convocatoria' })).not.toBeInTheDocument()

    view.rerender(<MatchesView {...common} lineups={lineup} matches={[match({ lineup_published: true })]} onSaveAvailability={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Ver convocatoria' })).toBeInTheDocument()
    expect(screen.getByText('Disponibilidad cerrada')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asistiré' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver convocatoria' }))
    const dialog = screen.getByRole('dialog', { name: /Partido contra Rival Rugby/ })
    expect(within(dialog).getByRole('button', { name: 'Copiar convocatoria' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Descargar XML' })).toBeInTheDocument()
  })

  test('does not let the owner manage a lineup after publication', async () => {
    const user = userEvent.setup()
    const lineup = [{ match_id: 'match-1', player_id: 'player-1', role: 'starter' as const, position: null, slot_number: 1, sort_order: 1, updated_at: new Date().toISOString() }]
    render(<MatchesView {...common} lineups={lineup} matches={[match({ lineup_published: true })]} canManage canViewAvailability isPlayer={false} userId="owner-1" onSaveAvailability={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    expect(screen.getByRole('button', { name: 'Ver convocatoria' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gestionar alineación' })).not.toBeInTheDocument()
  })

  test('offers the explicit unlock flow only to a coach', async () => {
    const user = userEvent.setup()
    const onUnlockLineup = vi.fn().mockResolvedValue(undefined)
    const lineup = [{ match_id: 'match-1', player_id: 'player-1', role: 'starter' as const, position: null, slot_number: 1, sort_order: 1, updated_at: new Date().toISOString() }]
    render(<MatchesView
      {...common}
      canManage
      canUnlockLineup
      canViewAvailability
      isPlayer={false}
      lineups={lineup}
      matches={[match({ lineup_published: true })]}
      onSaveAvailability={vi.fn()}
      onUnlockLineup={onUnlockLineup}
    />)
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    await user.click(screen.getByRole('button', { name: 'Ver convocatoria' }))
    await user.click(screen.getByRole('button', { name: 'Desbloquear para editar' }))
    await user.click(screen.getByRole('button', { name: 'Sí, desbloquear' }))
    expect(onUnlockLineup).toHaveBeenCalledWith(expect.objectContaining({ id: 'match-1' }))
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
    render(<MatchesView {...common} availability={availability} profiles={profiles} canManage canViewAvailability isPlayer={false} userId="owner-1" onSaveAvailability={vi.fn()} />)
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

  test('lets Dirección inspect availability without showing editing actions', async () => {
    const user = userEvent.setup()
    const availability = [{ match_id: 'match-1', player_id: 'player-1', status: 'doubt' as const, comment: 'Pendiente del trabajo', updated_at: new Date().toISOString() }]
    render(<MatchesView {...common} availability={availability} canViewAvailability canViewReport isPlayer={false} onLoadCallupReport={vi.fn()} onSaveAvailability={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    expect(screen.getByRole('button', { name: '1 dudas' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar partido' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gestionar alineación' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asistiré' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '1 dudas' }))
    expect(screen.getByRole('dialog', { name: /Partido contra/ })).toHaveTextContent('Pendiente del trabajo')
  })

  test('shows active season players who have not answered yet', async () => {
    const user = userEvent.setup()
    const profiles = [makeProfile(), makeProfile({ id: 'player-2', display_name: 'Bea Sin Responder' })]
    const memberships = [makeMembership(), makeMembership({ id: 'membership-2', player_id: 'player-2' })]
    render(<MatchesView {...common} availability={[]} memberships={memberships} profiles={profiles} canManage canViewAvailability isPlayer={false} userId="owner-1" onSaveAvailability={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    await user.click(screen.getByRole('button', { name: '2 sin responder' }))
    const dialog = screen.getByRole('dialog', { name: /Partido contra Rival Rugby/ })
    expect(dialog).toHaveTextContent('Sin responder2')
    expect(dialog).toHaveTextContent('Bea Sin Responder')
  })

  test('lets an owner select players and publish the lineup', async () => {
    const user = userEvent.setup(); const onSaveLineup = vi.fn().mockResolvedValue(undefined)
    render(<MatchesView {...common} availability={[{ match_id: 'match-1', player_id: 'player-1', status: 'available', comment: null, updated_at: new Date().toISOString() }]} canManage canViewAvailability isPlayer={false} userId="owner-1" onSaveAvailability={vi.fn()} onSaveLineup={onSaveLineup} />)
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
