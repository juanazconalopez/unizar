import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeAnnouncement, makeMembership, makeProfile, makeTask } from '../../test/fixtures'
import type { Match } from '../../types'
import { PlayerCalendarView } from './PlayerCalendarView'

const today = '2026-09-02'

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1', season_id: 'season-1', opponent: 'Rival Rugby', match_date: today,
    kickoff_time: '12:00:00', venue: 'Campo central', is_home: true, notes: null,
    status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: false,
    created_by: 'owner-1', created_at: '2026-08-20T10:00:00.000Z', updated_at: '2026-08-20T10:00:00.000Z',
    seasons: { name: 'Temporada 2026' }, ...overrides,
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
})
