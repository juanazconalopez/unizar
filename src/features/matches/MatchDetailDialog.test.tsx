import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  test('shows the graphic in a published callup while keeping availability and text copy', async () => {
    const user = userEvent.setup()
    const entries: MatchLineup[] = [{ match_id: match.id, player_id: 'player-1', role: 'starter', position: null, slot_number: 1, sort_order: 1, updated_at: '2026-09-01T10:00:00Z' }]
    const onViewAvailability = vi.fn()
    render(<MatchDetailDialog canEditMatch={false} canManageLineup={false} canViewAvailability isPlayer={false} lineup={entries} match={{ ...match, lineup_published: true }} profiles={[makeProfile()]} demo onClose={vi.fn()} onEdit={vi.fn()} onManageLineup={vi.fn()} onViewAvailability={onViewAvailability} />)

    const graphic = screen.getByRole('img', { name: 'Imagen de la convocatoria' })
    expect(graphic).toBeInTheDocument()
    expect(graphic.textContent).toContain('Quebrantahuesos Rugby vs Unizar Fem.')
    expect(graphic.textContent).not.toContain('CONVOCATORIA · XV')
    expect(graphic.textContent).not.toContain('septiembre')
    expect(screen.queryByText('Titulares')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar convocatoria' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver lista' }))
    expect(screen.getByRole('heading', { name: 'Titulares' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Imagen de la convocatoria' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copiar convocatoria' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver imagen' }))
    expect(screen.getByRole('img', { name: 'Imagen de la convocatoria' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver disponibilidades' }))
    expect(onViewAvailability).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Ampliar imagen' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ampliar imagen de la convocatoria' }))
    expect(screen.getByRole('dialog', { name: 'Vista gráfica' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aumentar zoom' }))
    expect(screen.getByRole('button', { name: 'Restablecer zoom' })).toHaveTextContent('150 %')
    expect(screen.getByRole('img', { name: 'Imagen de la convocatoria' })).toHaveStyle({ width: '150%' })
  })

  test('shows a team selector only for published internal callups and uses the selected lineup for image, list and copy', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const home: Match = { ...match, id: 'home', internal_fixture_id: 'derby', team_id: 'team-a', opponent: 'Unizar B', is_home: true, lineup_published: true, season_teams: { id: 'team-a', name: 'Unizar A', is_mixed: false, is_default: true } }
    const away: Match = { ...match, id: 'away', internal_fixture_id: 'derby', team_id: 'team-b', opponent: 'Unizar A', is_home: false, lineup_published: true, season_teams: { id: 'team-b', name: 'Unizar B', is_mixed: false, is_default: false } }
    const profiles = [makeProfile({ id: 'player-a', display_name: 'Aitana' }), makeProfile({ id: 'player-b', display_name: 'Beatriz' })]
    const homeLineup: MatchLineup[] = [{ match_id: home.id, player_id: 'player-a', role: 'starter', position: null, slot_number: 1, sort_order: 1, updated_at: home.updated_at }]
    const awayLineup: MatchLineup[] = [{ match_id: away.id, player_id: 'player-b', role: 'starter', position: null, slot_number: 1, sort_order: 1, updated_at: away.updated_at }]
    const props = { canEditMatch: false, canManageLineup: false, canViewAvailability: false, isPlayer: false, lineup: homeLineup, match: home, pairedLineup: awayLineup, pairedMatch: away, profiles, demo: true, onClose: vi.fn(), onEdit: vi.fn(), onManageLineup: vi.fn(), onViewAvailability: vi.fn() }
    const { rerender } = render(<MatchDetailDialog {...props} />)

    const teams = screen.getByRole('group', { name: 'Equipo de la convocatoria' })
    expect(teams).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unizar A' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: 'Imagen de la convocatoria' })).toHaveTextContent('Aitana')
    await user.click(screen.getByRole('button', { name: 'Unizar B' }))
    expect(screen.getByRole('button', { name: 'Unizar B' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: 'Imagen de la convocatoria' })).toHaveTextContent('Beatriz')
    expect(screen.getByRole('img', { name: 'Imagen de la convocatoria' })).not.toHaveTextContent('Aitana')
    await user.click(screen.getByRole('button', { name: 'Ver lista' }))
    const list = document.querySelector('.match-lineup-view-panel[data-view="list"]')
    expect(list).toHaveTextContent('Beatriz')
    expect(list).not.toHaveTextContent('Aitana')
    await user.click(screen.getByRole('button', { name: 'Copiar convocatoria' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('1. Beatriz'))
    await user.click(screen.getByRole('button', { name: 'Unizar A' }))
    expect(list).toHaveTextContent('Aitana')
    await user.click(screen.getByRole('button', { name: 'Ver imagen' }))
    expect(screen.getByRole('img', { name: 'Imagen de la convocatoria' })).toHaveTextContent('Aitana')

    rerender(<MatchDetailDialog {...props} match={{ ...home, lineup_published: false }} pairedMatch={{ ...away, lineup_published: false }} />)
    expect(screen.queryByRole('group', { name: 'Equipo de la convocatoria' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver imagen' })).not.toBeInTheDocument()
  })

  test('loads private player photos in the graphic only for the owner', async () => {
    const profile = { ...makeProfile(), avatar_path: 'player-1/photo.jpg' }
    const entries: MatchLineup[] = [{ match_id: match.id, player_id: profile.id, role: 'starter', position: null, slot_number: 1, sort_order: 1, updated_at: '2026-09-01T10:00:00Z' }]
    const onLoadGraphicPhoto = vi.fn().mockResolvedValue('data:image/png;base64,AAAA')
    const props = { canEditMatch: false, canManageLineup: false, canViewAvailability: false, isPlayer: false, lineup: entries,
      match: { ...match, lineup_published: true }, profiles: [profile], demo: true, onLoadGraphicPhoto,
      onClose: vi.fn(), onEdit: vi.fn(), onManageLineup: vi.fn(), onViewAvailability: vi.fn() }
    const { rerender } = render(<MatchDetailDialog {...props} />)
    expect(onLoadGraphicPhoto).not.toHaveBeenCalled()
    rerender(<MatchDetailDialog {...props} canGraphicExport />)
    await waitFor(() => expect(onLoadGraphicPhoto).toHaveBeenCalledWith('player-1/photo.jpg'))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ver lista' }))
    await user.click(screen.getByRole('button', { name: 'Ver imagen' }))
    expect(onLoadGraphicPhoto).toHaveBeenCalledOnce()
  })

  test('keeps a draft as a list for staff and private from players', () => {
    const entries: MatchLineup[] = [{ match_id: match.id, player_id: 'player-1', role: 'starter', position: null, slot_number: 1, sort_order: 1, updated_at: '2026-09-01T10:00:00Z' }]
    const props = { canEditMatch: false, canManageLineup: true, canViewAvailability: false, isPlayer: false, lineup: entries,
      match, profiles: [makeProfile()], onClose: vi.fn(), onEdit: vi.fn(), onManageLineup: vi.fn(), onViewAvailability: vi.fn() }
    const { rerender } = render(<MatchDetailDialog {...props} />)
    expect(screen.getByText('Borrador de convocatoria')).toBeInTheDocument()
    expect(screen.getByText('Titulares')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Imagen de la convocatoria' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver imagen' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver lista' })).not.toBeInTheDocument()
    rerender(<MatchDetailDialog {...props} canManageLineup={false} isPlayer />)
    expect(screen.queryByText('Titulares')).not.toBeInTheDocument()
    expect(screen.getByText(/Tu disponibilidad ayuda a preparar la convocatoria/)).toBeInTheDocument()
  })

  test('offers the published lineup copy action to every role', () => {
    const entries: MatchLineup[] = [{ match_id: match.id, player_id: 'player-1', role: 'starter', position: null, slot_number: 1, sort_order: 1, updated_at: '2026-09-01T10:00:00Z' }]
    render(<MatchDetailDialog canEditMatch={false} canManageLineup={false} canViewAvailability={false} isPlayer={false} lineup={entries} match={{ ...match, lineup_published: true }} profiles={[makeProfile()]} onClose={vi.fn()} onEdit={vi.fn()} onManageLineup={vi.fn()} onViewAvailability={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Copiar convocatoria' })).toBeInTheDocument()
  })
})

describe('match report action', () => {
  test('appears only after the match date for staff who can edit', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'))
    try {
      const { rerender } = render(<MatchDetailDialog canEditMatch canManageLineup canViewAvailability isPlayer={false} lineup={[]} match={match} profiles={[]} onClose={vi.fn()} onEdit={vi.fn()} onManageLineup={vi.fn()} onSaveReport={vi.fn()} onViewAvailability={vi.fn()} />)
      expect(screen.getByRole('button', { name: 'Subir acta' })).toBeInTheDocument()
      rerender(<MatchDetailDialog canEditMatch={false} canManageLineup canViewAvailability isPlayer={false} lineup={[]} match={match} profiles={[]} onClose={vi.fn()} onEdit={vi.fn()} onManageLineup={vi.fn()} onSaveReport={vi.fn()} onViewAvailability={vi.fn()} />)
      expect(screen.queryByRole('button', { name: 'Subir acta' })).not.toBeInTheDocument()
      rerender(<MatchDetailDialog canEditMatch canManageLineup canViewAvailability isPlayer={false} lineup={[]} match={{ ...match, match_date: '2026-09-24' }} profiles={[]} onClose={vi.fn()} onEdit={vi.fn()} onManageLineup={vi.fn()} onSaveReport={vi.fn()} onViewAvailability={vi.fn()} />)
      expect(screen.queryByRole('button', { name: 'Subir acta' })).not.toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })
})

describe('match report privacy', () => {
  test('shows the score while restricting the PDF action to report viewers', () => {
    const reportMatch = { ...match, match_report_path: `${match.id}/acta.pdf`, team_score: 46, opponent_score: 7, report_events_reviewed: true }
    const props = { canEditMatch: false, canManageLineup: false, canViewAvailability: false, isPlayer: false, lineup: [], match: reportMatch, profiles: [], onClose: vi.fn(), onEdit: vi.fn(), onManageLineup: vi.fn(), onViewAvailability: vi.fn() }
    const { rerender } = render(<MatchDetailDialog {...props} />)
    expect(screen.getByText(/46 - 7 · Eventos revisados/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver PDF del acta' })).not.toBeInTheDocument()
    rerender(<MatchDetailDialog {...props} canViewReportPdf />)
    expect(screen.getByRole('button', { name: 'Ver PDF del acta' })).toBeInTheDocument()
  })
})
