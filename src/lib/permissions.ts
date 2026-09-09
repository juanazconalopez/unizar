import type { Profile } from '../types'

export const PERMISSIONS = {
  dashboard: { personal: 'dashboard.view_personal', team: 'dashboard.view_team' },
  statistics: { view: 'statistics.view', attendance: 'statistics.attendance', tasks: 'statistics.tasks' },
  calendar: { personal: 'calendar.view_personal', manage: 'calendar.view_manage' },
  tasks: {
    own: 'tasks.view_own', submitOwn: 'tasks.submit_own', team: 'tasks.view_team', results: 'tasks.view_results',
    create: 'tasks.create', edit: 'tasks.edit', delete: 'tasks.delete', publish: 'tasks.publish', reorder: 'tasks.reorder',
  },
  announcements: { view: 'announcements.view', team: 'announcements.view_team', create: 'announcements.create', edit: 'announcements.edit', delete: 'announcements.delete', publish: 'announcements.publish' },
  matches: {
    view: 'matches.view', create: 'matches.create', edit: 'matches.edit', delete: 'matches.delete', ownAvailability: 'matches.availability_own',
    teamAvailability: 'matches.availability_team', editAvailability: 'matches.availability_edit', lineup: 'matches.lineup_view',
    editLineup: 'matches.lineup_edit', publishLineup: 'matches.lineup_publish', unlockLineup: 'matches.lineup_unlock', report: 'matches.report',
  },
  attendance: { view: 'attendance.view', record: 'attendance.record', report: 'attendance.report', guests: 'attendance.guests' },
  training: { view: 'training.view', create: 'training.create', edit: 'training.edit', delete: 'training.delete', publish: 'training.publish' },
  exercises: { view: 'exercises.view', create: 'exercises.create', edit: 'exercises.edit', delete: 'exercises.delete' },
  competition: { view: 'competition.view', sync: 'competition.sync' },
  library: { view: 'library.view', configure: 'library.configure', sync: 'library.sync' },
  settings: { view: 'settings.view', team: 'settings.team', seasons: 'settings.seasons', permissions: 'settings.permissions' },
  team: { view: 'team.view', edit: 'team.edit', privateDetails: 'team.private_details', roles: 'team.roles', archive: 'team.archive', linkGuests: 'team.link_guests' },
  seasons: { view: 'seasons.view', create: 'seasons.create', edit: 'seasons.edit', delete: 'seasons.delete', memberships: 'seasons.memberships' },
} as const

type NestedValues<T> = T extends string ? T : { [K in keyof T]: NestedValues<T[K]> }[keyof T]
export type PermissionKey = NestedValues<typeof PERMISSIONS>
export type ConfigurableRole = 'coach' | 'viewer' | 'player'

export type PermissionDefinition = {
  key: PermissionKey
  section_key: string
  section_label: string
  label: string
  description: string
  action: string
  parent_key: PermissionKey | null
  sort_order: number
  configurable: boolean
  owner_only: boolean
}

export type RolePermission = { role: ConfigurableRole; permission_key: PermissionKey }

const ALL_PERMISSION_KEYS = flattenPermissionKeys(PERMISSIONS)
export const ALL_PERMISSIONS = new Set<PermissionKey>(ALL_PERMISSION_KEYS)

