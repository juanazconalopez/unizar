import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { makeProfile, makeResult, makeTask } from '../../test/fixtures'
import { TaskResultsSummary } from './TaskResultsSummary'

describe('TaskResultsSummary', () => {
  test('shows the team average and lists player comments without counting owners', async () => {
    const user = userEvent.setup()
    const task = makeTask()
    render(
      <TaskResultsSummary
        task={task}
        profiles={[
          makeProfile({ id: 'player-1', display_name: 'Ana Martín' }),
          makeProfile({ id: 'player-2', display_name: 'Claudia Pérez' }),
          makeProfile({ id: 'owner-1', display_name: 'Owner Excluida', is_owner: true }),
        ]}
        results={[
          makeResult({ player_id: 'player-1', fatigue_level: 2, result_text: 'Trabajo rápido y sin molestias.' }),
          makeResult({ player_id: 'player-2', fatigue_level: 4, result_text: 'Última serie exigente.' }),
          makeResult({ player_id: 'owner-1', fatigue_level: 5, result_text: 'No debe alterar la media.' }),
        ]}
      />,
    )

    expect(screen.getByText('3.0/5')).toBeInTheDocument()
    expect(screen.getByText('2 respuestas')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver resultados' }))

    const dialog = screen.getByRole('dialog', { name: task.title })
    expect(within(dialog).getByText('Ana Martín')).toBeInTheDocument()
    expect(within(dialog).getByText('Claudia Pérez')).toBeInTheDocument()
    expect(within(dialog).getByText('Trabajo rápido y sin molestias.')).toBeInTheDocument()
    expect(within(dialog).queryByText('Owner Excluida')).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('shows an unobtrusive empty state when nobody has responded', () => {
    render(<TaskResultsSummary profiles={[]} results={[]} task={makeTask()} />)
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver resultados' })).not.toBeInTheDocument()
  })
})
