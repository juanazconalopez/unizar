import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Match } from '../../types'
import { MatchCard } from './MatchCard'

const match: Match = {
  id: 'match-1', season_id: 'season-1', opponent: 'Quebrantahuesos Rugby', match_date: '2026-09-20', kickoff_time: '12:00:00', venue: 'Campo de Rugby del Actur', callup_time: '10:30:00', callup_venue: 'Aparcamiento del campus', is_home: false, notes: 'Una nota larga para comprobar que la tarjeta presenta la información general del partido.', status: 'published', match_kind: 'friendly', rugby_format: 'xv', lineup_published: false, created_by: 'owner-1', created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z', seasons: { name: 'Temporada 2026' },
}

describe('MatchCard', () => {
  afterEach(() => vi.useRealTimers())

  test('keeps the player card focused on logistics and quick availability', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00'))
    const onViewAvailability = vi.fn()
    render(<MatchCard availability={[{ match_id: match.id, player_id: 'player-1', status: 'doubt', comment: null, updated_at: '2026-09-01T10:00:00Z' }]} canViewAvailability eligiblePlayerCount={2} isPlayer canEditMatch={false} match={match} onOpen={vi.fn()} onSaveAvailability={vi.fn()} onViewAvailability={onViewAvailability} />)

    expect(screen.getByRole('button', { name: /Ver detalle de Quebrantahuesos Rugby vs Unizar Fem/ })).toBeInTheDocument()
    expect(screen.getByText(/Convocatoria 10:30/)).toBeInTheDocument()
    expect(screen.getByText(/Aparcamiento del campus/)).toBeInTheDocument()
    expect(screen.queryByText('Publicado')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Asistiré' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 dudas' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '1 dudas' }))
    expect(onViewAvailability).toHaveBeenCalledOnce()
  })
})
