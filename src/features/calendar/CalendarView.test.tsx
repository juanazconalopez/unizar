import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { mondayFor, todayIso } from '../../lib/dates'
import { makeAnnouncement, makeMembership, makeProfile, makeResult, makeSeason, makeTask } from '../../test/fixtures'
import type { Match } from '../../types'

import { CalendarView } from './CalendarView'

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1', season_id: 'season-1', opponent: 'Rival Rugby', match_date: todayIso(),
    kickoff_time: '12:00:00', venue: 'Campo central', is_home: true, notes: null,
    status: 'published', match_kind: 'official', rugby_format: 'xv', lineup_published: false,
    created_by: 'owner-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    seasons: { name: 'Temporada 2026' }, ...overrides,
  }
}

function props() {
  const task = makeTask({ week_start: mondayFor(todayIso()) })
  return {
    announcements: [makeAnnouncement({ announcement_date: todayIso() })],
    availability: [],
    lineups: [],
    matches: [makeMatch()],
    memberships: [makeMembership()],
    profiles: [makeProfile()],
    results: [makeResult({ task_id: task.id, fatigue_level: 5 })],
    seasons: [makeSeason()],
    tasks: [task],
    onCreateTask: vi.fn(), onDeleteTask: vi.fn(), onUpdateTask: vi.fn(), onLoadTaskRange: vi.fn().mockResolvedValue(undefined),
    onReorderTasks: vi.fn(), onTaskStatusChange: vi.fn(), onSaveAnnouncement: vi.fn(), onDeleteAnnouncement: vi.fn(),
    onAnnouncementStatusChange: vi.fn(), onDeleteMatch: vi.fn(), onLoadMatchMonth: vi.fn().mockResolvedValue(undefined),
    onSavePlayerAvailability: vi.fn(), onSaveLineup: vi.fn(), onSaveMatch: vi.fn(), onUnlockLineup: vi.fn(),
    onLoadCallupReport: vi.fn().mockResolvedValue({
      seasonId: 'season-1', seasonName: 'Temporada 2026', generatedOn: todayIso(),
      totals: { officialMatches: 1, friendlyMatches: 0, trainingSessions: 0 }, players: [],
    }),
    onLoadPlayerSeasonSummary: vi.fn(),
    onLoadPublishedTrainingPlans: vi.fn().mockResolvedValue([]),
    onOpenTrainingPlan: vi.fn(),
  }
}

describe('CalendarView', () => {
  test('combines tasks, announcements and matches without highlighting match days', () => {
    render(<CalendarView {...props()} />)

    expect(screen.getByRole('heading', { name: 'Calendario' })).toBeInTheDocument()
    expect(screen.getByText('Cambio de horario')).toBeInTheDocument()
    expect(screen.getByText(/Rival Rugby/)).toBeInTheDocument()
    expect(screen.getByText('Velocidad y cambios de dirección')).toBeInTheDocument()
    const todayButton = screen.getByRole('button', { name: /1 partido/ })
    expect(within(todayButton).getByText('P')).toBeInTheDocument()
    expect(todayButton).not.toHaveClass('has-match')
    expect(screen.queryByText(/T · Tareas publicadas/)).not.toBeInTheDocument()
    expect(screen.queryByText(/A · Avisos en su fecha exacta/)).not.toBeInTheDocument()
    expect(screen.queryByText(/E · Entrenamientos publicados/)).not.toBeInTheDocument()
    expect(screen.queryByText(/P · Partidos en su fecha exacta/)).not.toBeInTheDocument()
    expect(screen.queryByText(/fatiga máxima/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vista de lista' })).not.toBeInTheDocument()
  })

  test('offers the three contextual creation actions', async () => {
    const user = userEvent.setup()
    render(<CalendarView {...props()} />)
    await user.click(screen.getByRole('button', { name: 'Añadir' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Nueva tarea' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Nuevo aviso' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Nuevo partido' })).toBeInTheDocument()
  })

  test('opens a published training plan from its calendar card', async () => {
    const common = props()
    common.onLoadPublishedTrainingPlans.mockResolvedValueOnce([{
      id: 'training-1', session_date: todayIso(), title: 'Defensa organizada', status: 'published',
    }])
    const user = userEvent.setup()
    render(<CalendarView {...common} />)

    await user.click(await screen.findByRole('button', { name: 'Ver entrenamiento' }))
    expect(common.onOpenTrainingPlan).toHaveBeenCalledWith('training-1')
  })

  test('opens the callup report from the header', async () => {
    const user = userEvent.setup()
    const common = props()
    render(<CalendarView {...common} />)
    await user.click(screen.getByRole('button', { name: 'Resumen de convocatorias' }))
    expect(await screen.findByRole('heading', { name: 'Resumen de convocatorias' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver al calendario' })).toBeInTheDocument()
    expect(common.onLoadCallupReport).toHaveBeenCalledWith('season-1')
  })
})
