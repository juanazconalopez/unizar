import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { mondayFor } from '../../lib/dates'
import { canUserCompleteTask } from '../../lib/tasks'
import type { Profile, ResultValues, SeasonPlayer, TaskResult, TrainingTask } from '../../types'
import { TaskCard } from '../tasks/TaskCard'

export function Dashboard({ profile, memberships, tasks, results, userId, onGoToTasks, onSaveResult }: {
  profile: Profile
  memberships: SeasonPlayer[]
  tasks: TrainingTask[]
  results: TaskResult[]
  userId: string
  onGoToTasks: () => void
  onSaveResult: (task: TrainingTask, values: ResultValues) => Promise<void>
}) {
  const currentMonday = mondayFor(new Date())
  const weekTasks = tasks.filter((task) => (
    task.week_start === currentMonday
    && task.status === 'published'
    && canUserCompleteTask(task, memberships, userId)
  ))
  const completedIds = new Set(results.map((result) => result.task_id))
  const completed = weekTasks.filter((task) => completedIds.has(task.id)).length
  const completion = weekTasks.length ? Math.round((completed / weekTasks.length) * 100) : 0
  const averageFatigue = results.length
    ? (results.reduce((sum, result) => sum + result.fatigue_level, 0) / results.length).toFixed(1)
    : '—'

  return (
    <div className="page">
      <PageHeader
        eyebrow="PANEL PERSONAL"
        title={`Hola, ${profile.display_name.split(' ')[0]}`}
        subtitle="Este es el resumen de tu semana."
      />
      <section className="stats-grid">
        <StatCard label="Esta semana" value={`${completed}/${weekTasks.length}`} note="tareas completadas" tone="green" />
        <StatCard label="Cumplimiento" value={`${completion}%`} note="esta semana" tone="blue" />
        <StatCard label="Fatiga media" value={averageFatigue} note="en tus registros" tone="coral" />
      </section>
      <section className="section-block">
        <div className="section-heading">
          <div><span className="eyebrow">SEMANA ACTUAL</span><h2>Tus entrenamientos</h2></div>
          <button className="text-button" onClick={onGoToTasks}>Ver todas <Icon name="arrow" size={17} /></button>
        </div>
        {weekTasks.length ? (
          <div className="task-list">
            {weekTasks.slice(0, 4).map((task) => (
              <TaskCard
                key={task.id}
                result={results.find((item) => item.task_id === task.id)}
                task={task}
                onSave={onSaveResult}
              />
            ))}
          </div>
        ) : <EmptyState title="Semana despejada" text="Todavía no hay entrenamientos publicados para esta semana." />}
      </section>
    </div>
  )
}

function StatCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return <article className={`stat-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}
