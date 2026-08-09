import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { makeProfile, makeResult, makeTask } from '../../test/fixtures'
import { TaskAlerts } from './TaskAlerts'

describe('TaskAlerts', () => {
  test('warns only for fatigue level five and links directly to task results', async () => {
    const user = userEvent.setup()
    const task = makeTask()
    const onViewResults = vi.fn()
    render(
      <TaskAlerts
        currentWeek={task.week_start}
        profiles={[makeProfile(), makeProfile({ id: 'player-2' })]}
        results={[
          makeResult({ fatigue_level: 4 }),
          makeResult({ player_id: 'player-2', fatigue_level: 5 }),
        ]}
        tasks={[task]}
        onViewResults={onViewResults}
      />,
    )

    expect(screen.getByText('1 respuesta con fatiga máxima esta semana')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: task.title }))
    expect(onViewResults).toHaveBeenCalledWith(task)
  })
})
