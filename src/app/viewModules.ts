import type { Profile, ViewName } from '../types'
import { preloadableView } from '../lib/preloadableView'
import { canAccessView } from './appAccess'
import { canManageSport } from '../lib/permissions'

const modules = {
  home: () => import('../features/dashboard/Dashboard'),
  attendance: () => import('../features/attendance/AttendanceView'),
  settings: () => import('../features/settings/SettingsView'),
  statistics: () => import('../features/statistics/StatisticsView'),
  tasks: () => import('../features/tasks/TasksView'),
  matches: () => import('../features/matches/MatchesView'),
  calendar: () => import('../features/calendar/CalendarView'),
  playerCalendar: () => import('../features/calendar/PlayerCalendarView'),
  'training-groups': () => import('../features/trainingGroups/TrainingGroupsView'),
  groups: () => import('../features/workGroups/GroupsHub'),
  workGroups: () => import('../features/workGroups/WorkGroupsView'),
  training: () => import('../features/trainingPlans/TrainingPlansView'),
  competition: () => import('../features/competition/CompetitionView'),
  library: () => import('../features/library/LibraryView'),
  surveys: () => import('../features/surveys/SurveysView'),
  survey: () => import('../features/surveys/SurveyResponseView'),
  playerPreview: () => import('../features/playerPreview/PlayerPreviewView'),
}

const views = {
  'home': preloadableView(async () => ({ default: (await modules.home()).Dashboard })),
  'attendance': preloadableView(async () => ({ default: (await modules.attendance()).AttendanceView })),
  'settings': preloadableView(async () => ({ default: (await modules.settings()).SettingsView })),
  'statistics': preloadableView(async () => ({ default: (await modules.statistics()).StatisticsView })),
  'tasks': preloadableView(async () => ({ default: (await modules.tasks()).TasksView })),
  'matches': preloadableView(async () => ({ default: (await modules.matches()).MatchesView })),
  'calendar': preloadableView(async () => ({ default: (await modules.calendar()).CalendarView })),
  'playerCalendar': preloadableView(async () => ({ default: (await modules.playerCalendar()).PlayerCalendarView })),
  'training-groups': preloadableView(async () => ({ default: (await modules['training-groups']()).TrainingGroupsView })),
  'groups': preloadableView(async () => ({ default: (await modules.groups()).GroupsHub })),
  'work-groups': preloadableView(async () => ({ default: (await modules.workGroups()).WorkGroupsView })),
  'video-analysis': preloadableView(async () => ({ default: (await modules.workGroups()).WorkGroupsView })),
  'training': preloadableView(async () => ({ default: (await modules.training()).TrainingPlansView })),
  'competition': preloadableView(async () => ({ default: (await modules.competition()).CompetitionView })),
  'library': preloadableView(async () => ({ default: (await modules.library()).LibraryView })),
  'surveys': preloadableView(async () => ({ default: (await modules.surveys()).SurveysView })),
  'survey': preloadableView(async () => ({ default: (await modules.survey()).SurveyResponseView })),
  'playerPreview': preloadableView(async () => ({ default: (await modules.playerPreview()).PlayerPreviewView })),
}

export const Dashboard = views['home'].View
export const AttendanceView = views['attendance'].View
export const SettingsView = views['settings'].View
export const StatisticsView = views['statistics'].View
export const TasksView = views['tasks'].View
export const MatchesView = views['matches'].View
export const CalendarView = views['calendar'].View
export const PlayerCalendarView = views['playerCalendar'].View
export const TrainingGroupsView = views['training-groups'].View
export const GroupsHub = views.groups.View
export const WorkGroupsView = views['work-groups'].View
export const TrainingPlansView = views['training'].View
export const CompetitionView = views['competition'].View
export const LibraryView = views['library'].View
export const SurveysView = views['surveys'].View
export const SurveyResponseView = views['survey'].View
export const PlayerPreviewView = views['playerPreview'].View

export function preloadView(view: ViewName, profile?: Profile, permissionKeys?: readonly string[]): Promise<unknown> {
  // Navigation alone does not know which calendar this account can open.
  if (view === 'calendar') {
    if (!profile) return Promise.resolve()
    return (canManageSport(profile, permissionKeys) ? views.calendar.preload() : views.playerCalendar.preload()).catch(() => undefined)
  }
  return view in views ? views[view as keyof typeof views].preload().catch(() => undefined) : Promise.resolve()
}

export async function preloadAccessibleViews(profile: Profile, permissionKeys: readonly string[], cancelled: () => boolean) {
  const priority: ViewName[] = ['calendar', 'matches', 'attendance', 'training-groups', 'home', 'training', 'statistics', 'library', 'competition', 'surveys', 'settings']
  const allowed = priority.filter((view) => canAccessView(profile, view, permissionKeys))
  for (let index = 0; index < allowed.length && !cancelled(); index += 2) {
    await Promise.all(allowed.slice(index, index + 2).map((view) => preloadView(view, profile, permissionKeys)))
  }
}
