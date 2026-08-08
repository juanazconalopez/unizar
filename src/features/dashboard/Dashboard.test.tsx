import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { mondayFor, todayIso } from '../../lib/dates'
import { makeAttendance, makeMembership, makeProfile, makeResult, makeTask } from '../../test/fixtures'
import { Dashboard } from './Dashboard'

describe('Dashboard', () => {
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
        userId="player-1"
        onGoToTasks={vi.fn()}
        onSaveResult={vi.fn()}
      />,
    )

    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('Cumplimiento').closest('article')).toHaveTextContent('50%')
    expect(screen.getByText('Asistencia').closest('article')).toHaveTextContent('50%')
    expect(screen.getByText('Fatiga media').closest('article')).toHaveTextContent('4.0')
    expect(screen.getByText('Tarea completada')).toBeInTheDocument()
    expect(screen.getByText('Tarea pendiente')).toBeInTheDocument()
    expect(screen.queryByText('Borrador oculto')).not.toBeInTheDocument()
    expect(screen.queryByText('Sin pertenencia')).not.toBeInTheDocument()
  })
})
