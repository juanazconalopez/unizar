import type { IconName } from '../Icon'
import { hasPermission, PERMISSIONS, type PermissionKey } from '../../lib/permissions'
import type { NavigationTarget } from '../../lib/navigation'
import type { Profile, ViewName } from '../../types'

type NavigationLeaf = { id: ViewName; label: string; icon: IconName; target?: NavigationTarget }
export type NavigationGroup = { id: 'attendance' | 'management' | 'settings'; label: string; icon: IconName; children: NavigationLeaf[] }
export type NavigationEntry = NavigationLeaf | NavigationGroup

export function isNavigationGroup(entry: NavigationEntry): entry is NavigationGroup {
  return 'children' in entry
}


export function navigationEntries(profile: Profile, permissionKeys?: PermissionKey[]): NavigationEntry[] {
  const can = (permission: PermissionKey) => hasPermission(profile, permission, permissionKeys)
  return [
    { id: 'home', label: 'Inicio', icon: 'home' },
    ...((can(PERMISSIONS.calendar.manage) || can(PERMISSIONS.calendar.personal)) ? [{ id: 'calendar' as const, label: 'Calendario', icon: 'calendar' as const }] : []),
    ...(can(PERMISSIONS.attendance.view) ? [{
        id: 'attendance' as const,
        label: 'Asistencia',
        icon: 'check' as const,
        children: [
          ...(can(PERMISSIONS.attendance.view) ? [{ id: 'attendance' as const, label: 'Registrar asistencia', icon: 'check' as const }] : []),
          ...(can(PERMISSIONS.statistics.view) ? [{ id: 'statistics' as const, label: 'Resumen', icon: 'statistics' as const }] : []),
        ],
      }] : []),
    ...((can(PERMISSIONS.training.view) || can(PERMISSIONS.matches.teamAvailability) || can(PERMISSIONS.surveys.manage)) ? [{
      id: 'management' as const,
      label: 'Gestión',
      icon: 'settings' as const,
      children: [
        ...(can(PERMISSIONS.matches.teamAvailability) ? [{ id: 'matches' as const, label: 'Partidos', icon: 'calendar' as const }] : []),
        ...(can(PERMISSIONS.training.view) ? [{ id: 'training' as const, label: 'Entrenamientos', icon: 'strategy' as const }] : []),
        ...(can(PERMISSIONS.surveys.manage) ? [{ id: 'surveys' as const, label: 'Encuestas', icon: 'statistics' as const }] : []),
      ],
    }] : []),
    ...(!can(PERMISSIONS.attendance.view) && can(PERMISSIONS.statistics.view) ? [{ id: 'statistics' as const, label: 'Resumen', icon: 'statistics' as const }] : []),
    ...(can(PERMISSIONS.competition.view) ? [{ id: 'competition' as const, label: 'Competición', icon: 'trophy' as const }] : []),
    ...(can(PERMISSIONS.library.view) ? [{ id: 'library' as const, label: 'Librería', icon: 'folder' as const }] : []),
    ...(can(PERMISSIONS.settings.view) ? [{
      id: 'settings' as const,
      label: 'Ajustes',
      icon: 'settings' as const,
      children: [
        { id: 'settings' as const, label: 'Equipo', icon: 'users' as const, target: { view: 'settings' as const, settingsSection: 'team' as const } },
        { id: 'settings' as const, label: 'Temporadas', icon: 'calendar' as const, target: { view: 'settings' as const, settingsSection: 'seasons' as const } },
        { id: 'settings' as const, label: 'Librería', icon: 'folder' as const, target: { view: 'settings' as const, settingsSection: 'library' as const } },
        { id: 'settings' as const, label: 'Permisos', icon: 'settings' as const, target: { view: 'settings' as const, settingsSection: 'permissions' as const } },
      ],
    }] : []),
  ] satisfies NavigationEntry[]
}
