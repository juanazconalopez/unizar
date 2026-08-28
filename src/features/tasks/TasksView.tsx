import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { addDays, formatDate, formatWeek, mondayFor, monthEnd, monthStart, todayIso } from '../../lib/dates'
import { canUserCompleteTask } from '../../lib/tasks'
import { compareTaskOrder } from '../../lib/taskOrder'
import type { AnnouncementValues, Profile, ResultValues, Season, SeasonPlayer, TaskResult, TaskStatus, TaskValues, TeamAnnouncement, TrainingTask } from '../../types'
import { AnnouncementCard } from './AnnouncementCard'
import { AnnouncementForm } from './AnnouncementForm'
import { TaskCard } from './TaskCard'
import { TaskAlerts } from './TaskAlerts'
import { TaskForm } from './TaskForm'
import { TaskPlanningCalendar } from './TaskPlanningCalendar'
import { TaskResultsDialog, TaskResultsSummary } from './TaskResultsSummary'
import { StatusControl } from './StatusControl'

export function TasksView({ canManage, seasons, memberships, profiles = [], tasks, announcements = [], results, teamResults, userId, loadingRange = false, focusedDate, focusedAnnouncementId, onCreate, onDelete, onUpdate, onLoadRange, onSaveResult, onReorder, onStatusChange, onSaveAnnouncement, onDeleteAnnouncement, onAnnouncementStatusChange }: {
  canManage: boolean
  seasons: Season[]
  memberships: SeasonPlayer[]
  profiles?: Profile[]
  tasks: TrainingTask[]
  announcements?: TeamAnnouncement[]
  results: TaskResult[]
  teamResults?: TaskResult[]
  userId: string
  loadingRange?: boolean
  focusedDate?: string
  focusedAnnouncementId?: string
  onCreate: (values: TaskValues) => Promise<void>
  onDelete: (task: TrainingTask) => Promise<void>
  onUpdate: (task: TrainingTask, values: TaskValues) => Promise<void>
  onLoadRange?: (fromWeek: string, toWeek: string) => Promise<void>
  onSaveResult: (task: TrainingTask, values: ResultValues) => Promise<void>
  onReorder?: (taskIds: string[]) => Promise<void>
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>
  onSaveAnnouncement?: (announcement: TeamAnnouncement | undefined, values: AnnouncementValues) => Promise<void>
  onDeleteAnnouncement?: (announcement: TeamAnnouncement) => Promise<void>
  onAnnouncementStatusChange?: (id: string, status: TaskStatus) => Promise<void>
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<TrainingTask | null>(null)
  const [copyingTask, setCopyingTask] = useState<TrainingTask | null>(null)
  const [alertResultsTask, setAlertResultsTask] = useState<TrainingTask | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [search, setSearch] = useState('')
  const [visibleWeekCount, setVisibleWeekCount] = useState(3)
  const [managementView, setManagementView] = useState<'calendar' | 'list'>('calendar')
  const [announcementForm, setAnnouncementForm] = useState<TeamAnnouncement | null | undefined>(undefined)
  const [selectedPlanningDate, setSelectedPlanningDate] = useState(focusedDate ?? todayIso())
  const [reorderingTaskId, setReorderingTaskId] = useState<string | null>(null)
  const [planningMonth, setPlanningMonth] = useState(`${(focusedDate ?? todayIso()).slice(0, 7)}-01`)
  const currentWeekRef = useRef<HTMLElement>(null)
  const resultIds = new Set(results.map((result) => result.task_id))
  const normalizedSearch = search.trim().toLocaleLowerCase('es')
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = !normalizedSearch || [task.title, task.description, task.training_type]
      .some((value) => (value ?? '').toLocaleLowerCase('es').includes(normalizedSearch))
    if (!matchesSearch) return false
    if (canManage) return true
    if (task.status !== 'published') return false
    if (filter === 'pending') return !resultIds.has(task.id)
    if (filter === 'completed') return resultIds.has(task.id)
    return true
  })
  const currentWeek = mondayFor(new Date())
  const visiblePlanningTasks = canManage ? tasks : tasks.filter((task) => (
    task.status === 'published' && canUserCompleteTask(task, memberships, userId)
  ))
  const oldestVisibleWeek = addDays(currentWeek, -(visibleWeekCount - 1) * 7)
  const visibleTasks = filteredTasks.filter((task) => {
    if (!canManage && filter === 'pending') return task.week_start === currentWeek
    return task.week_start >= oldestVisibleWeek && (canManage || task.week_start <= currentWeek)
  })
  const taskWeeks = groupTasksByWeek(visibleTasks)
  const displayedTaskWeeks = canManage ? includeCurrentWeek(taskWeeks, currentWeek) : taskWeeks
  const earliestSeasonStart = seasons.reduce<string | null>((earliest, season) => (
    !earliest || season.start_date < earliest ? season.start_date : earliest
  ), null)
  const hasOlderTasks = (canManage || filter !== 'pending') && (
    filteredTasks.some((task) => task.week_start < oldestVisibleWeek)
    || Boolean(onLoadRange && earliestSeasonStart && mondayFor(earliestSeasonStart) < oldestVisibleWeek)
  )
  const selectedPlanningWeek = mondayFor(selectedPlanningDate)
  const selectedWeekTasks = groupTasksByWeek(
    visiblePlanningTasks.filter((task) => task.week_start === selectedPlanningWeek),
  )[0]?.weekTasks ?? []
  const visibleAnnouncements = announcements.filter((announcement) => canManage || announcement.status === 'published')
  const selectedDayAnnouncements = visibleAnnouncements.filter((announcement) => announcement.announcement_date === selectedPlanningDate)
  const formOpen = showForm || editingTask !== null || copyingTask !== null
  const managerResults = teamResults ?? results

  useEffect(() => {
    if (focusedDate && onLoadRange) {
      const week = mondayFor(focusedDate)
      void onLoadRange(week, week).catch(() => undefined)
    }
  }, [focusedDate, onLoadRange])

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

  function changePlanningMonth(nextMonth: string) {
    setPlanningMonth(nextMonth)
    if (onLoadRange) {
      void onLoadRange(mondayFor(monthStart(nextMonth)), mondayFor(monthEnd(nextMonth))).catch(() => undefined)
    }
  }

  async function loadOlderWeeks() {
    const fromWeek = addDays(oldestVisibleWeek, -14)
    const toWeek = addDays(oldestVisibleWeek, -7)
    if (onLoadRange) {
      try {
        await onLoadRange(fromWeek, toWeek)
      } catch {
        return
      }
    }
    setVisibleWeekCount((count) => count + 2)
  }

  function openCreateForm() {
    setEditingTask(null)
    setCopyingTask(null)
    setShowForm(true)
  }

  function openEditForm(task: TrainingTask) {
    setShowForm(false)
    setCopyingTask(null)
    setEditingTask(task)
  }

  function openCopyForm(task: TrainingTask) {
    setShowForm(false)
    setEditingTask(null)
    setCopyingTask(task)
  }

  function closeForm() {
    setShowForm(false)
    setEditingTask(null)
    setCopyingTask(null)
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
    if (onLoadRange) {
      const week = mondayFor(editingTask?.week_start ?? values.date)
      try { await onLoadRange(week, week) } catch { /* The mutation itself already succeeded. */ }
    }
    closeForm()
  }

  async function deleteTask(task: TrainingTask) {
    await onDelete(task)
    if (onLoadRange) {
      try { await onLoadRange(task.week_start, task.week_start) } catch { /* The deletion itself already succeeded. */ }
    }
    closeForm()
  }

  function managerActionsFor(task: TrainingTask) {
    if (!canManage) return undefined
    const orderedWeekTasks = tasks.filter((item) => item.week_start === task.week_start).sort(compareTaskOrder)
    const taskIndex = orderedWeekTasks.findIndex((item) => item.id === task.id)
    return (
      <>
        {onReorder && orderedWeekTasks.length > 1 && !normalizedSearch && <div className="task-order-actions" aria-label={`Ordenar ${task.title}`} role="group">
          <button aria-label={`Subir ${task.title}`} className="secondary-button compact" disabled={taskIndex <= 0 || reorderingTaskId !== null} onClick={() => void moveTask(task, -1)} title="Mover antes" type="button">↑</button>
          <button aria-label={`Bajar ${task.title}`} className="secondary-button compact" disabled={taskIndex < 0 || taskIndex >= orderedWeekTasks.length - 1 || reorderingTaskId !== null} onClick={() => void moveTask(task, 1)} title="Mover después" type="button">↓</button>
        </div>}
        <StatusControl status={task.status} onChange={async (status) => {
          await onStatusChange(task.id, status)
          if (onLoadRange) {
            try { await onLoadRange(task.week_start, task.week_start) } catch { /* The status change itself already succeeded. */ }
          }
        }} />
        <button className="secondary-button compact" onClick={() => openEditForm(task)} type="button">Editar tarea</button>
        <button className="secondary-button compact" onClick={() => openCopyForm(task)} type="button">Copiar</button>
      </>
    )
  }

  async function moveTask(task: TrainingTask, offset: -1 | 1) {
    if (!onReorder) return
    const orderedWeekTasks = tasks.filter((item) => item.week_start === task.week_start).sort(compareTaskOrder)
    const currentIndex = orderedWeekTasks.findIndex((item) => item.id === task.id)
    const targetIndex = currentIndex + offset
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedWeekTasks.length) return
    const nextOrder = [...orderedWeekTasks]
    const targetTask = nextOrder[targetIndex]
    nextOrder[targetIndex] = nextOrder[currentIndex]
    nextOrder[currentIndex] = targetTask
    setReorderingTaskId(task.id)
    try {
      await onReorder(nextOrder.map((item) => item.id))
      if (onLoadRange) await onLoadRange(task.week_start, task.week_start)
    } finally {
      setReorderingTaskId(null)
    }
  }

  function announcementActionsFor(announcement: TeamAnnouncement) {
    if (!canManage) return undefined
    return <>
      <StatusControl status={announcement.status} onChange={async (status) => {
        await onAnnouncementStatusChange?.(announcement.id, status)
        if (onLoadRange) await onLoadRange(mondayFor(announcement.announcement_date), mondayFor(announcement.announcement_date))
      }} />
      <button className="secondary-button compact" onClick={() => setAnnouncementForm(announcement)} type="button">Editar aviso</button>
    </>
  }

  async function saveAnnouncement(values: AnnouncementValues) {
    if (!onSaveAnnouncement) return
    await onSaveAnnouncement(announcementForm ?? undefined, values)
    if (onLoadRange) await onLoadRange(mondayFor(values.date), mondayFor(values.date))
    setSelectedPlanningDate(values.date)
    setPlanningMonth(`${values.date.slice(0, 7)}-01`)
    setAnnouncementForm(undefined)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="PLANIFICACIÓN"
        title="Tareas"
        subtitle={canManage ? 'Crea, publica y revisa los entrenamientos.' : 'Consulta y completa tus entrenamientos.'}
        action={(
          <div className="task-view-actions">
            <button className="secondary-button" onClick={() => { closeForm(); setManagementView((view) => view === 'calendar' ? 'list' : 'calendar') }}>
              <Icon name={managementView === 'calendar' ? 'tasks' : 'calendar'} size={18} />
              {managementView === 'calendar' ? 'Vista de lista' : 'Vista calendario'}
            </button>
            {canManage && managementView === 'list' && !formOpen && (
              <button className="primary-button" onClick={openCreateForm}><Icon name="plus" size={18} />Nueva tarea</button>
            )}
          </div>
        )}
      />
      {canManage && <TaskAlerts currentWeek={currentWeek} onViewResults={setAlertResultsTask} profiles={profiles} results={managerResults} tasks={tasks} />}
      {alertResultsTask && <TaskResultsDialog onClose={() => setAlertResultsTask(null)} profiles={profiles} results={managerResults} task={alertResultsTask} />}
      {announcementForm !== undefined && onSaveAnnouncement && (
        <AnnouncementForm
          announcement={announcementForm ?? undefined}
          initialDate={selectedPlanningDate}
          seasons={seasons}
          onCancel={() => setAnnouncementForm(undefined)}
          onDelete={onDeleteAnnouncement ? async (announcement) => { await onDeleteAnnouncement(announcement); setAnnouncementForm(undefined) } : undefined}
          onSubmit={saveAnnouncement}
        />
      )}
      {formOpen && managementView === 'list' && (
        <TaskForm
          key={editingTask?.id ?? copyingTask?.id ?? 'new-list-task'}
          initialDate={copyingTask?.week_start ?? todayIso()}
          seasons={seasons}
          task={editingTask ?? undefined}
          template={copyingTask ?? undefined}
          onCancel={closeForm}
          onDelete={deleteTask}
          onSubmit={saveTask}
        />
      )}
      {managementView === 'list' && (
        <label className="task-search">
          <span>Buscar tareas</span>
          <span><Icon name="search" size={17} /><input onChange={(event) => setSearch(event.target.value)} placeholder="Título, descripción o tipo…" type="search" value={search} /></span>
        </label>
      )}
      {!canManage && managementView === 'list' && (
        <div className="filter-tabs">
          {(['all', 'pending', 'completed'] as const).map((value) => (
            <button className={filter === value ? 'active' : ''} key={value} onClick={() => changeFilter(value)}>
              {value === 'all' ? 'Todas' : value === 'pending' ? 'Pendientes' : 'Completadas'}
            </button>
          ))}
        </div>
      )}
      {managementView === 'calendar' ? (
        <div className="task-calendar-view">
          <div className="planning-current-action">
            <button className="secondary-button compact" onClick={goToCurrentWeek} type="button">
              <Icon name="calendar" size={16} />Ir a la semana actual
            </button>
          </div>
          <TaskPlanningCalendar
            month={planningMonth}
            selectedDate={selectedPlanningDate}
            tasks={visiblePlanningTasks}
            announcements={visibleAnnouncements}
            onMonthChange={changePlanningMonth}
            onSelectDate={setSelectedPlanningDate}
          />
          <section className="selected-planning-week">
            {selectedDayAnnouncements.length > 0 && <div className="selected-day-announcements">
              <div className="task-week-heading"><div><span className="eyebrow">AVISOS DEL DÍA</span><h2>{formatDate(selectedPlanningDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div><span>{selectedDayAnnouncements.length}</span></div>
              <div className="task-list">{selectedDayAnnouncements.map((announcement) => <AnnouncementCard actions={announcementActionsFor(announcement)} announcement={announcement} initialOpen={focusedAnnouncementId === announcement.id} key={announcement.id} />)}</div>
            </div>}
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
                  managementSummary={canManage ? <TaskResultsSummary profiles={profiles} results={managerResults} task={task} /> : undefined}
                  onSave={task.week_start === currentWeek && canUserCompleteTask(task, memberships, userId) ? onSaveResult : undefined}
                  result={results.find((item) => item.task_id === task.id)}
                  task={task}
                />
              ))}
              {!selectedWeekTasks.length && <EmptyState title="Semana sin tareas" text={canManage ? 'Crea una tarea para empezar a planificar esta semana.' : 'No hay entrenamientos publicados para esta semana.'} />}
            </div>
            <div className="selected-week-actions">
              {canManage && !formOpen && (
                <button className="secondary-button" onClick={() => setAnnouncementForm(null)} type="button">
                  <Icon name="bell" size={18} />Nuevo aviso para este día
                </button>
              )}
              {canManage && !formOpen && (
                <button className="primary-button" onClick={openCreateForm} type="button">
                  <Icon name="plus" size={18} />Nueva tarea en esta semana
                </button>
              )}
            </div>
            {canManage && formOpen && (
              <TaskForm
                key={editingTask?.id ?? copyingTask?.id ?? 'new-calendar-task'}
                initialDate={copyingTask?.week_start ?? selectedPlanningDate}
                seasons={seasons}
                task={editingTask ?? undefined}
                template={copyingTask ?? undefined}
                onCancel={closeForm}
                onDelete={deleteTask}
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
              {filter === 'all' && visibleAnnouncements.filter((announcement) => mondayFor(announcement.announcement_date) === weekStart).map((announcement) => (
                <AnnouncementCard actions={announcementActionsFor(announcement)} announcement={announcement} initialOpen={focusedAnnouncementId === announcement.id} key={announcement.id} />
              ))}
              {weekTasks.map((task) => (
                <TaskCard
                  hideWeek
                  key={task.id}
                  managerActions={managerActionsFor(task)}
                  managementSummary={canManage ? <TaskResultsSummary profiles={profiles} results={managerResults} task={task} /> : undefined}
                  onSave={task.week_start === currentWeek && canUserCompleteTask(task, memberships, userId) ? onSaveResult : undefined}
                  result={results.find((item) => item.task_id === task.id)}
                  task={task}
                />
              ))}
              {canManage && !weekTasks.length && !visibleAnnouncements.some((announcement) => mondayFor(announcement.announcement_date) === weekStart) && <EmptyState title="Semana sin planificación" text="No hay tareas ni avisos planificados para esta semana." />}
            </div>
          </section>
        ))}
        {!displayedTaskWeeks.length && (
          <EmptyState
            title="No hay tareas"
            text={canManage
              ? normalizedSearch ? 'No hay tareas que coincidan con la búsqueda.' : 'Crea la primera tarea para empezar a planificar.'
              : filter === 'pending'
                ? 'No hay tareas pendientes esta semana.'
                : normalizedSearch ? 'No hay tareas que coincidan con la búsqueda.' : 'No hay entrenamientos en esta categoría durante las semanas visibles.'}
          />
        )}
      </div>
      {hasOlderTasks && (
        <div className="load-more-weeks">
          <button className="secondary-button" disabled={loadingRange} onClick={() => void loadOlderWeeks()} type="button">
            {loadingRange ? 'Cargando…' : 'Ver dos semanas anteriores'}
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

function groupTasksByWeek(tasks: TrainingTask[]) {
  const weeks = new Map<string, TrainingTask[]>()
  const orderedTasks = [...tasks].sort((first, second) => {
    const weekOrder = second.week_start.localeCompare(first.week_start)
    if (weekOrder !== 0) return weekOrder
    return compareTaskOrder(first, second)
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
