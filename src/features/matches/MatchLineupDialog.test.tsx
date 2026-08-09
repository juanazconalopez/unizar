import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { addDays, todayIso } from '../../lib/dates'
import { makeMembership, makeProfile } from '../../test/fixtures'
import type { Match } from '../../types'
import { MatchLineupDialog } from './MatchLineupDialog'

function match(overrides: Partial<Match> = {}): Match {
  return { id: 'match-1', season_id: 'season-1', opponent: 'Rival', match_date: addDays(todayIso(), 7), kickoff_time: null, venue: null, is_home: true, notes: null, status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: false, created_by: 'owner-1', created_at: new Date().toISOString(), seasons: { name: 'Temporada' }, ...overrides }
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

  test('keeps collaborators eligible when they are active players', () => {
    const collaborator = makeProfile({ is_collaborator: true, display_name: 'Andrea López' })
    render(<MatchLineupDialog availability={[{ match_id: 'match-1', player_id: 'player-1', status: 'available', comment: null, updated_at: new Date().toISOString() }]} entries={[]} match={match()} memberships={[makeMembership()]} profiles={[collaborator]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByText('Andrea López')).toBeInTheDocument()
  })

  test('removes a provisional selection when the player is no longer available', () => {
    const entry = { match_id: 'match-1', player_id: 'player-1', role: 'starter' as const, position: null, slot_number: 1, sort_order: 1, updated_at: new Date().toISOString() }
    render(<MatchLineupDialog availability={[{ match_id: 'match-1', player_id: 'player-1', status: 'doubt', comment: null, updated_at: new Date().toISOString() }]} entries={[entry]} match={match()} memberships={[makeMembership()]} profiles={[makeProfile()]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.queryByText('Ana Martín')).not.toBeInTheDocument()
    expect(screen.getAllByText('Suelta aquí')).toHaveLength(23)
  })

  test('does not allow reopening availability after publication', () => {
    render(<MatchLineupDialog availability={[]} entries={[]} match={match({ lineup_published: true })} memberships={[makeMembership()]} profiles={[makeProfile()]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: 'Convocatoria publicada' })).toBeDisabled()
  })
})
