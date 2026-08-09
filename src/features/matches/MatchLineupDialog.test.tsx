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
})
