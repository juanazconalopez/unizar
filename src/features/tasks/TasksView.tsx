import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { addDays, formatWeek, mondayFor } from '../../lib/dates'
import { canUserCompleteTask } from '../../lib/tasks'
import type { ResultValues, Season, SeasonPlayer, TaskResult, TaskStatus, TaskValues, TrainingTask } from '../../types'
import { TaskCard } from './TaskCard'
import { TaskForm } from './TaskForm'

export function TasksView({ canManage, seasons, memberships, tasks, results, userId, onCreate, onSaveResult, onStatusChange }: {
  canManage: boolean
  seasons: Season[]
  memberships: SeasonPlayer[]
  tasks: TrainingTask[]
  results: TaskResult[]
  userId: string
  onCreate: (values: TaskValues) => Promise<void>
  onSaveResult: (task: TrainingTask, values: ResultValues) => Promise<void>
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [visibleWeekCount, setVisibleWeekCount] = useState(3)
  const resultIds = new Set(results.map((result) => result.task_id))
  const filteredTasks = tasks.filter((task) => {
    if (canManage) return true
    if (task.status !== 'published') return false
    if (filter === 'pending') return !resultIds.has(task.id)
    if (filter === 'completed') return resultIds.has(task.id)
    return true
  })
  const currentWeek = mondayFor(new Date())
  const oldestVisibleWeek = addDays(currentWeek, -(visibleWeekCount - 1) * 7)
  const visibleTasks = canManage
    ? filteredTasks
    : filteredTasks.filter((task) => (
      filter === 'pending'
        ? task.week_start === currentWeek
        : task.week_start >= oldestVisibleWeek && task.week_start <= currentWeek
    ))
  const taskWeeks = canManage ? [] : groupTasksByWeek(visibleTasks, resultIds)
  const hasOlderTasks = !canManage
    && filter !== 'pending'
    && filteredTasks.some((task) => task.week_start < oldestVisibleWeek)

  function changeFilter(nextFilter: typeof filter) {
    setFilter(nextFilter)
    setVisibleWeekCount(3)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="PLANIFICACIÓN"
        title="Tareas"
        subtitle={canManage ? 'Crea, publica y revisa los entrenamientos.' : 'Consulta y completa tus entrenamientos.'}
        action={canManage ? <button className="primary-button" onClick={() => setShowForm(true)}><Icon name="plus" size={18} />Nueva tarea</button> : undefined}
      />
      {showForm && (
        <TaskForm
          seasons={seasons}
          onCancel={() => setShowForm(false)}
          onCreate={async (values) => { await onCreate(values); setShowForm(false) }}
        />
      )}
      {!canManage && (
        <div className="filter-tabs">
          {(['all', 'pending', 'completed'] as const).map((value) => (
            <button className={filter === value ? 'active' : ''} key={value} onClick={() => changeFilter(value)}>
              {value === 'all' ? 'Todas' : value === 'pending' ? 'Pendientes' : 'Completadas'}
            </button>
          ))}
        </div>
      )}
      {canManage ? (
        <div className="task-list">
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              managerActions={<StatusControl status={task.status} onChange={(status) => onStatusChange(task.id, status)} />}
              onSave={task.week_start === currentWeek && canUserCompleteTask(task, memberships, userId) ? onSaveResult : undefined}
              result={results.find((item) => item.task_id === task.id)}
              task={task}
            />
          ))}
          {!visibleTasks.length && <EmptyState title="No hay tareas" text="Crea la primera tarea para empezar a planificar." />}
        </div>
      ) : (
        <>
          <div className="task-week-list">
            {taskWeeks.map(({ weekStart, weekTasks }) => (
              <section className="task-week-group" key={weekStart}>
                <div className="task-week-heading">
                  <div><span className="eyebrow">{weekRelativeLabel(weekStart, currentWeek)}</span><h2>{formatWeek(weekStart)}</h2></div>
                  <span>{weekTasks.length} {weekTasks.length === 1 ? 'tarea' : 'tareas'}</span>
                </div>
                <div className="task-list">
                  {weekTasks.map((task) => (
                    <TaskCard
                      hideWeek
                      key={task.id}
                      onSave={task.week_start === currentWeek && canUserCompleteTask(task, memberships, userId) ? onSaveResult : undefined}
                      result={results.find((item) => item.task_id === task.id)}
                      task={task}
                    />
                  ))}
                </div>
              </section>
            ))}
            {!visibleTasks.length && (
              <EmptyState
                title="No hay tareas"
                text={filter === 'pending' ? 'No hay tareas pendientes esta semana.' : 'No hay entrenamientos en esta categoría durante las semanas visibles.'}
              />
            )}
          </div>
          {hasOlderTasks && (
            <div className="load-more-weeks">
              <button className="secondary-button" onClick={() => setVisibleWeekCount((count) => count + 2)} type="button">
                Ver dos semanas anteriores
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function groupTasksByWeek(tasks: TrainingTask[], resultIds: Set<string>) {
  const weeks = new Map<string, TrainingTask[]>()
  const orderedTasks = [...tasks].sort((first, second) => {
    const weekOrder = second.week_start.localeCompare(first.week_start)
    if (weekOrder !== 0) return weekOrder
    const completionOrder = Number(resultIds.has(first.id)) - Number(resultIds.has(second.id))
    if (completionOrder !== 0) return completionOrder
    return first.created_at.localeCompare(second.created_at) || first.id.localeCompare(second.id)
  })
  for (const task of orderedTasks) {
    weeks.set(task.week_start, [...(weeks.get(task.week_start) ?? []), task])
  }
  return [...weeks].map(([weekStart, weekTasks]) => ({ weekStart, weekTasks }))
}

function weekRelativeLabel(weekStart: string, currentWeek: string) {
  if (weekStart === currentWeek) return 'SEMANA ACTUAL'
  if (weekStart === addDays(currentWeek, -7)) return 'SEMANA ANTERIOR'
  const weeksAgo = Math.round((Date.parse(`${currentWeek}T12:00:00`) - Date.parse(`${weekStart}T12:00:00`)) / 604_800_000)
  return `HACE ${weeksAgo} SEMANAS`
}

function StatusControl({ status, onChange }: { status: TaskStatus; onChange: (status: TaskStatus) => void }) {
  return (
    <select aria-label="Estado" className={`status-select ${status}`} onChange={(event) => onChange(event.target.value as TaskStatus)} value={status}>
      <option value="draft">Borrador</option>
      <option value="published">Publicada</option>
      <option value="cancelled">Anulada</option>
    </select>
  )
}
