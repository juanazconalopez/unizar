import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { addDays, formatWeek, mondayFor, todayIso } from '../../lib/dates'
import { canUserCompleteTask } from '../../lib/tasks'
import type { ResultValues, Season, SeasonPlayer, TaskResult, TaskStatus, TaskValues, TrainingTask } from '../../types'
import { TaskCard } from './TaskCard'
import { TaskForm } from './TaskForm'
import { TaskPlanningCalendar } from './TaskPlanningCalendar'

export function TasksView({ canManage, isOwner = false, seasons, memberships, tasks, results, userId, onCreate, onUpdate, onSaveResult, onStatusChange }: {
  canManage: boolean
  isOwner?: boolean
  seasons: Season[]
  memberships: SeasonPlayer[]
  tasks: TrainingTask[]
  results: TaskResult[]
  userId: string
  onCreate: (values: TaskValues) => Promise<void>
  onUpdate: (task: TrainingTask, values: TaskValues) => Promise<void>
  onSaveResult: (task: TrainingTask, values: ResultValues) => Promise<void>
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<TrainingTask | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [visibleWeekCount, setVisibleWeekCount] = useState(3)
  const [managementView, setManagementView] = useState<'calendar' | 'list'>('calendar')
  const [selectedPlanningDate, setSelectedPlanningDate] = useState(todayIso())
  const [planningMonth, setPlanningMonth] = useState(`${todayIso().slice(0, 7)}-01`)
  const currentWeekRef = useRef<HTMLElement>(null)
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
  const visibleTasks = filteredTasks.filter((task) => {
    if (!canManage && filter === 'pending') return task.week_start === currentWeek
    return task.week_start >= oldestVisibleWeek && (canManage || task.week_start <= currentWeek)
  })
  const taskWeeks = groupTasksByWeek(visibleTasks, resultIds)
  const displayedTaskWeeks = canManage ? includeCurrentWeek(taskWeeks, currentWeek) : taskWeeks
  const hasOlderTasks = (canManage || filter !== 'pending')
    && filteredTasks.some((task) => task.week_start < oldestVisibleWeek)
  const selectedPlanningWeek = mondayFor(selectedPlanningDate)
  const selectedWeekTasks = groupTasksByWeek(
    tasks.filter((task) => task.week_start === selectedPlanningWeek),
    resultIds,
  )[0]?.weekTasks ?? []
  const formOpen = showForm || editingTask !== null

  useEffect(() => {
    if (!canManage || managementView !== 'list') return
    const frame = window.requestAnimationFrame(() => {
      currentWeekRef.current?.scrollIntoView?.({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [canManage, managementView])

  function changeFilter(nextFilter: typeof filter) {
    setFilter(nextFilter)
    setVisibleWeekCount(3)
  }

  function goToCurrentWeek() {
    const today = todayIso()
    setSelectedPlanningDate(today)
    setPlanningMonth(`${today.slice(0, 7)}-01`)
  }

  function openCreateForm() {
    setEditingTask(null)
    setShowForm(true)
  }

  function openEditForm(task: TrainingTask) {
    setShowForm(false)
    setEditingTask(task)
  }

  function closeForm() {
    setShowForm(false)
    setEditingTask(null)
  }

  async function saveTask(values: TaskValues) {
    if (editingTask) {
      await onUpdate(editingTask, values)
      if (managementView === 'calendar') {
        setSelectedPlanningDate(values.date)
        setPlanningMonth(`${values.date.slice(0, 7)}-01`)
      }
    } else {
      await onCreate(values)
    }
    closeForm()
  }

  function managerActionsFor(task: TrainingTask) {
    if (!canManage) return undefined
    const canEdit = isOwner || task.created_by === userId
    if (!canEdit) return <span className={`status-select ${task.status}`}>{statusLabel(task.status)}</span>
    return (
      <>
        <StatusControl status={task.status} onChange={(status) => onStatusChange(task.id, status)} />
        <button className="secondary-button compact" onClick={() => openEditForm(task)} type="button">Editar tarea</button>
      </>
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="PLANIFICACIÓN"
        title="Tareas"
        subtitle={canManage ? 'Crea, publica y revisa los entrenamientos.' : 'Consulta y completa tus entrenamientos.'}
        action={canManage ? (
          <div className="task-view-actions">
            <button className="secondary-button" onClick={() => { closeForm(); setManagementView((view) => view === 'calendar' ? 'list' : 'calendar') }}>
              <Icon name={managementView === 'calendar' ? 'tasks' : 'calendar'} size={18} />
              {managementView === 'calendar' ? 'Vista de lista' : 'Vista calendario'}
            </button>
            {managementView === 'list' && !formOpen && (
              <button className="primary-button" onClick={openCreateForm}><Icon name="plus" size={18} />Nueva tarea</button>
            )}
          </div>
        ) : undefined}
      />
      {formOpen && managementView === 'list' && (
        <TaskForm
          key={editingTask?.id ?? 'new-list-task'}
          initialDate={todayIso()}
          seasons={seasons}
          task={editingTask ?? undefined}
          onCancel={closeForm}
          onSubmit={saveTask}
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
      {canManage && managementView === 'calendar' ? (
        <div className="task-calendar-view">
          <div className="planning-current-action">
            <button className="secondary-button compact" onClick={goToCurrentWeek} type="button">
              <Icon name="calendar" size={16} />Ir a la semana actual
            </button>
          </div>
          <TaskPlanningCalendar
            month={planningMonth}
            selectedDate={selectedPlanningDate}
            tasks={tasks}
            onMonthChange={setPlanningMonth}
            onSelectDate={setSelectedPlanningDate}
          />
          <section className="selected-planning-week">
            <div className="task-week-heading">
              <div><span className="eyebrow">SEMANA SELECCIONADA</span><h2>{formatWeek(selectedPlanningWeek)}</h2></div>
              <span>{selectedWeekTasks.length} {selectedWeekTasks.length === 1 ? 'tarea' : 'tareas'}</span>
            </div>
            <div className="task-list">
              {selectedWeekTasks.map((task) => (
                <TaskCard
                  hideWeek
                  key={task.id}
                  managerActions={managerActionsFor(task)}
                  onSave={task.week_start === currentWeek && canUserCompleteTask(task, memberships, userId) ? onSaveResult : undefined}
                  result={results.find((item) => item.task_id === task.id)}
                  task={task}
                />
              ))}
              {!selectedWeekTasks.length && <EmptyState title="Semana sin tareas" text="Crea una tarea para empezar a planificar esta semana." />}
            </div>
            <div className="selected-week-actions">
              {!formOpen && (
                <button className="primary-button" onClick={openCreateForm} type="button">
                  <Icon name="plus" size={18} />Nueva tarea en esta semana
                </button>
              )}
            </div>
            {formOpen && (
              <TaskForm
                key={editingTask?.id ?? 'new-calendar-task'}
                initialDate={selectedPlanningDate}
                seasons={seasons}
                task={editingTask ?? undefined}
                onCancel={closeForm}
                onSubmit={saveTask}
              />
            )}
          </section>
        </div>
      ) : <>
        <div className="task-week-list">
        {displayedTaskWeeks.map(({ weekStart, weekTasks }) => (
          <section className="task-week-group" key={weekStart} ref={weekStart === currentWeek ? currentWeekRef : undefined}>
            <div className="task-week-heading">
              <div><span className="eyebrow">{weekRelativeLabel(weekStart, currentWeek)}</span><h2>{formatWeek(weekStart)}</h2></div>
              <span>{weekTasks.length} {weekTasks.length === 1 ? 'tarea' : 'tareas'}</span>
            </div>
            <div className="task-list">
              {weekTasks.map((task) => (
                <TaskCard
                  hideWeek
                  key={task.id}
                  managerActions={managerActionsFor(task)}
                  onSave={task.week_start === currentWeek && canUserCompleteTask(task, memberships, userId) ? onSaveResult : undefined}
                  result={results.find((item) => item.task_id === task.id)}
                  task={task}
                />
              ))}
              {canManage && !weekTasks.length && <EmptyState title="Semana sin tareas" text="No hay tareas planificadas para la semana actual." />}
            </div>
          </section>
        ))}
        {!displayedTaskWeeks.length && (
          <EmptyState
            title="No hay tareas"
            text={canManage
              ? 'Crea la primera tarea para empezar a planificar.'
              : filter === 'pending'
                ? 'No hay tareas pendientes esta semana.'
                : 'No hay entrenamientos en esta categoría durante las semanas visibles.'}
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
      </>}
    </div>
  )
}

function includeCurrentWeek(taskWeeks: Array<{ weekStart: string; weekTasks: TrainingTask[] }>, currentWeek: string) {
  if (taskWeeks.some((week) => week.weekStart === currentWeek)) return taskWeeks
  return [...taskWeeks, { weekStart: currentWeek, weekTasks: [] }]
    .sort((first, second) => second.weekStart.localeCompare(first.weekStart))
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
  if (weekStart === addDays(currentWeek, 7)) return 'SEMANA PRÓXIMA'
  if (weekStart === addDays(currentWeek, -7)) return 'SEMANA ANTERIOR'
  const weeksAgo = Math.round((Date.parse(`${currentWeek}T12:00:00`) - Date.parse(`${weekStart}T12:00:00`)) / 604_800_000)
  if (weeksAgo < 0) return `DENTRO DE ${Math.abs(weeksAgo)} SEMANAS`
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

function statusLabel(status: TaskStatus) {
  if (status === 'published') return 'Publicada'
  if (status === 'draft') return 'Borrador'
  return 'Anulada'
}
