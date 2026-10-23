import { supabase } from '../lib/supabase'
import type { SaveTrainingResponse, TrainingAttendanceBasis, TrainingGenerationDay } from '../types'

export async function generateTrainingSchedule(applyChanges = false): Promise<TrainingGenerationDay[]> {
  const { data, error } = await supabase.rpc('generate_training_schedule', { apply_changes: applyChanges })
  if (error) throw error
  return data ?? []
}

export const saveTrainingResponse: SaveTrainingResponse = async (plan, attending, comment) => {
  const { error } = await supabase.rpc('save_training_response', {
    checked_plan_id: plan.id,
    checked_attending: attending,
    checked_comment: comment,
    checked_version: plan.schedule_version ?? 1,
  })
  if (error) throw error
}

export async function fetchTrainingAttendanceBasis(date: string): Promise<TrainingAttendanceBasis> {
  const { data, error } = await supabase.rpc('get_training_attendance_basis', { checked_date: date })
  if (error) throw error
  // La estructura procede exclusivamente de la RPC restringida; nunca consulta planes privados.
  return data as unknown as TrainingAttendanceBasis
}
