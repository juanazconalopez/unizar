import { addDays, mondayFor } from '../../lib/dates'
import { canUserCompleteTask } from '../../lib/tasks'
import { canAccessTasks, canManageSport, isPlayer } from '../../lib/permissions'
import type { Match, MatchAvailability, MatchLineup, Profile, SeasonPlayer, TaskResult, TeamAnnouncement, TrainingTask, ViewName } from '../../types'

export type AppNotification = {
  id: string
  kind: 'task' | 'match' | 'availability' | 'lineup' | 'announcement'
  title: string
  text: string
  view: ViewName
  occurredAt: string
  targetDate?: string
  targetId?: string
}

export type NotificationFeedData = {
  tasks: Array<TrainingTask & { updated_at?: string }>
  results: TaskResult[]
  memberships: SeasonPlayer[]
  matches: Match[]
  availability: MatchAvailability[]
  lineups: MatchLineup[]
  announcements?: TeamAnnouncement[]
}

export function buildNotifications(data: NotificationFeedData, profile: Profile, today: string): AppNotification[] {
  const currentWeek = mondayFor(today)
  const recentFrom = addDays(today, -7)
  const playerRole = isPlayer(profile)
  const managesAvailability = canManageSport(profile)
  const eligibleTasks = data.tasks.filter((task) => (
    task.status === 'published'
    && task.week_start >= currentWeek
    && canAccessTasks(profile)
    && (!playerRole || canUserCompleteTask(task, data.memberships, profile.id))
  ))
  const completedTaskIds = new Set(data.results
    .filter((result) => result.player_id === profile.id)
    .map((result) => result.task_id))
  const items: AppNotification[] = []

  for (const announcement of (data.announcements ?? []).filter((item) => canAccessTasks(profile) && item.status === 'published')) {
    if (announcement.updated_at.slice(0, 10) < recentFrom) continue
    items.push({
      id: `announcement-published:${announcement.id}:${announcement.updated_at}`,
      kind: 'announcement',
      title: 'Nuevo aviso del equipo',
      text: announcement.title,
      view: 'tasks',
      occurredAt: announcement.updated_at,
      targetDate: announcement.announcement_date,
      targetId: announcement.id,
    })
  }

  for (const task of eligibleTasks) {
    const publishedAt = task.updated_at ?? task.created_at
    if (publishedAt.slice(0, 10) >= recentFrom) {
      items.push({
        id: `task-published:${task.id}:${publishedAt}`,
        kind: 'task',
        title: 'Nueva tarea publicada',
        text: task.title,
        view: 'tasks',
        occurredAt: publishedAt,
        targetDate: task.week_start,
      })
    }
    if (playerRole && task.week_start === currentWeek && today >= addDays(currentWeek, 4) && !completedTaskIds.has(task.id)) {
      items.push({
        id: `task-due:${task.id}:${currentWeek}`,
        kind: 'task',
        title: 'Tarea pendiente próxima a finalizar',
        text: `${task.title} · termina este domingo`,
        view: 'tasks',
        occurredAt: `${today}T12:00:00`,
        targetDate: task.week_start,
      })
    }
  }

  const futureMatches = data.matches
    .filter((match) => match.status === 'published' && match.match_date >= today)
    .sort((first, second) => first.match_date.localeCompare(second.match_date))
  const newMatches = futureMatches.filter((match) => match.created_at.slice(0, 10) >= recentFrom)
  const matchesToAnnounce = newMatches.length ? newMatches : futureMatches.slice(0, 1)

  for (const match of matchesToAnnounce) {
    const isNew = newMatches.some((item) => item.id === match.id)
    items.push({
      id: `${isNew ? 'match-published' : 'match-upcoming'}:${match.id}:${isNew ? match.created_at : match.match_date}`,
      kind: 'match',
      title: isNew ? 'Nuevo partido publicado' : 'Próximo partido',
      text: `${match.opponent} · ${match.match_date}`,
      view: 'matches',
      occurredAt: isNew ? match.created_at : `${match.match_date}T00:00:00`,
      targetDate: match.match_date,
    })
  }

  for (const match of futureMatches) {
    const matchAvailability = data.availability.filter((item) => item.match_id === match.id)
    const latestAvailabilityChange = matchAvailability.reduce<string | null>(
      (latest, item) => !latest || item.updated_at > latest ? item.updated_at : latest,
      null,
    )
    if (managesAvailability && latestAvailabilityChange && latestAvailabilityChange.slice(0, 10) >= recentFrom) {
      items.push({
        id: `availability-changed:${match.id}:${latestAvailabilityChange}`,
        kind: 'availability',
        title: 'Cambios en la disponibilidad',
        text: `Ha cambiado la disponibilidad de las jugadoras para el partido contra ${match.opponent}.`,
        view: 'matches',
        occurredAt: latestAvailabilityChange,
        targetDate: match.match_date,
      })
    }
    const ownAvailability = data.availability.some((item) => item.match_id === match.id && item.player_id === profile.id)
    if (playerRole && !ownAvailability) {
      items.push({
        id: `availability-missing:${match.id}:${match.updated_at}`,
        kind: 'availability',
        title: 'Disponibilidad sin responder',
        text: `Indica si asistirás al partido contra ${match.opponent}.`,
        view: 'matches',
        occurredAt: match.updated_at,
        targetDate: match.match_date,
      })
    }
    if (match.lineup_published && data.lineups.some((entry) => entry.match_id === match.id)) {
      items.push({
        id: `lineup-published:${match.id}:${match.updated_at}`,
        kind: 'lineup',
        title: 'Convocatoria publicada',
        text: `Ya puedes consultar la convocatoria contra ${match.opponent}.`,
        view: 'matches',
        occurredAt: match.updated_at,
        targetDate: match.match_date,
      })
    }
    if (match.updated_at > match.created_at && match.updated_at.slice(0, 10) >= recentFrom) {
      items.push({
        id: `match-changed:${match.id}:${match.updated_at}`,
        kind: 'match',
        title: 'Cambio relevante en un partido',
        text: `Revisa los datos actualizados del partido contra ${match.opponent}.`,
        view: 'matches',
        occurredAt: match.updated_at,
        targetDate: match.match_date,
      })
    }
  }

  return deduplicate(items).sort((first, second) => second.occurredAt.localeCompare(first.occurredAt))
}

function deduplicate(items: AppNotification[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}
