import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, mondayFor, todayIso } from '../../lib/dates'
import { canUserCompleteTask } from '../../lib/tasks'
import type { AttendanceRecord, Match, Profile, ResultValues, SeasonPlayer, TaskResult, TeamAnnouncement, TrainingTask } from '../../types'
import { TaskCard } from '../tasks/TaskCard'

export function Dashboard({ profile, memberships, tasks, announcements = [], matches = [], results, attendance, userId, onGoToTasks, onOpenMatch, onOpenAnnouncement, onSaveResult }: {
  profile: Profile
  memberships: SeasonPlayer[]
  tasks: TrainingTask[]
  results: TaskResult[]
  attendance: AttendanceRecord[]
  announcements?: TeamAnnouncement[]
  matches?: Match[]
  userId: string
  onGoToTasks: () => void
  onOpenMatch?: (match: Match) => void
  onOpenAnnouncement?: (announcement: TeamAnnouncement) => void
  onSaveResult: (task: TrainingTask, values: ResultValues) => Promise<void>
}) {
  const currentMonday = mondayFor(new Date())
  const publishedTaskIds = new Set(tasks.filter((task) => task.status === 'published').map((task) => task.id))
  const publishedResults = results.filter((result) => publishedTaskIds.has(result.task_id))
  const completedIds = new Set(publishedResults.map((result) => result.task_id))
  const weekTasks = tasks
    .filter((task) => (
      task.week_start === currentMonday
      && task.status === 'published'
      && canUserCompleteTask(task, memberships, userId)
    ))
    .sort((first, second) => {
      const completionOrder = Number(completedIds.has(first.id)) - Number(completedIds.has(second.id))
      if (completionOrder !== 0) return completionOrder
      return first.created_at.localeCompare(second.created_at) || first.id.localeCompare(second.id)
    })
  const completed = weekTasks.filter((task) => completedIds.has(task.id)).length
  const completion = weekTasks.length ? Math.round((completed / weekTasks.length) * 100) : 0
  const averageFatigue = publishedResults.length
    ? (publishedResults.reduce((sum, result) => sum + result.fatigue_level, 0) / publishedResults.length).toFixed(1)
    : '—'
  const personalAttendance = attendance.filter((record) => record.player_id === userId)
  const attendedSessions = personalAttendance.filter((record) => record.attended).length
  const attendanceRate = personalAttendance.length
    ? Math.round((attendedSessions / personalAttendance.length) * 100)
    : 0
  const motivation = attendanceMotivation(attendanceRate, personalAttendance.length)
  const today = todayIso()
  const nextMatch = matches
    .filter((match) => match.status === 'published' && match.match_date >= today)
    .sort((first, second) => first.match_date.localeCompare(second.match_date))[0]
  const nextAnnouncements = announcements
    .filter((announcement) => announcement.status === 'published' && announcement.announcement_date >= today)
    .sort((first, second) => first.announcement_date.localeCompare(second.announcement_date))
    .slice(0, 4)
  const attentionCount = Number(Boolean(nextMatch)) + nextAnnouncements.length

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
        <StatCard label="Fatiga media" value={averageFatigue} note="esta semana" tone="coral" />
        <StatCard label="Asistencia" value={personalAttendance.length ? `${attendanceRate}%` : '—'} note="entrenamientos de campo" tone="lime" />
      </section>
      <section className="motivation-card">
        <span><Icon name="spark" size={22} /></span>
        <div><strong>{motivation.title}</strong><p>{motivation.text}</p></div>
      </section>
      {attentionCount > 0 && (
        <details className="dashboard-next dashboard-attention">
          <summary><span><span className="eyebrow">AGENDA</span><strong>Para tener en cuenta</strong></span><small>{attentionCount} {attentionCount === 1 ? 'elemento' : 'elementos'}</small><Icon name="arrow" size={16} /></summary>
          <div className="dashboard-next-list">
            {nextMatch && <button onClick={() => onOpenMatch?.(nextMatch)} type="button"><span className="dashboard-next-icon match"><Icon name="calendar" size={17} /></span><span><strong>Próximo partido · {nextMatch.opponent}</strong><small>{formatDate(nextMatch.match_date, { weekday: 'long', day: 'numeric', month: 'long' })}</small></span><Icon name="arrow" size={16} /></button>}
            {nextAnnouncements.map((announcement) => <button key={announcement.id} onClick={() => onOpenAnnouncement?.(announcement)} type="button"><span className="dashboard-next-icon announcement"><Icon name="bell" size={17} /></span><span><strong>{announcement.title}</strong><small>{formatDate(announcement.announcement_date, { weekday: 'long', day: 'numeric', month: 'long' })}</small></span><Icon name="arrow" size={16} /></button>)}
          </div>
        </details>
      )}
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
                result={publishedResults.find((item) => item.task_id === task.id)}
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

function attendanceMotivation(rate: number, total: number) {
  if (!total) return { title: 'Tu próxima sesión cuenta', text: 'Cuando empiecen los entrenamientos de campo podrás seguir aquí tu constancia.' }
  if (rate >= 90) return { title: 'Tu constancia empuja al equipo', text: `Has estado en ${rate}% de los entrenamientos. ¡Sigue así!` }
  if (rate >= 75) return { title: 'Vas por muy buen camino', text: `Llevas un ${rate}% de asistencia. Cada sesión te acerca un poco más.` }
  if (rate >= 50) return { title: 'Cada entrenamiento suma', text: `Tu asistencia está en el ${rate}%. El próximo entrenamiento es una oportunidad para avanzar.` }
  return { title: 'El siguiente paso empieza contigo', text: `Ahora estás en un ${rate}%. Volver al campo ya es progreso.` }
}

function StatCard({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return <article className={`stat-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}
