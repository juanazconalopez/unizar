import type { TrainingTask } from '../types'

export function compareTaskOrder(first: TrainingTask, second: TrainingTask) {
  return first.sort_order - second.sort_order
    || first.created_at.localeCompare(second.created_at)
    || first.id.localeCompare(second.id)
}
