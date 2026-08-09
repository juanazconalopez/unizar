import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { mondayFor, todayIso } from '../../lib/dates'
import { makeAttendance, makeMembership, makeProfile, makeResult, makeSession, makeTask } from '../../test/fixtures'
import { StatisticsView } from './StatisticsView'

describe('StatisticsView', () => {
  test('summarizes the current month and shows per-player detail', () => {
    const today = todayIso()
    const owner = makeProfile({ id: 'owner-1', display_name: 'Owner Excluida', is_owner: true, is_collaborator: true })
    const profiles = [makeProfile(), makeProfile({ id: 'player-2', display_name: 'María López' }), owner]
    render(
      <StatisticsView
        profiles={profiles}
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
        memberships={[]}
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
        sessions={[]}
        attendance={[]}
        memberships={[]}
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

  test('does not show attendance badges when there is no field session that day', () => {
    render(
      <StatisticsView
        profiles={[makeProfile()]}
        sessions={[]}
        attendance={[]}
        memberships={[]}
        tasks={[]}
        results={[]}
      />,
    )

    const playerRow = screen.getByText('Ana Martín').closest('article')!
    expect(within(playerRow).getByText('Sin entrenamiento de campo')).toBeInTheDocument()
    expect(within(playerRow).queryByLabelText('Asistió al entrenamiento de campo')).not.toBeInTheDocument()
    expect(within(playerRow).queryByLabelText('No asistió al entrenamiento de campo')).not.toBeInTheDocument()
    expect(within(playerRow).queryByLabelText('Asistencia sin registrar')).not.toBeInTheDocument()
    expect(screen.queryByText('Asistió', { selector: '.day-badge-legend span' })).not.toBeInTheDocument()
  })
})
