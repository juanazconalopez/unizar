import { Icon } from '../../components/Icon'
import { profilesById, resultsByTask } from '../../lib/selectors'
import { isPlayer } from '../../lib/permissions'
import type { Profile, TaskResult, TrainingTask } from '../../types'

export function TaskAlerts({ currentWeek, profiles, results, tasks, showFatigue = true, onViewResults }: {
  currentWeek: string
  profiles: Profile[]
  results: TaskResult[]
  tasks: TrainingTask[]
  showFatigue?: boolean
  onViewResults?: (task: TrainingTask) => void
}) {
  const profileMap = profilesById(profiles)
  const playerResults = results.filter((result) => {
    const profile = profileMap.get(result.player_id)
    return !profile || isPlayer(profile)
  })
  const groupedResults = resultsByTask(playerResults)
  const currentTasks = tasks.filter((task) => task.week_start === currentWeek && task.status === 'published')
  const unanswered = currentTasks.filter((task) => !(groupedResults.get(task.id)?.length))
  const criticalTasks = currentTasks.map((task) => ({
    task,
    count: (groupedResults.get(task.id) ?? []).filter((result) => result.fatigue_level === 5).length,
  })).filter((item) => item.count > 0)
  const criticalCount = showFatigue && onViewResults ? criticalTasks.reduce((total, item) => total + item.count, 0) : 0
  if (!unanswered.length && !criticalCount) return null

  return (
    <section aria-label="Alertas de la semana" className="task-alerts">
      {criticalCount > 0 && (
        <article className="fatigue"><Icon name="spark" size={18} /><div><strong>{criticalCount} {criticalCount === 1 ? 'respuesta con fatiga máxima esta semana' : 'respuestas con fatiga máxima esta semana'}</strong><span>Fatiga registrada con nivel 5.</span><div className="task-alert-links">{criticalTasks.map(({ task, count }) => <button key={task.id} onClick={() => onViewResults?.(task)} type="button">{task.title}{count > 1 ? ` (${count})` : ''}</button>)}</div></div></article>
      )}
      {unanswered.length > 0 && (
        <article><Icon name="clock" size={18} /><div><strong>{unanswered.length} {unanswered.length === 1 ? 'tarea sin respuestas' : 'tareas sin respuestas'}</strong><span>Publicadas esta semana y todavía sin resultados.</span></div></article>
      )}
    </section>
  )
}
