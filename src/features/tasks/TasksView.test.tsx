import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { addDays, mondayFor } from '../../lib/dates'
import { makeMembership, makeResult, makeSeason, makeTask } from '../../test/fixtures'
import { TasksView } from './TasksView'

describe('TasksView', () => {
  test('filters pending and completed tasks for a player', async () => {
    const user = userEvent.setup()
    const currentWeek = mondayFor(new Date())
    render(
      <TasksView
        canManage={false}
        seasons={[makeSeason()]}
        memberships={[makeMembership()]}
        tasks={[
          makeTask({ id: 'completed', title: 'Completada', week_start: currentWeek }),
          makeTask({ id: 'pending', title: 'Pendiente', week_start: currentWeek }),
          makeTask({ id: 'old-pending', title: 'Pendiente anterior', week_start: addDays(currentWeek, -7) }),
          makeTask({ id: 'old-completed', title: 'Completada anterior', week_start: addDays(currentWeek, -7) }),
          makeTask({ id: 'draft', title: 'Borrador privado', week_start: currentWeek, status: 'draft' }),
          makeTask({ id: 'cancelled', title: 'Anulada privada', week_start: currentWeek, status: 'cancelled' }),
        ]}
        results={[makeResult({ task_id: 'completed' }), makeResult({ task_id: 'old-completed' })]}
        userId="player-1"
        onCreate={vi.fn()}
        onSaveResult={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Pendientes' }))
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    expect(screen.queryByText('Borrador privado')).not.toBeInTheDocument()
    expect(screen.queryByText('Anulada privada')).not.toBeInTheDocument()
    expect(screen.queryByText('Completada')).not.toBeInTheDocument()
    expect(screen.queryByText('Pendiente anterior')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver dos semanas anteriores' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Completadas' }))
    expect(screen.getByText('Completada')).toBeInTheDocument()
    expect(screen.getByText('Completada anterior')).toBeInTheDocument()
    expect(screen.queryByText('Pendiente')).not.toBeInTheDocument()
  })

  test('creates tasks and changes their status in manager mode', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    const onStatusChange = vi.fn().mockResolvedValue(undefined)
    render(
      <TasksView
        canManage
        seasons={[makeSeason()]}
        memberships={[makeMembership()]}
        tasks={[makeTask()]}
        results={[]}
        userId="player-1"
        onCreate={onCreate}
        onSaveResult={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'draft')
    expect(onStatusChange).toHaveBeenCalledWith('task-1', 'draft')

    await user.click(screen.getByRole('button', { name: 'Nueva tarea' }))
    const form = screen.getByRole('heading', { name: 'Crear tarea' }).closest('form')!
    await user.type(within(form).getByLabelText('Título'), 'Trabajo de fuerza')
    await user.selectOptions(within(form).getByLabelText('Temporada'), 'season-1')
    await user.type(within(form).getByLabelText('Descripción'), 'Tres bloques progresivos')
    await user.selectOptions(within(form).getByLabelText('Estado'), 'draft')
    await user.click(within(form).getByRole('button', { name: 'Crear tarea' }))

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      seasonId: 'season-1',
      title: 'Trabajo de fuerza',
      description: 'Tres bloques progresivos',
      status: 'draft',
    }))
  })

  test('groups player tasks in three weeks and loads two more at a time', async () => {
    const user = userEvent.setup()
    const currentWeek = mondayFor(new Date())
    render(
      <TasksView
        canManage={false}
        seasons={[makeSeason()]}
        memberships={[makeMembership()]}
        tasks={[
          makeTask({ id: 'current', title: 'Semana actual', week_start: currentWeek }),
          makeTask({ id: 'previous-1', title: 'Una semana atrás', week_start: addDays(currentWeek, -7) }),
          makeTask({ id: 'previous-2', title: 'Dos semanas atrás', week_start: addDays(currentWeek, -14) }),
          makeTask({ id: 'previous-3', title: 'Tres semanas atrás', week_start: addDays(currentWeek, -21) }),
          makeTask({ id: 'previous-4', title: 'Cuatro semanas atrás', week_start: addDays(currentWeek, -28) }),
        ]}
        results={[]}
        userId="player-1"
        onCreate={vi.fn()}
        onSaveResult={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )

    expect(screen.getByText('SEMANA ACTUAL')).toBeInTheDocument()
    expect(screen.getByText('SEMANA ANTERIOR')).toBeInTheDocument()
    expect(screen.getByText('HACE 2 SEMANAS')).toBeInTheDocument()
    expect(screen.getByText('Dos semanas atrás')).toBeInTheDocument()
    expect(screen.queryByText('Tres semanas atrás')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ver dos semanas anteriores' }))

    expect(screen.getByText('Tres semanas atrás')).toBeInTheDocument()
    expect(screen.getByText('Cuatro semanas atrás')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver dos semanas anteriores' })).not.toBeInTheDocument()
  })

  test('allows completing or editing only tasks from the current week', () => {
    const currentWeek = mondayFor(new Date())
    const previousWeek = addDays(currentWeek, -7)
    render(
      <TasksView
        canManage={false}
        seasons={[makeSeason()]}
        memberships={[makeMembership()]}
        tasks={[
          makeTask({ id: 'current-done', title: 'Actual completada', week_start: currentWeek }),
          makeTask({ id: 'current', title: 'Actual pendiente', week_start: currentWeek }),
          makeTask({ id: 'past-done', title: 'Anterior completada', week_start: previousWeek }),
          makeTask({ id: 'past', title: 'Anterior pendiente', week_start: previousWeek }),
        ]}
        results={[
          makeResult({ task_id: 'current-done' }),
          makeResult({ task_id: 'past-done', performed_on: previousWeek }),
        ]}
        userId="player-1"
        onCreate={vi.fn()}
        onSaveResult={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )

    const currentPending = screen.getByText('Actual pendiente').closest('article')!
    const currentDone = screen.getByText('Actual completada').closest('article')!
    const pastPending = screen.getByText('Anterior pendiente').closest('article')!
    const pastDone = screen.getByText('Anterior completada').closest('article')!

    expect(within(currentPending).getByRole('button', { name: 'Completar' })).toBeInTheDocument()
    expect(within(currentDone).getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(within(pastPending).queryByRole('button', { name: 'Completar' })).not.toBeInTheDocument()
    expect(within(pastDone).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Actual pendiente',
      'Actual completada',
      'Anterior pendiente',
      'Anterior completada',
    ])
  })
})
