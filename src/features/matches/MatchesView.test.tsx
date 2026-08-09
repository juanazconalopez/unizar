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
    await user.click(screen.getByRole('button', { name: 'Asistiré' }))
    expect(onSaveAvailability).toHaveBeenCalledWith(expect.objectContaining({ id: 'match-1' }), 'available', '')
  })

  test('asks for detail when a player rejects attendance', async () => {
    const user = userEvent.setup(); const onSaveAvailability = vi.fn().mockResolvedValue(undefined)
    render(<MatchesView {...common} isOwner={false} onSaveAvailability={onSaveAvailability} />)
    await user.click(screen.getByRole('button', { name: 'Rechazar' }))
    const dialog = screen.getByRole('dialog', { name: /Partido contra/ })
    await user.selectOptions(within(dialog).getByLabelText('Respuesta'), 'doubt')
    await user.type(within(dialog).getByLabelText('Comentario opcional'), 'Molestias leves')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar respuesta' }))
    expect(onSaveAvailability).toHaveBeenCalledWith(expect.objectContaining({ id: 'match-1' }), 'doubt', 'Molestias leves')
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
    expect(onSaveLineup).toHaveBeenCalledWith(expect.objectContaining({ id: 'match-1' }), [expect.objectContaining({ player_id: 'player-1', role: 'starter', slot_number: 1 })], true)
  })
})