export const DEFAULT_ROLE_PERMISSIONS: Record<ConfigurableRole, ReadonlySet<PermissionKey>> = {
  coach: new Set([
    PERMISSIONS.dashboard.team, PERMISSIONS.statistics.view, PERMISSIONS.statistics.attendance, PERMISSIONS.statistics.tasks,
    PERMISSIONS.calendar.manage, PERMISSIONS.tasks.team, PERMISSIONS.tasks.results, PERMISSIONS.tasks.create, PERMISSIONS.tasks.edit,
    PERMISSIONS.tasks.delete, PERMISSIONS.tasks.publish, PERMISSIONS.tasks.reorder, PERMISSIONS.announcements.view,
    PERMISSIONS.announcements.team, PERMISSIONS.announcements.create, PERMISSIONS.announcements.edit, PERMISSIONS.announcements.delete,
    PERMISSIONS.announcements.publish, PERMISSIONS.matches.view, PERMISSIONS.matches.create, PERMISSIONS.matches.edit,
    PERMISSIONS.matches.delete, PERMISSIONS.matches.teamAvailability, PERMISSIONS.matches.editAvailability, PERMISSIONS.matches.lineup,
    PERMISSIONS.matches.editLineup, PERMISSIONS.matches.publishLineup, PERMISSIONS.matches.unlockLineup, PERMISSIONS.matches.report,
    PERMISSIONS.attendance.view, PERMISSIONS.attendance.record, PERMISSIONS.attendance.report, PERMISSIONS.attendance.guests,
    PERMISSIONS.training.view, PERMISSIONS.training.create, PERMISSIONS.training.edit, PERMISSIONS.training.delete,
    PERMISSIONS.training.publish, PERMISSIONS.exercises.view, PERMISSIONS.exercises.create, PERMISSIONS.exercises.edit,
    PERMISSIONS.exercises.delete, PERMISSIONS.competition.view, PERMISSIONS.library.view,
  ]),
  viewer: new Set([
    PERMISSIONS.dashboard.team, PERMISSIONS.statistics.view, PERMISSIONS.statistics.attendance, PERMISSIONS.statistics.tasks,
    PERMISSIONS.matches.view, PERMISSIONS.matches.teamAvailability, PERMISSIONS.matches.lineup, PERMISSIONS.attendance.report,
    PERMISSIONS.competition.view, PERMISSIONS.library.view,
  ]),
  player: new Set([
    PERMISSIONS.dashboard.personal, PERMISSIONS.calendar.personal, PERMISSIONS.tasks.own, PERMISSIONS.tasks.submitOwn,
    PERMISSIONS.announcements.view, PERMISSIONS.matches.view, PERMISSIONS.matches.ownAvailability, PERMISSIONS.matches.lineup,
    PERMISSIONS.competition.view, PERMISSIONS.library.view,
  ]),
}

export function defaultPermissionsFor(profile: Profile): Set<PermissionKey> {
  if (!isEnabledProfile(profile)) return new Set()
  if (profile.is_owner) return new Set(ALL_PERMISSION_KEYS)
  const granted = new Set<PermissionKey>()
  if (profile.is_coach) addAll(granted, DEFAULT_ROLE_PERMISSIONS.coach)
  if (profile.is_viewer) addAll(granted, DEFAULT_ROLE_PERMISSIONS.viewer)
  if (profile.is_player) addAll(granted, DEFAULT_ROLE_PERMISSIONS.player)
  return granted
}

export function effectivePermissions(profile: Profile, loadedKeys?: readonly string[]): Set<PermissionKey> {
  if (!isEnabledProfile(profile)) return new Set()
  if (profile.is_owner) return new Set(ALL_PERMISSION_KEYS)
  if (loadedKeys === undefined) return defaultPermissionsFor(profile)
  return new Set(loadedKeys.filter((key): key is PermissionKey => ALL_PERMISSIONS.has(key as PermissionKey)))
}

export function hasPermission(profile: Profile, permission: PermissionKey, loadedKeys?: readonly string[]) {
  return effectivePermissions(profile, loadedKeys).has(permission)
}

export function isPlayer(profile: Profile) { return profile.is_player }

export function canAccessTasks(profile: Profile, loadedKeys?: readonly string[]) {
  return hasPermission(profile, PERMISSIONS.tasks.own, loadedKeys) || hasPermission(profile, PERMISSIONS.tasks.team, loadedKeys)
}

export function canManageSport(profile: Profile, loadedKeys?: readonly string[]) {
  return hasPermission(profile, PERMISSIONS.calendar.manage, loadedKeys)
}

export function canViewTeamData(profile: Profile, loadedKeys?: readonly string[]) {
  return hasPermission(profile, PERMISSIONS.dashboard.team, loadedKeys) || hasPermission(profile, PERMISSIONS.statistics.view, loadedKeys)
}

export function canConfigureClub(profile: Profile, loadedKeys?: readonly string[]) {
  return hasPermission(profile, PERMISSIONS.settings.view, loadedKeys)
}

export function isEnabledProfile(profile: Profile) {
  return profile.is_approved && profile.is_active && !profile.is_archived
}

function addAll(target: Set<PermissionKey>, source: ReadonlySet<PermissionKey>) {
  for (const permission of source) target.add(permission)
}

function flattenPermissionKeys(value: unknown): PermissionKey[] {
  if (typeof value === 'string') return [value as PermissionKey]
  return Object.values(value as Record<string, unknown>).flatMap(flattenPermissionKeys)
}
