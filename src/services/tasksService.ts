import { mondayFor } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { ResultValues, TaskStatus, TaskValues, TrainingTask } from '../types'
import { cleanupContentImages, contentImageIdsForEntity, ensureContentImages } from './contentImagesService'

export async function saveTaskResult(task: TrainingTask, values: ResultValues, userId: string) {
  const payload = {
    task_id: task.id,
    player_id: userId,
    result_text: values.resultText.trim(),
    fatigue_level: values.fatigueLevel,
    performed_on: values.performedOn,
  }
  // A result has a unique (task_id, player_id) key. Upsert prevents a stale
  // local result list from trying to insert a duplicate or update no rows.
  const response = await supabase.from('task_results').upsert(payload, { onConflict: 'task_id,player_id' })
  if (response.error) throw response.error
}

export async function createTrainingTask(values: TaskValues, userId: string) {
  const uploadedIds = await ensureContentImages([values.description], userId)
  const { error } = await supabase.from('tasks').insert({
    season_id: values.seasonId,
    week_start: mondayFor(values.date),
    title: values.title.trim(),
    description: values.description.trim() || null,
    training_type: values.trainingType,
    status: values.status,
    created_by: userId,
  })
  if (error) {
    await cleanupContentImages(uploadedIds)
    throw error
  }
}

export async function updateTrainingTask(taskId: string, values: TaskValues, userId: string) {
  const previousIds = await contentImageIdsForEntity('task', taskId)
  const uploadedIds = await ensureContentImages([values.description], userId)
  const { error } = await supabase.from('tasks').update({
    season_id: values.seasonId,
    title: values.title.trim(),
    description: values.description.trim() || null,
    training_type: values.trainingType,
    status: values.status,
  }).eq('id', taskId)
  if (error) {
    await cleanupContentImages(uploadedIds)
    throw error
  }
  await cleanupContentImages(previousIds)
}

export async function deleteTrainingTask(taskId: string) {
  const imageIds = await contentImageIdsForEntity('task', taskId)
  const { error } = await supabase.from('tasks').delete().eq('id', taskId)
  if (error) throw error
  await cleanupContentImages(imageIds)
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
  if (error) throw error
}

export async function reorderTrainingTasks(taskIds: string[]) {
  const { error } = await supabase.rpc('reorder_tasks', { ordered_task_ids: taskIds })
  if (error) throw error
}
