import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeAttendance, makeMembership, makeProfile, makeResult, makeSeason, makeSession, makeTask } from '../../test/fixtures'
import type { StatisticsSeasonData } from '../../services/trainingQueriesService'
import { SeasonEvolutionView } from './SeasonEvolutionView'

describe('SeasonEvolutionView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-18T10:00:00+02:00'))
  })

  afterEach(() => vi.useRealTimers())

  test('shows one monthly graph for each main seasonal metric', () => {
    const season = makeSeason({ start_date: '2026-08-01', end_date: '2026-10-31' })
    const profile = makeProfile()
    const session = makeSession({ session_date: '2026-09-10' })
    const data: StatisticsSeasonData = {
      announcements: [],
      attendance: [makeAttendance({ session_id: session.id, training_sessions: { session_date: session.session_date } })],
      provisionalAttendance: [],
      results: [makeResult({ performed_on: '2026-09-10' })],
      tasks: [makeTask({ status: 'published' })],
      trainingSessions: [session],
    }

    render(<SeasonEvolutionView
      canViewAttendance
      canViewTasks
      data={data}
      memberships={[makeMembership()]}
      onBack={vi.fn()}
      profiles={[profile]}
      season={season}
    />)

    expect(screen.getByRole('heading', { name: 'Evolución de la temporada' })).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(6)
    expect(screen.getAllByText('ago')).toHaveLength(6)
    expect(screen.getAllByText('sept')).toHaveLength(6)
    expect(screen.getAllByText('oct')).toHaveLength(6)
    expect(screen.getByText('100% de asistencia')).toBeInTheDocument()
    expect(screen.getByText('50% o más')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver al resumen' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir gráfica Entrenamientos' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar gráfica ampliada' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar gráfica ampliada' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
