import type { ViewName } from '../types'

export type NavigationTarget = {
  view: ViewName
  date?: string
  announcementId?: string
}

const views = new Set<ViewName>(['home', 'statistics', 'tasks', 'matches', 'competition', 'attendance', 'settings'])

export function navigationFromLocation(location: Pick<Location, 'search'> = window.location): NavigationTarget {
  const params = new URLSearchParams(location.search)
  const candidate = params.get('view') as ViewName | null
  const view = candidate && views.has(candidate) ? candidate : 'home'
  const date = params.get('date') ?? undefined
  const announcementId = params.get('announcement') ?? undefined
  return {
    view,
    ...(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {}),
    ...(announcementId ? { announcementId } : {}),
  }
}

export function urlForNavigation(target: NavigationTarget) {
  const params = new URLSearchParams()
  if (target.view !== 'home') params.set('view', target.view)
  if (target.date) params.set('date', target.date)
  if (target.announcementId) params.set('announcement', target.announcementId)
  const query = params.toString()
  return `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
}
