import { render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { TaskPlanningCalendar } from './TaskPlanningCalendar'

describe('planning calendar training plans', () => {
  test('shows only published training plans as a light-green E', () => {
    render(<TaskPlanningCalendar
      announcements={[]}
      month="2026-09-01"
      onMonthChange={vi.fn()}
      onSelectDate={vi.fn()}
      selectedDate="2026-09-01"
      tasks={[]}
      trainingPlans={[
        { id: 'published', session_date: '2026-09-01', title: 'Publicado', status: 'published' },
        { id: 'draft', session_date: '2026-09-01', title: 'Borrador', status: 'draft' },
      ]}
    />)

    const day = screen.getByRole('button', { name: /1 de septiembre.*1 entrenamiento publicado/i })
    expect(within(day).getAllByText('E')).toHaveLength(1)
    expect(screen.getByText('E · Entrenamientos publicados')).toBeInTheDocument()
  })

  test('marks birthdays without exposing an age', () => {
    render(<TaskPlanningCalendar
      birthdays={[{ season_id: 'season-1', player_id: 'player-2', display_name: 'Bea Pérez', birthday_on: '2026-09-03' }]}
      legendVariant="player"
      matches={[]}
      month="2026-09-01"
      onMonthChange={vi.fn()}
      onSelectDate={vi.fn()}
      selectedDate="2026-09-03"
      tasks={[]}
    />)

    const day = screen.getByRole('button', { name: /3 de septiembre.*1 cumpleaños/i })
    expect(within(day).getByText('🎂 1')).toBeInTheDocument()
    expect(screen.getByText('🎂 · Cumpleaños')).toBeInTheDocument()
    expect(screen.queryByText(/\d+ años/)).not.toBeInTheDocument()
  })
})
