import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { addDays, mondayFor, todayIso } from '../../lib/dates'
import { makeAnnouncement, makeAttendance, makeMembership, makeProfile, makeResult, makeSeason, makeSession, makeTask } from '../../test/fixtures'
import { Dashboard } from './Dashboard'

describe('Dashboard', () => {
  test('varies the positive motivation when the player enters the dashboard', () => {
    const random = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999)
    const props = {
      profile: makeProfile(),
      memberships: [makeMembership()],
      tasks: [],
      results: [],
      attendance: [],
      userId: 'player-1',
      onGoToTasks: vi.fn(),
      onSaveResult: vi.fn(),
    }

    const firstVisit = render(<Dashboard {...props} />)
    expect(screen.getByText('Cada paso cuenta')).toBeInTheDocument()
    firstVisit.unmount()

    render(<Dashboard {...props} />)
    expect(screen.getByText('El equipo te espera')).toBeInTheDocument()
    random.mockRestore()
  })

  test('calculates weekly progress and hides unavailable tasks', () => {
    const weekStart = mondayFor(new Date())
    const tasks = [
      makeTask({ id: 'done', title: 'Tarea completada', week_start: weekStart }),
      makeTask({ id: 'pending', title: 'Tarea pendiente', week_start: weekStart }),
      makeTask({ id: 'draft', title: 'Borrador oculto', week_start: weekStart, status: 'draft' }),
      makeTask({ id: 'other-season', season_id: 'season-2', title: 'Sin pertenencia', week_start: weekStart }),
    ]
    render(
      <Dashboard
        profile={makeProfile()}
        memberships={[makeMembership()]}
        tasks={tasks}
        results={[
          makeResult({ task_id: 'done', performed_on: todayIso(), fatigue_level: 4 }),
          makeResult({ task_id: 'draft', performed_on: todayIso(), fatigue_level: 1 }),
        ]}
        attendance={[
          makeAttendance(),
          makeAttendance({ session_id: 'session-2', attended: false }),
        ]}
        trainingSessions={[makeSession(), makeSession({ id: 'session-2' })]}
        season={makeSeason()}
        userId="player-1"
        onGoToTasks={vi.fn()}
        onSaveResult={vi.fn()}
      />,
    )

    expect(screen.getByText('Esta semana').closest('article')).toHaveTextContent('1/250%1 tarea pendiente')
    expect(screen.getByText('Asistencia a campo').closest('article')).toHaveTextContent('1/250% esta temporada')
    expect(screen.queryByText('Fatiga media')).not.toBeInTheDocument()
    expect(screen.getByText('Tarea completada')).toBeInTheDocument()
    expect(screen.getByText('Tarea pendiente')).toBeInTheDocument()
    expect(screen.queryByText('Borrador oculto')).not.toBeInTheDocument()
    expect(screen.queryByText('Sin pertenencia')).not.toBeInTheDocument()
  })

  test('shows weekly tasks in the order selected by the staff', () => {
    const weekStart = mondayFor(new Date())
    render(<Dashboard
      profile={makeProfile()}
      memberships={[makeMembership()]}
      tasks={[
        makeTask({ id: 'flexibility', title: 'Flexibilidad', sort_order: 3, week_start: weekStart }),
        makeTask({ id: 'speed', title: 'Velocidad', sort_order: 1, week_start: weekStart }),
        makeTask({ id: 'power', title: 'Potencia', sort_order: 2, week_start: weekStart }),
      ]}
      results={[]}
      attendance={[]}
      userId="player-1"
      onSaveResult={vi.fn()}
    />)

    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Velocidad', 'Potencia', 'Flexibilidad',
    ])
  })

  test('opens the personal season summary from its dashboard card', async () => {
    const user = userEvent.setup()
    const summary = {
      seasonId: 'season-1', seasonName: 'Temporada 2026', playerId: 'player-1', playerName: 'Marta Jugadora', generatedOn: todayIso(),
      callups: { official: 4, friendly: 2, starter: 4, substitute: 2 },
      availability: { eligibleMatches: 9, responded: 8, available: 6, doubt: 1, unavailable: 1, unanswered: 1, percentage: 89 },
      attendance: { attended: 28, eligibleSessions: 33, percentage: 85 }, matches: [],
    }
    const onLoadSeasonSummary = vi.fn().mockResolvedValue(summary)
    render(<Dashboard profile={makeProfile({ display_name: 'Marta Jugadora' })} memberships={[makeMembership()]} tasks={[]} results={[]} attendance={[]} season={makeSeason()} userId="player-1" onGoToTasks={vi.fn()} onLoadSeasonSummary={onLoadSeasonSummary} onSaveResult={vi.fn()} />)

    const card = await screen.findByRole('button', { name: /Mi temporada/ })
    expect(card).toHaveTextContent('4 oficiales · 2 amistosas')
    await user.click(card)
    expect(screen.getByRole('dialog', { name: 'Marta Jugadora' })).toHaveTextContent('8/9 respuestas')
    expect(onLoadSeasonSummary).toHaveBeenCalledTimes(1)
  })

  test('offers direct access to the next actionable alert', async () => {
    const user = userEvent.setup()
    const onOpenMatch = vi.fn()
    const nextMatch = { id: 'match-1', season_id: 'season-1', opponent: 'Rival Rugby', match_date: addDays(todayIso(), 1), kickoff_time: null, venue: null, is_home: true, notes: null, status: 'published' as const, match_kind: 'official' as const, rugby_format: 'xv' as const, lineup_published: false, created_by: 'owner-1', created_at: '2026-08-01T10:00:00.000Z', updated_at: '2026-08-01T10:00:00.000Z', seasons: { name: '2026/2027' } }
    render(<Dashboard profile={makeProfile()} memberships={[makeMembership()]} tasks={[]} results={[]} attendance={[]} matches={[nextMatch]} userId="player-1" onGoToTasks={vi.fn()} onOpenMatch={onOpenMatch} onSaveResult={vi.fn()} />)
    expect(screen.getByText('Para tener en cuenta').closest('details')).not.toHaveAttribute('open')
    await user.click(screen.getByText('Para tener en cuenta'))
    await user.click(screen.getByRole('button', { name: /Próximo partido/ }))
    expect(onOpenMatch).toHaveBeenCalledWith(nextMatch)
  })

  test('shows agenda notices from today through the end of next week only', () => {
    const currentMonday = mondayFor(new Date())
    render(
      <Dashboard
        profile={makeProfile()}
        memberships={[makeMembership()]}
        tasks={[]}
        results={[]}
        attendance={[]}
        announcements={[
          makeAnnouncement({ id: 'past', title: 'Aviso pasado', announcement_date: addDays(todayIso(), -1) }),
          makeAnnouncement({ id: 'today', title: 'Aviso de hoy', announcement_date: todayIso() }),
          makeAnnouncement({ id: 'next-week', title: 'Aviso próxima semana', announcement_date: addDays(currentMonday, 13) }),
          makeAnnouncement({ id: 'later', title: 'Aviso posterior', announcement_date: addDays(currentMonday, 14) }),
        ]}
        userId="player-1"
        onSaveResult={vi.fn()}
      />,
    )

    expect(screen.getByText('Aviso de hoy')).toBeInTheDocument()
    expect(screen.getByText('Aviso próxima semana')).toBeInTheDocument()
    expect(screen.queryByText('Aviso pasado')).not.toBeInTheDocument()
    expect(screen.queryByText('Aviso posterior')).not.toBeInTheDocument()
  })
})
