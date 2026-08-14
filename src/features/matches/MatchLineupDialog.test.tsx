import { render, screen } from '@testing-library/react'
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
})
