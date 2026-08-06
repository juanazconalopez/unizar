import { addDays } from './dates'
import type { SeasonPlayer, TrainingTask } from '../types'

export function canUserCompleteTask(task: TrainingTask, memberships: SeasonPlayer[], userId: string) {
  return memberships.some((membership) => (
    membership.player_id === userId
    && membership.season_id === task.season_id
    && addDays(task.week_start, 6) >= membership.active_from
    && (!membership.active_until || task.week_start <= membership.active_until)
  ))
}
