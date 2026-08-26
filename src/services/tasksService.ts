import { mondayFor } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { ResultValues, TaskStatus, TaskValues, TrainingTask } from '../types'

export async function saveTaskResult(task: TrainingTask, values: ResultValues, userId: string, exists: boolean) {
  const payload = {
    task_id: task.id,
    player_id: userId,
    result_text: values.resultText.trim(),
    fatigue_level: values.fatigueLevel,
    performed_on: values.performedOn,
  }
  const response = exists
    ? await supabase.from('task_results').update(payload).eq('task_id', task.id).eq('player_id', userId)
    : await supabase.from('task_results').insert(payload)
  if (response.error) throw response.error
}

export async function createTrainingTask(values: TaskValues, userId: string) {
  const { error } = await supabase.from('tasks').insert({
    season_id: values.seasonId,
    week_start: mondayFor(values.date),
    title: values.title.trim(),
    description: values.description.trim() || null,
    training_type: values.trainingType,
    status: values.status,
    created_by: userId,
  })
  if (error) throw error
}

export async function updateTrainingTask(taskId: string, values: TaskValues) {
  const { error } = await supabase.from('tasks').update({
    season_id: values.seasonId,
    title: values.title.trim(),
    description: values.description.trim() || null,
    training_type: values.trainingType,
    status: values.status,
  }).eq('id', taskId)
  if (error) throw error
}

export async function deleteTrainingTask(taskId: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
  if (error) throw error
}

export async function reorderTrainingTasks(taskIds: string[]) {
  const { error } = await supabase.rpc('reorder_tasks', { ordered_task_ids: taskIds })
  if (error) throw error
}
