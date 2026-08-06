import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
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
  const resultIds = new Set(results.map((result) => result.task_id))
  const visibleTasks = tasks.filter((task) => {
    if (canManage) return true
    if (filter === 'pending') return !resultIds.has(task.id)
    if (filter === 'completed') return resultIds.has(task.id)
    return true
  })

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
            <button className={filter === value ? 'active' : ''} key={value} onClick={() => setFilter(value)}>
              {value === 'all' ? 'Todas' : value === 'pending' ? 'Pendientes' : 'Completadas'}
            </button>
          ))}
        </div>
      )}
      <div className="task-list">
        {visibleTasks.map((task) => (
          <TaskCard
            key={task.id}
            managerActions={canManage ? <StatusControl status={task.status} onChange={(status) => onStatusChange(task.id, status)} /> : undefined}
            onSave={canUserCompleteTask(task, memberships, userId) ? onSaveResult : undefined}
            result={results.find((item) => item.task_id === task.id)}
            task={task}
          />
        ))}
        {!visibleTasks.length && <EmptyState title="No hay tareas" text={canManage ? 'Crea la primera tarea para empezar a planificar.' : 'No hay entrenamientos en esta categoría.'} />}
      </div>
    </div>
  )
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
