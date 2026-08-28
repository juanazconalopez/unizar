import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { mondayFor, todayIso } from '../../lib/dates'
import { makeAttendance, makeMembership, makeProfile, makeResult, makeSeason, makeSession, makeTask } from '../../test/fixtures'
import { StatisticsView } from './StatisticsView'

const seasons = [makeSeason()]

describe('StatisticsView', () => {
  test('tolerates incomplete collections while local demo data is loading', () => {
    expect(() => render(
      <StatisticsView
        attendance={undefined as unknown as []}
        memberships={undefined as unknown as []}
        profiles={undefined as unknown as []}
        results={undefined as unknown as []}
        seasons={undefined as unknown as []}
        sessions={undefined as unknown as []}
        tasks={undefined as unknown as []}
      />,
    )).not.toThrow()

    expect(screen.getByRole('heading', { name: 'Resumen mensual' })).toBeInTheDocument()
  })

  test('summarizes the current month and shows per-player detail', () => {
    const today = todayIso()
    const owner = makeProfile({ id: 'owner-1', display_name: 'Owner Excluida', is_owner: true, is_coach: true, is_player: false })
    const profiles = [makeProfile(), makeProfile({ id: 'player-2', display_name: 'María López' }), owner]
    render(
      <StatisticsView
        profiles={profiles}
        seasons={seasons}
        sessions={[makeSession({ session_date: today })]}
        attendance={[
          makeAttendance({ training_sessions: { session_date: today } }),
          makeAttendance({ player_id: 'player-2', attended: false, training_sessions: { session_date: today } }),
          makeAttendance({ player_id: 'owner-1', attended: true, training_sessions: { session_date: today } }),
        ]}
        memberships={[makeMembership(), makeMembership({ player_id: 'player-2' }), makeMembership({ player_id: 'owner-1' })]}
        tasks={[
          makeTask({ week_start: mondayFor(new Date()) }),
          makeTask({ id: 'cancelled-task', week_start: mondayFor(new Date()), status: 'cancelled' }),
          makeTask({ id: 'draft-task', week_start: mondayFor(new Date()), status: 'draft' }),
        ]}
        results={[
          makeResult({ performed_on: today }),
          makeResult({ player_id: 'owner-1', performed_on: today }),
          makeResult({ task_id: 'cancelled-task', player_id: 'player-2', performed_on: today }),
          makeResult({ task_id: 'draft-task', player_id: 'player-2', performed_on: today }),
        ]}
      />,
    )

    const summary = screen.getByRole('region', { name: 'Resumen del mes' })
    expect(within(summary).getByText('Entrenamientos').closest('article')).toHaveTextContent('1')
    expect(within(summary).getByText('Media asistencia').closest('article')).toHaveTextContent('50%')
    expect(within(summary).getByText('Media tareas realizadas').closest('article')).toHaveTextContent('0,5')
    expect(screen.getByText('Ana Martín')).toBeInTheDocument()
    expect(screen.getByText('María López')).toBeInTheDocument()
    expect(screen.queryByText('Owner Excluida')).not.toBeInTheDocument()
    expect(screen.getByText('Asistió al entrenamiento')).toBeInTheDocument()
    expect(screen.getByText('No asistió al entrenamiento')).toBeInTheDocument()
    expect(within(document.querySelector('.weekly-team-summary')!).getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('1 de 2 tareas asignadas completadas por las jugadoras.')).toBeInTheDocument()

    const anaRow = screen.getByText('Ana Martín').closest('article')!
    expect(within(anaRow).getByLabelText('Asistió al entrenamiento de campo')).toBeInTheDocument()
    expect(within(anaRow).getByLabelText('1 tarea realizada este día')).toBeInTheDocument()
    const mariaRow = screen.getByText('María López').closest('article')!
    expect(within(mariaRow).getByLabelText('No asistió al entrenamiento de campo')).toBeInTheDocument()
    expect(within(mariaRow).queryByText('T')).not.toBeInTheDocument()
  })

  test('shows average attendance per training instead of the accumulated total', () => {
    const monthPrefix = todayIso().slice(0, 7)
    const firstTraining = `${monthPrefix}-01`
    const secondTraining = `${monthPrefix}-02`
    const profiles = [
      makeProfile({ id: 'player-1' }),
      makeProfile({ id: 'player-2', display_name: 'Jugadora 2' }),
      makeProfile({ id: 'player-3', display_name: 'Jugadora 3' }),
      makeProfile({ id: 'player-4', display_name: 'Jugadora 4' }),
    ]
    render(
      <StatisticsView
        profiles={profiles}
        seasons={seasons}
        sessions={[
          makeSession({ id: 'session-1', session_date: firstTraining }),
          makeSession({ id: 'session-2', session_date: secondTraining }),
        ]}
        attendance={[
          ...profiles.map((profile, index) => makeAttendance({
            session_id: 'session-1',
            player_id: profile.id,
            attended: index < 2,
            training_sessions: { session_date: firstTraining },
          })),
          ...profiles.map((profile) => makeAttendance({
            session_id: 'session-2',
            player_id: profile.id,
            attended: true,
            training_sessions: { session_date: secondTraining },
          })),
        ]}
        memberships={profiles.map((profile, index) => makeMembership({
          id: `membership-${index + 1}`,
          player_id: profile.id,
        }))}
        tasks={[]}
        results={[]}
      />,
    )

    const summary = screen.getByRole('region', { name: 'Resumen del mes' })
    expect(within(summary).getByText('Media asistencia').closest('article')).toHaveTextContent('75%')
  })

  test('averages completed published tasks across every active player', () => {
    const today = todayIso()
    const profiles = [
      makeProfile({ id: 'player-1' }),
      makeProfile({ id: 'player-2', display_name: 'Jugadora 2' }),
      makeProfile({ id: 'player-3', display_name: 'Jugadora 3' }),
    ]
    render(
      <StatisticsView
        profiles={profiles}
        seasons={seasons}
        sessions={[]}
        attendance={[]}
        memberships={profiles.map((profile, index) => makeMembership({
          id: `task-membership-${index + 1}`,
          player_id: profile.id,
        }))}
        tasks={[
          makeTask({ id: 'task-1' }),
          makeTask({ id: 'task-2' }),
          makeTask({ id: 'task-3' }),
          makeTask({ id: 'draft-task', status: 'draft' }),
        ]}
        results={[
          makeResult({ task_id: 'task-1', player_id: 'player-2', performed_on: today }),
          makeResult({ task_id: 'task-2', player_id: 'player-2', performed_on: today }),
          makeResult({ task_id: 'task-1', player_id: 'player-3', performed_on: today }),
          makeResult({ task_id: 'task-2', player_id: 'player-3', performed_on: today }),
          makeResult({ task_id: 'task-3', player_id: 'player-3', performed_on: today }),
          makeResult({ task_id: 'draft-task', player_id: 'player-1', performed_on: today }),
        ]}
      />,
    )

    const summary = screen.getByRole('region', { name: 'Resumen del mes' })
    expect(within(summary).getByText('Media tareas realizadas').closest('article')).toHaveTextContent('1,7')
  })

  test('keeps historical players in past statistics after they become inactive', () => {
    const today = todayIso()
    const historicalPlayer = makeProfile({ id: 'historical', display_name: 'Jugadora Histórica', is_active: false, is_archived: true })
    render(
      <StatisticsView
        profiles={[historicalPlayer]}
        seasons={seasons}
        sessions={[makeSession({ session_date: today })]}
        attendance={[makeAttendance({
          player_id: historicalPlayer.id,
          training_sessions: { session_date: today },
        })]}
        memberships={[makeMembership({ player_id: historicalPlayer.id })]}
        tasks={[makeTask()]}
        results={[makeResult({ player_id: historicalPlayer.id, performed_on: today })]}
      />,
    )

    const summary = screen.getByRole('region', { name: 'Resumen del mes' })
    expect(within(summary).getByText('Media asistencia').closest('article')).toHaveTextContent('100%')
    expect(within(summary).getByText('Media tareas realizadas').closest('article')).toHaveTextContent('1')
    expect(screen.getByText('Jugadora Histórica')).toBeInTheDocument()
  })

  test('does not show attendance badges when there is no field session that day', () => {
    render(
      <StatisticsView
        profiles={[makeProfile()]}
        seasons={seasons}
        sessions={[]}
        attendance={[]}
        memberships={[makeMembership()]}
        tasks={[]}
        results={[]}
      />,
    )

    expect(screen.queryByText('Ana Martín')).not.toBeInTheDocument()
    expect(screen.getByText('Ninguna jugadora hizo tareas este día ni tiene completa la semana.')).toBeInTheDocument()
    expect(screen.queryByText('Asistió', { selector: '.day-badge-legend span' })).not.toBeInTheDocument()
  })

  test('shows only daily task finishers followed by weekly completers when there is no attendance', () => {
    const today = todayIso()
    const players = [
      makeProfile({ id: 'daily', display_name: 'Zoe Tarea Hoy' }),
      makeProfile({ id: 'complete', display_name: 'Ana Semana Completa' }),
      makeProfile({ id: 'partial', display_name: 'Bea Parcial Anterior' }),
      makeProfile({ id: 'empty', display_name: 'Carla Sin Tareas' }),
    ]
    render(<StatisticsView
      attendance={[]}
      memberships={players.map((player, index) => makeMembership({ id: `membership-${index}`, player_id: player.id }))}
      profiles={players}
      results={[
        makeResult({ task_id: 'task-1', player_id: 'daily', performed_on: today }),
        makeResult({ task_id: 'task-1', player_id: 'complete', performed_on: mondayFor(today) }),
        makeResult({ task_id: 'task-2', player_id: 'complete', performed_on: mondayFor(today) }),
        makeResult({ task_id: 'task-1', player_id: 'partial', performed_on: mondayFor(today) }),
      ]}
      seasons={seasons}
      sessions={[]}
      tasks={[makeTask({ id: 'task-1', week_start: mondayFor(today) }), makeTask({ id: 'task-2', week_start: mondayFor(today) })]}
    />)

    const rows = document.querySelectorAll('.statistics-player')
    expect([...rows].map((row) => row.querySelector('.statistics-player-title strong')?.textContent)).toEqual([
      'Zoe Tarea Hoy',
      'Ana Semana Completa',
    ])
    expect(screen.queryByText('Bea Parcial Anterior')).not.toBeInTheDocument()
    expect(screen.queryByText('Carla Sin Tareas')).not.toBeInTheDocument()
  })

  test('separates attendance and applies task priority inside both lists', () => {
    const today = todayIso()
    const players = [
      makeProfile({ id: 'present-daily', display_name: 'Zoe Presente Hoy' }),
      makeProfile({ id: 'present-complete', display_name: 'Ana Presente Completa' }),
      makeProfile({ id: 'present-rest', display_name: 'Bea Presente Resto' }),
      makeProfile({ id: 'absent-daily', display_name: 'Zoe Ausente Hoy' }),
      makeProfile({ id: 'absent-complete', display_name: 'Ana Ausente Completa' }),
      makeProfile({ id: 'absent-rest', display_name: 'Bea Ausente Resto' }),
    ]
    const results = [
      makeResult({ task_id: 'task-1', player_id: 'present-daily', performed_on: today }),
      makeResult({ task_id: 'task-1', player_id: 'present-complete', performed_on: mondayFor(today) }),
      makeResult({ task_id: 'task-2', player_id: 'present-complete', performed_on: mondayFor(today) }),
      makeResult({ task_id: 'task-1', player_id: 'absent-daily', performed_on: today }),
      makeResult({ task_id: 'task-1', player_id: 'absent-complete', performed_on: mondayFor(today) }),
      makeResult({ task_id: 'task-2', player_id: 'absent-complete', performed_on: mondayFor(today) }),
    ]
    render(<StatisticsView
      attendance={players.map((player, index) => makeAttendance({
        player_id: player.id,
        attended: index < 3,
        training_sessions: { session_date: today },
      }))}
      memberships={players.map((player, index) => makeMembership({ id: `membership-${index}`, player_id: player.id }))}
      profiles={players}
      results={results}
      seasons={seasons}
      sessions={[makeSession({ session_date: today })]}
      tasks={[makeTask({ id: 'task-1', week_start: mondayFor(today) }), makeTask({ id: 'task-2', week_start: mondayFor(today) })]}
    />)

    const present = screen.getByRole('region', { name: 'Asistieron: 3 jugadoras' })
    const absent = screen.getByRole('region', { name: 'No asistieron: 3 jugadoras' })
    expect([...present.querySelectorAll('.statistics-player-title strong')].map((node) => node.textContent)).toEqual([
      'Zoe Presente Hoy', 'Ana Presente Completa', 'Bea Presente Resto',
    ])
    expect([...absent.querySelectorAll('.statistics-player-title strong')].map((node) => node.textContent)).toEqual([
      'Zoe Ausente Hoy', 'Ana Ausente Completa', 'Bea Ausente Resto',
    ])
  })

  test('does not treat an open membership from an ended season as currently active', () => {
    render(
      <StatisticsView
        profiles={[makeProfile()]}
        seasons={[
          makeSeason({ id: 'old-season', start_date: '2025-01-01', end_date: '2025-12-31' }),
          makeSeason({ id: 'current-season', start_date: '2026-01-01', end_date: '2026-12-31' }),
        ]}
        sessions={[]}
        attendance={[]}
        memberships={[makeMembership({ season_id: 'old-season', active_from: '2025-01-01', active_until: null })]}
        tasks={[]}
        results={[]}
      />,
    )

    const summary = screen.getByRole('region', { name: 'Resumen del mes' })
    expect(within(summary).getByText('Media tareas realizadas').closest('article')).toHaveTextContent('—')
    expect(screen.queryByText('Ana Martín')).not.toBeInTheDocument()
  })
})
