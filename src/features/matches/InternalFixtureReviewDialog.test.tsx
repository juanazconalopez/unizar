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
  test('muestra los quince dorsales aunque falte la titular seis y solo las suplentes asignadas', () => {
    const players = Array.from({ length: 15 }, (_, index) => makeProfile({ id: `player-${index + 1}` }))
    players.push(makeProfile({ id: 'sub', display_name: 'Beatriz López' }))
    const entries = players.slice(0, 15).map((player, index) => ({ ...entry(home.id, player.id), slot_number: index + 1 })).filter((item) => item.slot_number !== 6)
    entries.push({ ...entry(home.id, 'sub'), slot_number: 21, role: 'substitute' })
    render(<InternalFixtureReviewDialog demo matches={[home, away]} lineups={entries} profiles={players} onClose={vi.fn()} onEdit={vi.fn()} onSave={vi.fn()} onFinalize={vi.fn()} onUnlock={vi.fn()} />)
    const homeSide = screen.getByRole('heading', { name: 'Unizar A 15/23' }).closest('section')!
    const homeRows = [...homeSide.querySelectorAll('.internal-fixture-player')]
    expect(homeRows.map((row) => row.querySelector('b')?.textContent)).toEqual([...Array.from({ length: 15 }, (_, index) => `${index + 1}`), '21'])
    expect(homeRows[5].querySelector('span')).toBeEmptyDOMElement()
    expect(homeRows[15]).toHaveTextContent('21Beatriz López')
    expect(homeSide).toHaveTextContent('14/15 titulares')
    const awaySide = screen.getByRole('heading', { name: 'Unizar B 0/23' }).closest('section')!
    expect(awaySide.querySelectorAll('.internal-fixture-player')).toHaveLength(15)
    for (const name of awaySide.querySelectorAll('.internal-fixture-player span')) expect(name).toBeEmptyDOMElement()
  })

  test('los derbis de seven mantienen siete dorsales titulares por equipo', () => {
    render(<InternalFixtureReviewDialog demo matches={[{ ...home, rugby_format: 'sevens' }, { ...away, rugby_format: 'sevens' }]} lineups={[]} profiles={[]} onClose={vi.fn()} onEdit={vi.fn()} onSave={vi.fn()} onFinalize={vi.fn()} onUnlock={vi.fn()} />)
    for (const side of screen.getByRole('dialog').querySelectorAll('.internal-fixture-sides>section')) {
      expect(side.querySelectorAll('.internal-fixture-player')).toHaveLength(7)
      expect(side).toHaveTextContent('0/7 titulares')
    }
  })

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
