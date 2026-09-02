import { lazy } from 'react'
import type { ViewName } from '../types'

const modules = {
  attendance: () => import('../features/attendance/AttendanceView'),
  settings: () => import('../features/settings/SettingsView'),
  statistics: () => import('../features/statistics/StatisticsView'),
  tasks: () => import('../features/tasks/TasksView'),
  matches: () => import('../features/matches/MatchesView'),
  calendar: () => import('../features/calendar/CalendarView'),
  playerCalendar: () => import('../features/calendar/PlayerCalendarView'),
  training: () => import('../features/trainingPlans/TrainingPlansView'),
  competition: () => import('../features/competition/CompetitionView'),
}

export const AttendanceView = lazy(() => modules.attendance().then(({ AttendanceView }) => ({ default: AttendanceView })))
export const SettingsView = lazy(() => modules.settings().then(({ SettingsView }) => ({ default: SettingsView })))
export const StatisticsView = lazy(() => modules.statistics().then(({ StatisticsView }) => ({ default: StatisticsView })))
export const TasksView = lazy(() => modules.tasks().then(({ TasksView }) => ({ default: TasksView })))
export const MatchesView = lazy(() => modules.matches().then(({ MatchesView }) => ({ default: MatchesView })))
export const CalendarView = lazy(() => modules.calendar().then(({ CalendarView }) => ({ default: CalendarView })))
export const PlayerCalendarView = lazy(() => modules.playerCalendar().then(({ PlayerCalendarView }) => ({ default: PlayerCalendarView })))
export const TrainingPlansView = lazy(() => modules.training().then(({ TrainingPlansView }) => ({ default: TrainingPlansView })))
export const CompetitionView = lazy(() => modules.competition().then(({ CompetitionView }) => ({ default: CompetitionView })))

export function preloadView(view: ViewName) {
  if (view in modules) void modules[view as keyof typeof modules]()
  if (view === 'calendar') void modules.playerCalendar()
}
