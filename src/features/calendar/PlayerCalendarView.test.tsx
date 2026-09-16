import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeAnnouncement, makeMembership, makeProfile, makeTask } from '../../test/fixtures'
import type { Match } from '../../types'
import { PlayerCalendarView } from './PlayerCalendarView'

const today = '2026-09-02'

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1', season_id: 'season-1', competition_id: 'competition-1', opponent: 'Rival Rugby', match_date: today,
    kickoff_time: '12:00:00', venue: 'Campo central', callup_time: null, callup_venue: null, is_home: true, notes: null,
    status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: false,
    created_by: 'owner-1', created_at: '2026-08-20T10:00:00.000Z', updated_at: '2026-08-20T10:00:00.000Z',
    seasons: { name: 'Temporada 2026' }, season_competitions: { id: 'competition-1', name: 'Liga Aragonesa', color: 'purple', is_default: true }, ...overrides,
  }
}

function props() {
  return {
    announcements: [
      makeAnnouncement({ announcement_date: today }),
      makeAnnouncement({ id: 'draft-announcement', title: 'Aviso oculto', announcement_date: today, status: 'draft' }),
    ],
    availability: [],
    birthdays: [{ season_id: 'season-1', player_id: 'player-2', display_name: 'Bea Pérez', birthday_on: today }],
    lineups: [],
    matches: [makeMatch(), makeMatch({ id: 'draft-match', opponent: 'Partido oculto', status: 'draft' })],
    memberships: [makeMembership({ active_from: '2026-01-01' })],
    profiles: [makeProfile()],
    results: [],
    tasks: [
      makeTask({ week_start: '2026-08-31' }),
      makeTask({ id: 'draft-task', title: 'Tarea oculta', week_start: '2026-08-31', status: 'draft' }),
    ],
    userId: 'player-1',
    onLoadMatchMonth: vi.fn().mockResolvedValue(undefined),
    onLoadTaskRange: vi.fn().mockResolvedValue(undefined),
    onLoadSurveyClosures: vi.fn().mockResolvedValue([]),
    onOpenSurveyResults: vi.fn(),
    onSaveAvailability: vi.fn().mockResolvedValue(undefined),
    onSaveResult: vi.fn().mockResolvedValue(undefined),
  }
}

describe('PlayerCalendarView', () => {
  beforeEach(() => vi.setSystemTime(new Date('2026-09-02T10:00:00+02:00')))
  afterEach(() => vi.useRealTimers())

  test('combines published tasks, announcements, matches and birthdays', () => {
    render(<PlayerCalendarView {...props()} />)

    expect(screen.getByRole('heading', { name: 'Calendario' })).toBeInTheDocument()
    expect(screen.getByText('Cambio de horario')).toBeInTheDocument()
    expect(screen.getByText(/Rival Rugby/)).toBeInTheDocument()
    expect(screen.getByText('Velocidad y cambios de dirección')).toBeInTheDocument()
    expect(screen.getByText('Cumpleaños del día').closest('.birthday-day-detail')).toHaveTextContent('Bea Pérez')
    expect(screen.queryByText('Aviso oculto')).not.toBeInTheDocument()
    expect(screen.queryByText('Partido oculto')).not.toBeInTheDocument()
    expect(screen.queryByText('Tarea oculta')).not.toBeInTheDocument()
    expect(screen.queryByText(/\d+ años/i)).not.toBeInTheDocument()

    const day = screen.getByRole('button', { name: /2 de septiembre.*1 partido.*1 cumpleaños/i })
    expect(within(day).getByText('P')).toBeInTheDocument()
    expect(within(day).getByText('🎂 1')).toBeInTheDocument()
  })

  test('keeps the personal task and availability actions', async () => {
    const common = props()
    const user = userEvent.setup()
    render(<PlayerCalendarView {...common} />)

    expect(screen.getByRole('button', { name: 'Completar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Asistiré' }))

    expect(common.onSaveAvailability).toHaveBeenCalledWith(expect.objectContaining({ id: 'match-1' }), 'available', '')
    expect(common.onLoadMatchMonth).toHaveBeenCalledWith('2026-09-01')
  })

  test('loads and selects the month linked by a match notification', async () => {
    const common = props()
    render(<PlayerCalendarView {...common} focusedDate="2026-10-14" />)

    await waitFor(() => expect(common.onLoadMatchMonth).toHaveBeenCalledWith('2026-10-01', { force: true }))
    expect(common.onLoadTaskRange).toHaveBeenCalledWith('2026-09-28', '2026-10-26')
    expect(screen.getByRole('button', { name: /14 de octubre/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test('opens visible aggregate survey results from the calendar', async () => {
    const common = props()
    common.onLoadSurveyClosures = vi.fn().mockResolvedValue([{ id: 'survey-1', title: 'Valoración semanal', result_date: today, state: 'closed', visibility: 'team' }])
    common.onOpenSurveyResults = vi.fn()
    const user = userEvent.setup()
    render(<PlayerCalendarView {...common} />)

    await user.click(await screen.findByRole('button', { name: /valoración semanal/i }))
    expect(common.onOpenSurveyResults).toHaveBeenCalledWith('survey-1')
    expect(screen.getByRole('heading', { name: 'Calendario' })).toBeInTheDocument()
  })

  test('keeps an active answered survey visible with a modify response action', async () => {
    const common = props()
    common.onLoadSurveyClosures = vi.fn().mockResolvedValue([{ id: 'survey-1', title: 'Disponibilidad de viaje', result_date: today, state: 'active', responded: true, respondedOn: today, startsOn: '2026-09-01', visibility: 'private', endsOn: '2026-09-04' }])
    const user = userEvent.setup()
    render(<PlayerCalendarView {...common} />)

    await user.click(await screen.findByRole('button', { name: /3 de septiembre.*encuesta abierta/i }))

    expect(await screen.findByRole('button', { name: 'Modificar respuesta' })).toBeInTheDocument()
    expect(screen.getByText('Respuesta enviada. Puedes modificarla hasta el cierre.')).toBeInTheDocument()
  })
})
