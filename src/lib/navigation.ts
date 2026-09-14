import type { ViewName } from '../types'

export type NavigationTarget = {
  view: ViewName
  date?: string
  announcementId?: string
  trainingPlanId?: string
  surveyId?: string
  playerPreviewId?: string
  settingsSection?: 'team' | 'seasons' | 'library' | 'permissions'
}

const views = new Set<ViewName>(['home', 'statistics', 'calendar', 'training', 'tasks', 'matches', 'competition', 'attendance', 'settings', 'library', 'surveys', 'survey', 'player-preview'])
const settingsSections = new Set<NonNullable<NavigationTarget['settingsSection']>>(['team', 'seasons', 'library', 'permissions'])

export function navigationFromLocation(location: Pick<Location, 'search'> = window.location): NavigationTarget {
  const params = new URLSearchParams(location.search)
  const candidate = params.get('view') as ViewName | null
  const view = candidate && views.has(candidate) ? candidate : 'home'
  const date = params.get('date') ?? undefined
  const announcementId = params.get('announcement') ?? undefined
  const trainingPlanId = params.get('training') ?? undefined
  const surveyId = params.get('survey') ?? undefined
  const playerPreviewId = params.get('player') ?? undefined
  const settingsSectionCandidate = params.get('section') as NavigationTarget['settingsSection'] | null
  const settingsSection = view === 'settings' && settingsSectionCandidate && settingsSections.has(settingsSectionCandidate)
    ? settingsSectionCandidate
    : undefined
  return {
    view,
    ...(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {}),
    ...(announcementId ? { announcementId } : {}),
    ...(trainingPlanId ? { trainingPlanId } : {}),
    ...(surveyId ? { surveyId } : {}),
    ...(playerPreviewId ? { playerPreviewId } : {}),
    ...(settingsSection ? { settingsSection } : {}),
  }
}

export function urlForNavigation(target: NavigationTarget) {
  const params = new URLSearchParams()
  if (target.view !== 'home') params.set('view', target.view)
  if (target.date) params.set('date', target.date)
  if (target.announcementId) params.set('announcement', target.announcementId)
  if (target.trainingPlanId) params.set('training', target.trainingPlanId)
  if (target.surveyId) params.set('survey', target.surveyId)
  if (target.playerPreviewId) params.set('player', target.playerPreviewId)
  if (target.view === 'settings' && target.settingsSection) params.set('section', target.settingsSection)
  const query = params.toString()
  return `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
}
