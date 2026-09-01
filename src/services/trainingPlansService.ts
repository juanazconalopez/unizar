import type { Json } from '../lib/database.types'
import { todayIso } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type {
  TacticsBoardData,
  TacticsElement,
  TacticsElementType,
  TrainingExercisePreset,
  TrainingExerciseValues,
  TrainingPlan,
  TrainingPlanCalendarItem,
  TrainingPlanValues,
} from '../types'

export const EMPTY_TACTICS_BOARD: TacticsBoardData = { version: 1, template: 'full', elements: [] }

const elementTypes = new Set<TacticsElementType>([
  'player', 'opponent', 'cone', 'ball', 'shield', 'run', 'pass', 'defense', 'zone', 'text',
])

export function parseTacticsBoard(value: unknown): TacticsBoardData {
  if (!value || typeof value !== 'object') return structuredClone(EMPTY_TACTICS_BOARD)
  const candidate = value as { version?: unknown; template?: unknown; elements?: unknown }
  const template = candidate.template === 'half' || candidate.template === '22' ? candidate.template : 'full'
  const elements = Array.isArray(candidate.elements)
    ? candidate.elements.filter(isTacticsElement).map((element) => ({ ...element }))
    : []
  return { version: 1, template, elements }
}

function isTacticsElement(value: unknown): value is TacticsElement {
  if (!value || typeof value !== 'object') return false
  const element = value as Partial<TacticsElement>
  return typeof element.id === 'string'
    && typeof element.type === 'string'
    && elementTypes.has(element.type as TacticsElementType)
    && typeof element.x === 'number'
    && typeof element.y === 'number'
    && (element.rotation === undefined || typeof element.rotation === 'number')
    && (element.scaleX === undefined || typeof element.scaleX === 'number')
    && (element.scaleY === undefined || typeof element.scaleY === 'number')
}

export async function fetchTrainingPlans(): Promise<TrainingPlan[]> {
  const { data, error } = await supabase
    .from('training_plans')
    .select('*, seasons(name), training_exercises(*)')
    .gte('session_date', todayIso())
    .order('session_date', { ascending: true })
    .order('sort_order', { ascending: true, referencedTable: 'training_exercises' })
  if (error) throw error
  return (data ?? []).map((plan) => ({
    ...plan,
    training_exercises: (plan.training_exercises ?? []).map((exercise) => ({
      ...exercise,
      diagram_data: parseTacticsBoard(exercise.diagram_data),
    })),
  }))
}

export async function fetchTrainingPlan(planId: string): Promise<TrainingPlan> {
  const { data, error } = await supabase
    .from('training_plans')
    .select('*, seasons(name), training_exercises(*)')
    .eq('id', planId)
    .order('sort_order', { ascending: true, referencedTable: 'training_exercises' })
    .single()
  if (error) throw error
  return {
    ...data,
    training_exercises: (data.training_exercises ?? []).map((exercise) => ({
      ...exercise,
      diagram_data: parseTacticsBoard(exercise.diagram_data),
    })),
  }
}

export async function fetchPublishedTrainingPlans(fromDate: string, toDate: string): Promise<TrainingPlanCalendarItem[]> {
  const { data, error } = await supabase
    .from('training_plans')
    .select('id, session_date, title, status')
    .eq('status', 'published')
    .gte('session_date', fromDate)
    .lte('session_date', toDate)
    .order('session_date')
  if (error) {
    if (import.meta.env.DEV && isTrainingPlansSchemaMissing(error)) return []
    throw error
  }
  return data ?? []
}

export async function fetchTrainingExercisePresets(): Promise<TrainingExercisePreset[]> {
  const { data, error } = await supabase
    .from('training_exercise_presets')
    .select('*')
    .order('title')
  if (error) throw error
  return (data ?? []).map((preset) => ({ ...preset, diagram_data: parseTacticsBoard(preset.diagram_data) }))
}

export async function saveTrainingExercisePreset(exercise: TrainingExerciseValues, userId: string): Promise<TrainingExercisePreset> {
  const { data, error } = await supabase
    .from('training_exercise_presets')
    .insert({
      title: exercise.title.trim(),
      description: exercise.description.trim() || null,
      duration_minutes: exercise.durationMinutes,
      diagram_data: exercise.diagramData as unknown as Json,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return { ...data, diagram_data: parseTacticsBoard(data.diagram_data) }
}

export async function updateTrainingExercisePreset(presetId: string, exercise: TrainingExerciseValues): Promise<TrainingExercisePreset> {
  const { data, error } = await supabase
    .from('training_exercise_presets')
    .update({
      title: exercise.title.trim(),
      description: exercise.description.trim() || null,
      duration_minutes: exercise.durationMinutes,
      diagram_data: exercise.diagramData as unknown as Json,
    })
    .eq('id', presetId)
    .select()
    .single()
  if (error) throw error
  return { ...data, diagram_data: parseTacticsBoard(data.diagram_data) }
}

export async function deleteTrainingExercisePreset(presetId: string) {
  const { error } = await supabase.from('training_exercise_presets').delete().eq('id', presetId)
  if (error) throw error
}

export async function saveTrainingPlan(planId: string | undefined, values: TrainingPlanValues) {
  const exercises = values.exercises.map((exercise) => ({
    title: exercise.title.trim(),
    description: exercise.description.trim(),
    duration_minutes: exercise.durationMinutes,
    diagram_data: exercise.diagramData,
  })) as unknown as Json
  const { data, error } = await supabase.rpc('save_training_plan', {
    checked_plan_id: planId ?? null,
    checked_season_id: values.seasonId,
    checked_session_date: values.sessionDate,
    checked_title: values.title.trim(),
    checked_objectives: values.objectives.trim(),
    checked_material: values.material.trim(),
    checked_status: values.status,
    checked_exercises: exercises,
  })
  if (error?.code === '23505') throw new Error('Ya existe un entrenamiento planificado para esa fecha.')
  if (error) throw error
  return data
}

export async function deleteTrainingPlan(planId: string) {
  const { error } = await supabase.from('training_plans').delete().eq('id', planId)
  if (error) throw error
}

export function isTrainingPlansSchemaMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string }
  return candidate.code === '42P01'
    || candidate.code === 'PGRST205'
    || Boolean(candidate.message?.includes('training_plans'))
}
