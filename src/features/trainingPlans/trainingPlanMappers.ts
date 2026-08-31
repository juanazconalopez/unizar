import { todayIso } from '../../lib/dates'
import { seasonForDate } from '../../lib/selectors'
import { EMPTY_TACTICS_BOARD } from '../../services/trainingPlansService'
import type { Season, TrainingExercisePreset, TrainingExerciseValues, TrainingPlan, TrainingPlanValues } from '../../types'
import { preseasonTrainingPlanValues } from './preseasonDemoPlans'

export function initialTrainingPlanValues(plan: TrainingPlan | undefined, template: TrainingPlan | undefined, seasons: Season[]): TrainingPlanValues {
  const source = plan ?? template
  const date = plan?.session_date ?? todayIso()
  const selectedSeason = source ? seasons.find((season) => season.id === source.season_id) : seasonForDate(seasons, date) ?? seasons[0]
  return {
    seasonId: selectedSeason?.id ?? '', sessionDate: date,
    title: template ? `Copia de ${template.title}` : source?.title ?? '',
    objectives: source?.objectives ?? '', material: source?.material ?? '', status: plan?.status ?? 'draft',
    exercises: source?.training_exercises.length
      ? source.training_exercises.map((exercise) => ({
          title: exercise.title, description: exercise.description ?? '', durationMinutes: exercise.duration_minutes,
          diagramData: structuredClone(exercise.diagram_data),
        }))
      : [emptyTrainingExercise(1)],
  }
}

export function emptyTrainingExercise(index: number): TrainingExerciseValues {
  return {
    title: index === 1 ? 'Calentamiento' : `Ejercicio ${index}`,
    description: '', durationMinutes: index === 1 ? 15 : 10,
    diagramData: structuredClone(EMPTY_TACTICS_BOARD),
  }
}

export function exerciseValuesFromPreset(preset: TrainingExercisePreset): TrainingExerciseValues {
  return {
    title: preset.title, description: preset.description ?? '', durationMinutes: preset.duration_minutes,
    diagramData: structuredClone(preset.diagram_data),
  }
}

export function demoExercisePresets(seasons: Season[], userId: string): TrainingExercisePreset[] {
  return preseasonTrainingPlanValues(seasons).flatMap((plan) => plan.exercises.slice(0, 1))
    .map((exercise, index) => demoPresetFromExercise(exercise, userId, `demo-preset-${index + 1}`))
}

export function demoPresetFromExercise(exercise: TrainingExerciseValues, userId: string, id = `demo-preset-${crypto.randomUUID()}`, existing?: TrainingExercisePreset): TrainingExercisePreset {
  const timestamp = new Date().toISOString()
  return {
    id, title: exercise.title.trim(), description: exercise.description.trim() || null,
    duration_minutes: exercise.durationMinutes, diagram_data: structuredClone(exercise.diagramData),
    created_by: userId, created_at: existing?.created_at ?? timestamp, updated_at: timestamp,
  }
}

export function demoTrainingPlans(seasons: Season[]): TrainingPlan[] {
  return preseasonTrainingPlanValues(seasons).map((values) => demoPlanFromValues(values, seasons))
}

export function demoPlanFromValues(values: TrainingPlanValues, seasons: Season[], existing?: TrainingPlan): TrainingPlan {
  const timestamp = existing?.updated_at ?? '2026-01-01T00:00:00.000Z'
  const planId = existing?.id ?? `demo-plan-${values.sessionDate}`
  return {
    id: planId, season_id: values.seasonId, session_date: values.sessionDate, title: values.title,
    objectives: values.objectives || null, material: values.material || null, status: values.status,
    created_by: existing?.created_by ?? 'demo-user', created_at: existing?.created_at ?? timestamp, updated_at: timestamp,
    seasons: seasons.find((season) => season.id === values.seasonId) ?? null,
    training_exercises: values.exercises.map((exercise, index) => ({
      id: existing?.training_exercises[index]?.id ?? `${planId}-exercise-${index + 1}`,
      training_plan_id: planId, sort_order: index, title: exercise.title, description: exercise.description || null,
      duration_minutes: exercise.durationMinutes, diagram_data: structuredClone(exercise.diagramData),
      created_at: existing?.training_exercises[index]?.created_at ?? timestamp, updated_at: timestamp,
    })),
  }
}

export function trainingPlanStatusLabel(status: TrainingPlan['status']) {
  if (status === 'published') return 'Preparado'
  if (status === 'cancelled') return 'Cancelado'
  return 'Borrador'
}
