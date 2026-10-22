import type { Profile, ViewName } from '../types'
import { canAccessView } from './appAccess'

export const INITIAL_NAVIGATION_WAIT_MS = 15_000

export async function prepareNavigationQueue<T>(items: readonly T[], prepare: (item: T) => Promise<unknown>, cancelled: () => boolean) {
  let next = 0
  async function worker() {
    while (!cancelled() && next < items.length) await prepare(items[next++])
  }
  // Una petición lenta ocupa un puesto, sin detener la preparación del resto.
  await Promise.all([worker(), worker()])
}

export function navigationPreloadTargets(profile: Profile, permissionKeys: readonly string[]): ViewName[] {
  return (['calendar', 'matches', 'attendance', 'groups', 'training-groups', 'work-groups', 'video-analysis',
    'home', 'training', 'statistics', 'library', 'competition', 'surveys', 'settings'] as ViewName[])
    .filter((view) => canAccessView(profile, view, permissionKeys))
}
