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
    expect(within(summary).getByText('1/2')).toBeInTheDocument()
    expect(within(summary).getByText('Jugadoras con tareas').closest('article')).toHaveTextContent('1')
    expect(screen.getByText('Ana Martín')).toBeInTheDocument()
    expect(screen.getByText('María López')).toBeInTheDocument()
    expect(screen.queryByText('Owner Excluida')).not.toBeInTheDocument()
    expect(screen.getByText('Asistió al entrenamiento')).toBeInTheDocument()
    expect(screen.getByText('No asistió al entrenamiento')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('1 de 2 tareas asignadas completadas por las jugadoras.')).toBeInTheDocument()

    const anaRow = screen.getByText('Ana Martín').closest('article')!
    expect(within(anaRow).getByLabelText('Asistió al entrenamiento de campo')).toBeInTheDocument()
    expect(within(anaRow).getByLabelText('1 tarea realizada este día')).toBeInTheDocument()
    const mariaRow = screen.getByText('María López').closest('article')!
    expect(within(mariaRow).getByLabelText('No asistió al entrenamiento de campo')).toBeInTheDocument()
    expect(within(mariaRow).queryByText('T')).not.toBeInTheDocument()
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
