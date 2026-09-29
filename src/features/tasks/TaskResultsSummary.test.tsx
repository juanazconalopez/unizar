import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { makeProfile, makeResult, makeTask } from '../../test/fixtures'
import { TaskResultsSummary } from './TaskResultsSummary'

describe('TaskResultsSummary', () => {
  test('shows the team average without counting any staff role', async () => {
    const user = userEvent.setup()
    const task = makeTask()
    render(
      <TaskResultsSummary
        task={task}
        profiles={[
          makeProfile({ id: 'player-1', display_name: 'Ana Martín' }),
          makeProfile({ id: 'player-2', display_name: 'Claudia Pérez' }),
          makeProfile({ id: 'player-coach', display_name: 'Jugadora Entrenadora', is_coach: true }),
          makeProfile({ id: 'owner-1', display_name: 'Owner Excluida', is_owner: true, is_player: false }),
          makeProfile({ id: 'coach-1', display_name: 'Entrenador Excluido', is_coach: true, is_player: false }),
          makeProfile({ id: 'viewer-1', display_name: 'Dirección Excluida', is_viewer: true, is_player: false }),
        ]}
        results={[
          makeResult({ player_id: 'player-1', fatigue_level: 2, result_text: 'Trabajo rápido y sin molestias.' }),
          makeResult({ player_id: 'player-2', fatigue_level: 4, result_text: 'Última serie exigente.' }),
          makeResult({ player_id: 'player-coach', fatigue_level: 3, result_text: 'Cuenta por ser jugadora.' }),
          makeResult({ player_id: 'owner-1', fatigue_level: 5, result_text: 'No debe alterar la media.' }),
          makeResult({ player_id: 'coach-1', fatigue_level: 5, result_text: 'Tampoco cuenta el entrenador.' }),
          makeResult({ player_id: 'viewer-1', fatigue_level: 1, result_text: 'Tampoco cuenta Dirección.' }),
        ]}
      />,
    )

    const summary = document.querySelector<HTMLElement>('.task-results-summary')!
    expect(within(summary).getByText('3').tagName).toBe('STRONG')
    expect(within(summary).getByText('Fatiga media 3.0/5')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver resultados' }))

    const dialog = screen.getByRole('dialog', { name: task.title })
    expect(within(dialog).getByText('Ana Martín')).toBeInTheDocument()
    expect(within(dialog).getByText('Claudia Pérez')).toBeInTheDocument()
    expect(within(dialog).getByText('Jugadora Entrenadora')).toBeInTheDocument()
    expect(within(dialog).getByText('Trabajo rápido y sin molestias.')).toBeInTheDocument()
    expect(within(dialog).queryByText('Owner Excluida')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Entrenador Excluido')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Dirección Excluida')).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('shows an eligible response ratio when supplied by the dashboard', () => {
    const task = makeTask()
    const { container } = render(<TaskResultsSummary eligibleCount={5} profiles={[makeProfile()]} results={[
      makeResult({ fatigue_level: 2 }),
    ]} task={task} />)
    const summary = container.querySelector<HTMLElement>('.task-results-summary')!
    expect(within(summary).getByText('1/5').tagName).toBe('STRONG')
    expect(within(summary).getByText('20%')).toBeInTheDocument()
    expect(within(summary).getByText('Fatiga media 2.0/5')).toBeInTheDocument()
    expect(summary.textContent?.indexOf('Respuestas')).toBeLessThan(summary.textContent!.indexOf('Fatiga media'))
  })

  test('shows an unobtrusive empty state when nobody has responded', () => {
    render(<TaskResultsSummary profiles={[]} results={[]} task={makeTask()} />)
    expect(screen.getByText('Respuestas')).toBeInTheDocument()
    expect(screen.getByText('0').tagName).toBe('STRONG')
    expect(screen.queryByRole('button', { name: 'Ver resultados' })).not.toBeInTheDocument()
  })
})
