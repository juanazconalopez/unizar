import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { makeProfile } from '../../test/fixtures'
import type { Match, MatchLineup } from '../../types'
import { MatchDetailDialog } from './MatchDetailDialog'

const match: Match = {
  id: 'match-1', season_id: 'season-1', opponent: 'Quebrantahuesos Rugby', match_date: '2026-09-20', kickoff_time: '12:00:00', venue: 'Campo de Rugby del Actur', callup_time: '10:30:00', callup_venue: 'Aparcamiento del campus', is_home: false, notes: 'Lleva camiseta de calentamiento.', status: 'published', match_kind: 'friendly', rugby_format: 'xv', lineup_published: false, created_by: 'owner-1', created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z', seasons: { name: 'Temporada 2026' },
}

describe('MatchDetailDialog', () => {
  test('shows callup and match logistics and encourages players before publication', () => {
    render(<MatchDetailDialog canEditMatch={false} canManageLineup={false} canViewAvailability={false} isPlayer lineup={[]} match={match} profiles={[]} onClose={vi.fn()} onEdit={vi.fn()} onManageLineup={vi.fn()} onSaveAvailability={vi.fn()} onViewAvailability={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'Quebrantahuesos Rugby vs Unizar Fem.' })).toBeInTheDocument()
    expect(screen.getByText('Hora de convocatoria')).toBeInTheDocument()
    expect(screen.getByText('10:30')).toBeInTheDocument()
    expect(screen.getByText('Lugar de convocatoria')).toBeInTheDocument()
    expect(screen.getByText('Hora de inicio')).toBeInTheDocument()
    expect(screen.getByText(/Tu disponibilidad ayuda a preparar la convocatoria/)).toBeInTheDocument()
  })

  test('offers the published lineup copy action to every role', () => {
    const entries: MatchLineup[] = [{ match_id: match.id, player_id: 'player-1', role: 'starter', position: null, slot_number: 1, sort_order: 1, updated_at: '2026-09-01T10:00:00Z' }]
    render(<MatchDetailDialog canEditMatch={false} canManageLineup={false} canViewAvailability={false} isPlayer={false} lineup={entries} match={{ ...match, lineup_published: true }} profiles={[makeProfile()]} onClose={vi.fn()} onEdit={vi.fn()} onManageLineup={vi.fn()} onViewAvailability={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Copiar convocatoria' })).toBeInTheDocument()
  })
})
