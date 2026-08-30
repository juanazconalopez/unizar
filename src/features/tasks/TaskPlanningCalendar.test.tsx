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
})
