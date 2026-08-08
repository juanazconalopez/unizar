import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { addDays, formatDate, formatWeek, mondayFor, todayIso } from '../../lib/dates'
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
        onUpdate={vi.fn()}
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
        isOwner
        seasons={[makeSeason()]}
        memberships={[makeMembership()]}
        tasks={[makeTask({ week_start: mondayFor(new Date()) })]}
        results={[]}
        userId="player-1"
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onSaveResult={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'draft')
    expect(onStatusChange).toHaveBeenCalledWith('task-1', 'draft')

    await user.click(screen.getByRole('button', { name: 'Nueva tarea en esta semana' }))
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

  test('groups management tasks, keeps future planning visible and paginates older weeks', async () => {
    const user = userEvent.setup()
    const currentWeek = mondayFor(new Date())
    render(
      <TasksView
        canManage
        isOwner
        seasons={[makeSeason()]}
        memberships={[makeMembership()]}
        tasks={[
          makeTask({ id: 'future', title: 'Planificación próxima', week_start: addDays(currentWeek, 7), status: 'draft' }),
          makeTask({ id: 'current', title: 'Planificación actual', week_start: currentWeek }),
          makeTask({ id: 'old', title: 'Planificación antigua', week_start: addDays(currentWeek, -21), status: 'cancelled' }),
        ]}
        results={[]}
        userId="player-1"
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onSaveResult={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Vista de lista' }))
    expect(screen.getByText('SEMANA PRÓXIMA')).toBeInTheDocument()
    expect(screen.getByText('SEMANA ACTUAL')).toBeInTheDocument()
    expect(screen.getByText('Planificación próxima')).toBeInTheDocument()
    expect(screen.queryByText('Planificación antigua')).not.toBeInTheDocument()
    expect(screen.getAllByRole('combobox', { name: 'Estado' })).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Ver dos semanas anteriores' }))

    expect(screen.getByText('Planificación antigua')).toBeInTheDocument()
    expect(screen.getByText('HACE 3 SEMANAS')).toBeInTheDocument()
  })

  test('uses the calendar as the initial management view and creates in the selected week', async () => {
    const user = userEvent.setup()
    const today = todayIso()
    const currentWeek = mondayFor(today)
    const selectedDate = [`${today.slice(0, 7)}-01`, `${today.slice(0, 7)}-15`, `${today.slice(0, 7)}-28`]
      .find((date) => mondayFor(date) !== currentWeek)!
    render(
      <TasksView
        canManage
        isOwner
        seasons={[makeSeason()]}
        memberships={[makeMembership()]}
        tasks={[makeTask({ week_start: currentWeek })]}
        results={[]}
        userId="player-1"
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onSaveResult={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('region', { name: 'Calendario de planificación' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vista de lista' })).toBeInTheDocument()
    const currentMondayLabel = `${formatDate(currentWeek, { day: 'numeric', month: 'long' })}: 1 tarea planificada`
    expect(screen.getByRole('button', { name: currentMondayLabel })).toBeInTheDocument()

    await user.click(screen.getByRole('button', {
      name: `${formatDate(selectedDate, { day: 'numeric', month: 'long' })}: 0 tareas planificadas`,
    }))
    expect(screen.getByRole('heading', { name: formatWeek(mondayFor(selectedDate)) })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nueva tarea en esta semana' }))
    const dialog = screen.getByRole('dialog', { name: 'Crear tarea' })
    expect(within(dialog).getByLabelText('Fecha de la semana')).toHaveValue(selectedDate)
    expect(within(dialog).getByLabelText('Descripción')).toHaveAttribute('rows', '7')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Crear tarea' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ir a la semana actual' }))
    expect(screen.getByRole('heading', { name: formatWeek(currentWeek) })).toBeInTheDocument()
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
        onUpdate={vi.fn()}
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

  test('edits the task fields separately from the player result', async () => {
    const user = userEvent.setup()
    const task = makeTask({
      title: 'Título original',
      description: 'Descripción original',
      week_start: mondayFor(new Date()),
      training_type: 'Físico',
    })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(
      <TasksView
        canManage
        isOwner
        seasons={[makeSeason()]}
        memberships={[makeMembership()]}
        tasks={[task]}
        results={[]}
        userId="owner-1"
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onSaveResult={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Editar tarea' }))
    const form = screen.getByRole('heading', { name: 'Editar tarea' }).closest('form')!
    expect(within(form).getByLabelText('Título')).toHaveValue('Título original')
    expect(within(form).getByLabelText('Descripción')).toHaveValue('Descripción original')

    await user.clear(within(form).getByLabelText('Título'))
    await user.type(within(form).getByLabelText('Título'), 'Título actualizado')
    await user.clear(within(form).getByLabelText('Descripción'))
    await user.type(within(form).getByLabelText('Descripción'), 'Nuevas indicaciones')
    await user.selectOptions(within(form).getByLabelText('Estado'), 'draft')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))

    expect(onUpdate).toHaveBeenCalledWith(task, expect.objectContaining({
      title: 'Título actualizado',
      description: 'Nuevas indicaciones',
      status: 'draft',
    }))
  })

  test('allows collaborators to edit only tasks they created', () => {
    const currentWeek = mondayFor(new Date())
    render(
      <TasksView
        canManage
        seasons={[makeSeason()]}
        memberships={[]}
        tasks={[
          makeTask({ id: 'own', title: 'Tarea propia', created_by: 'collaborator-1', week_start: currentWeek }),
          makeTask({ id: 'other', title: 'Tarea de otra persona', created_by: 'owner-1', week_start: currentWeek }),
        ]}
        results={[]}
        userId="collaborator-1"
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onSaveResult={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )

    const ownTask = screen.getByText('Tarea propia').closest('article')!
    const otherTask = screen.getByText('Tarea de otra persona').closest('article')!
    expect(within(ownTask).getByRole('button', { name: 'Editar tarea' })).toBeInTheDocument()
    expect(within(ownTask).getByRole('combobox', { name: 'Estado' })).toBeInTheDocument()
    expect(within(otherTask).queryByRole('button', { name: 'Editar tarea' })).not.toBeInTheDocument()
    expect(within(otherTask).queryByRole('combobox', { name: 'Estado' })).not.toBeInTheDocument()
    expect(within(otherTask).getByText('Publicada')).toBeInTheDocument()
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
        onUpdate={vi.fn()}
        onSaveResult={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )

    const currentPending = screen.getByText('Actual pendiente').closest('article')!
    const currentDone = screen.getByText('Actual completada').closest('article')!
    const pastPending = screen.getByText('Anterior pendiente').closest('article')!
    const pastDone = screen.getByText('Anterior completada').closest('article')!

    expect(within(currentPending).getByRole('button', { name: 'Completar' })).toBeInTheDocument()
    expect(within(currentDone).getByRole('button', { name: 'Editar resultado' })).toBeInTheDocument()
    expect(within(pastPending).queryByRole('button', { name: 'Completar' })).not.toBeInTheDocument()
    expect(within(pastDone).queryByRole('button', { name: 'Editar resultado' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Actual pendiente',
      'Actual completada',
      'Anterior pendiente',
      'Anterior completada',
    ])
  })
})
