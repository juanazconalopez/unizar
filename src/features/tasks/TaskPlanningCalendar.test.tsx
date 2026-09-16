import { render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { TaskPlanningCalendar } from './TaskPlanningCalendar'

describe('planning calendar training plans', () => {
  test('shows published and draft training plans as E marks for staff planning', () => {
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

    const day = screen.getByRole('button', { name: /1 de septiembre.*2 entrenamientos programados/i })
    expect(within(day).getAllByText('E')).toHaveLength(2)
    expect(screen.getByText('E · Entrenamientos publicados y borradores')).toBeInTheDocument()
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

  test('shows configured season holidays with a light background class', () => {
    render(<TaskPlanningCalendar announcements={[]} holidays={['2026-09-08']} month="2026-09-01" onMonthChange={vi.fn()} onSelectDate={vi.fn()} selectedDate="2026-09-08" tasks={[]} />)
    expect(screen.getByRole('button', { name: /^8 de septiembre/i })).toHaveClass('holiday')
  })

  test('draws an open survey as a temporary range and marks only the latest answer', () => {
    render(<TaskPlanningCalendar
      announcements={[]}
      month="2026-09-01"
      onMonthChange={vi.fn()}
      onSelectDate={vi.fn()}
      selectedDate="2026-09-12"
      surveys={[{ id: 'survey-1', title: 'Disponibilidad', state: 'active', startsOn: '2026-09-10', endsOn: '2026-09-14', respondedOn: '2026-09-12' }]}
      tasks={[]}
    />)

    expect(screen.getByRole('button', { name: /11 de septiembre.*encuesta abierta/i }).querySelector('.survey-active-range')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /12 de septiembre.*resultado de encuesta/i })).getByText('Q 1')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /11 de septiembre.*encuesta abierta/i })).queryByText('Q 1')).not.toBeInTheDocument()
    expect(screen.getByText('Encuestas abiertas')).toBeInTheDocument()
  })

  test('removes the temporary range after closing and leaves the Q on the result day', () => {
    render(<TaskPlanningCalendar
      announcements={[]}
      month="2026-09-01"
      onMonthChange={vi.fn()}
      onSelectDate={vi.fn()}
      selectedDate="2026-09-15"
      surveys={[{ id: 'survey-1', title: 'Disponibilidad', result_date: '2026-09-15', state: 'closed', startsOn: '2026-09-10', endsOn: '2026-09-14' }]}
      tasks={[]}
    />)

    const resultDay = screen.getByRole('button', { name: /15 de septiembre.*resultado de encuesta/i })
    expect(within(resultDay).getByText('Q 1')).toBeInTheDocument()
    expect(resultDay.querySelector('.survey-active-range')).not.toBeInTheDocument()
  })

  test('marks the day after an open survey closes for provisional management results', () => {
    render(<TaskPlanningCalendar
      announcements={[]}
      month="2026-09-01"
      onMonthChange={vi.fn()}
      onSelectDate={vi.fn()}
      selectedDate="2026-09-15"
      surveys={[{ id: 'survey-1', title: 'Disponibilidad', result_date: '2026-09-15', state: 'active', startsOn: '2026-09-10', endsOn: '2026-09-14' }]}
      tasks={[]}
    />)

    const resultDay = screen.getByRole('button', { name: /15 de septiembre.*resultado de encuesta/i })
    expect(within(resultDay).getByText('Q 1')).toBeInTheDocument()
    expect(resultDay.querySelector('.survey-active-range')).not.toBeInTheDocument()
  })

  test('keeps simultaneous open surveys in separate coloured tracks', () => {
    render(<TaskPlanningCalendar
      announcements={[]}
      month="2026-09-01"
      onMonthChange={vi.fn()}
      onSelectDate={vi.fn()}
      selectedDate="2026-09-12"
      surveys={[
        { id: 'survey-1', title: 'Viaje', state: 'active', startsOn: '2026-09-10', endsOn: '2026-09-14' },
        { id: 'survey-2', title: 'Material', state: 'active', startsOn: '2026-09-12', endsOn: '2026-09-16' },
      ]}
      tasks={[]}
    />)

    const day = screen.getByRole('button', { name: /12 de septiembre.*2 encuestas abiertas/i })
    expect(day.querySelectorAll('.survey-active-range')).toHaveLength(2)
    expect(day.querySelector('.survey-active-range[data-survey-tone="0"]')).toBeInTheDocument()
    expect(day.querySelector('.survey-active-range[data-survey-tone="1"]')).toBeInTheDocument()
  })
})
