import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { makeProfile } from '../../test/fixtures'
import type { Match, MatchLineup } from '../../types'
import { InternalFixtureReviewDialog } from './InternalFixtureReviewDialog'

const home = { id: 'match-a', internal_fixture_id: 'fixture-1', is_home: true, rugby_format: 'xv', lineup_published: false, season_teams: { id: 'a', name: 'Unizar A' } } as Match
const away = { id: 'match-b', internal_fixture_id: 'fixture-1', is_home: false, rugby_format: 'xv', lineup_published: false, season_teams: { id: 'b', name: 'Unizar B' } } as Match
const entry = (match_id: string, player_id: string): MatchLineup => ({ match_id, player_id, slot_number: 1, sort_order: 1, role: 'starter', position: null, updated_at: '2026-09-20T12:00:00Z' })

describe('InternalFixtureReviewDialog', () => {
  test('requires the owner to resolve a player proposed by both teams', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<InternalFixtureReviewDialog matches={[home, away]} lineups={[entry(home.id, 'player-1'), entry(away.id, 'player-1')]} profiles={[makeProfile()]} onClose={vi.fn()} onEdit={vi.fn()} onSave={onSave} onFinalize={vi.fn()} onUnlock={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Publicar ambas convocatorias' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Dejar en Unizar A' }))
    expect(onSave).toHaveBeenCalledWith(away, [], false)
  })

  test('confirms missing starters before publishing both sides', async () => {
    const user = userEvent.setup()
    const onFinalize = vi.fn().mockResolvedValue(undefined)
    render(<InternalFixtureReviewDialog matches={[home, away]} lineups={[entry(home.id, 'player-1'), entry(away.id, 'player-2')]} profiles={[makeProfile(), makeProfile({ id: 'player-2', display_name: 'Beatriz López' })]} onClose={vi.fn()} onEdit={vi.fn()} onSave={vi.fn()} onFinalize={onFinalize} onUnlock={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Publicar ambas convocatorias' }))
    expect(onFinalize).not.toHaveBeenCalled()
    expect(screen.getByText(/Faltan titulares/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Publicar ambas convocatorias' }))
    expect(onFinalize).toHaveBeenCalledWith(home)
  })
})
