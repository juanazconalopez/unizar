import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { addDays, todayIso } from '../../lib/dates'
import type { Season, TrainingPlan } from '../../types'

const mocks = vi.hoisted(() => ({
  deleteTrainingExercisePreset: vi.fn(), fetchTrainingPlan: vi.fn(), fetchTrainingPlans: vi.fn(), fetchTrainingExercisePresets: vi.fn(),
  saveTrainingExercisePreset: vi.fn(), saveTrainingPlan: vi.fn(), updateTrainingExercisePreset: vi.fn(),
}))
vi.mock('../../services/trainingPlansService', () => ({
  EMPTY_TACTICS_BOARD: { version: 1, template: 'full', elements: [] },
  deleteTrainingPlan: vi.fn(),
  deleteTrainingExercisePreset: mocks.deleteTrainingExercisePreset,
  fetchTrainingPlan: mocks.fetchTrainingPlan,
  fetchTrainingExercisePresets: mocks.fetchTrainingExercisePresets,
  fetchTrainingPlans: mocks.fetchTrainingPlans,
  isTrainingPlansSchemaMissing: () => false,
  saveTrainingPlan: mocks.saveTrainingPlan,
  saveTrainingExercisePreset: mocks.saveTrainingExercisePreset,
  updateTrainingExercisePreset: mocks.updateTrainingExercisePreset,
}))
vi.mock('./TacticsBoard', () => ({
  TacticsBoard: () => null,
  TacticsBoardPreview: ({ label }: { label: string }) => <div aria-label={label}>Campo táctico</div>,
}))

import { TrainingPlansView } from './TrainingPlansView'
import { trainingPlanDraftKey } from './useTrainingPlanDraft'

const season: Season = {
  id: 'season-1', name: 'Temporada de prueba', start_date: '2020-01-01', end_date: '2099-12-31',
  created_by: 'owner-1', created_at: '2026-01-01', updated_at: '2026-01-01',
}

const plan: TrainingPlan = {
  id: 'plan-1', season_id: season.id, session_date: todayIso(),
  title: 'Pretemporada divertida', objectives: 'Correr y disfrutar.', material: 'Preparar conos.',
  status: 'draft', created_by: 'owner-1', created_at: '2026-01-01', updated_at: '2026-01-01',
  seasons: { name: season.name },
  training_exercises: [{
    id: 'exercise-1', training_plan_id: 'plan-1', sort_order: 0, title: 'Juego de evasión',
    description: 'Cruzar el campo sin ser tocada.', duration_minutes: 20,
    diagram_data: { version: 1, template: 'half', elements: [{ id: 'p1', type: 'player', x: 100, y: 100 }] },
    created_at: '2026-01-01', updated_at: '2026-01-01',
  }],
}

const preset = {
  id: 'preset-1', title: 'Circuito rápido', description: 'Correr entre puertas.', duration_minutes: 12,
  diagram_data: { version: 1 as const, template: 'half' as const, elements: [{ id: 'c1', type: 'cone' as const, x: 50, y: 60 }] },
  created_by: 'owner-1', created_at: '2026-01-01', updated_at: '2026-01-01',
}

describe('training plan reading view', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  test('shows today first, then future sessions, and hides past sessions', async () => {
    const today = todayIso()
    mocks.fetchTrainingPlans.mockResolvedValue([
      { ...plan, id: 'later', title: 'Entrenamiento posterior', session_date: addDays(today, 3) },
      { ...plan, id: 'past', title: 'Entrenamiento pasado', session_date: addDays(today, -1) },
      { ...plan, id: 'today', title: 'Entrenamiento de hoy', session_date: today },
      { ...plan, id: 'next', title: 'Entrenamiento próximo', session_date: addDays(today, 1) },
    ])
    render(<TrainingPlansView onNotify={vi.fn()} seasons={[season]} userId="owner-1" />)

    const cards = await screen.findAllByRole('button', { name: /Ver entrenamiento/ })
    expect(cards.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Ver entrenamiento Entrenamiento de hoy',
      'Ver entrenamiento Entrenamiento próximo',
      'Ver entrenamiento Entrenamiento posterior',
    ])
    expect(screen.queryByText('Entrenamiento pasado')).not.toBeInTheDocument()
  })

  test('opens a past training plan linked from the calendar', async () => {
    const pastPlan = { ...plan, id: 'past-plan', session_date: addDays(todayIso(), -10), title: 'Entrenamiento histórico' }
    mocks.fetchTrainingPlans.mockResolvedValue([])
    mocks.fetchTrainingPlan.mockResolvedValue(pastPlan)

    render(<TrainingPlansView focusedPlanId={pastPlan.id} onNotify={vi.fn()} seasons={[season]} userId="owner-1" />)

    expect(await screen.findByText('VISTA DEL ENTRENAMIENTO')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entrenamiento histórico' })).toBeInTheDocument()
    expect(mocks.fetchTrainingPlan).toHaveBeenCalledWith(pastPlan.id)
  })

  test('opens the card in read mode and keeps Editar for the form', async () => {
    mocks.fetchTrainingPlans.mockResolvedValue([plan])
    const user = userEvent.setup()
    render(<TrainingPlansView onNotify={vi.fn()} seasons={[season]} userId="owner-1" />)

    await user.click(await screen.findByRole('button', { name: `Ver entrenamiento ${plan.title}` }))

    expect(screen.getByText('VISTA DEL ENTRENAMIENTO')).toBeInTheDocument()
    expect(screen.getByText('Cruzar el campo sin ser tocada.')).toBeInTheDocument()
    expect(screen.getByText('MATERIAL')).toBeInTheDocument()
    expect(screen.getByText('Preparar conos.')).toBeInTheDocument()
    expect(screen.getByLabelText('Esquema táctico de Juego de evasión')).toBeInTheDocument()
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Editar entrenamiento' })[0])
    expect(screen.getByText('EDITAR ENTRENAMIENTO')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Pretemporada divertida')).toBeInTheDocument()
    expect(screen.getByLabelText('Material')).toHaveValue('Preparar conos.')
    expect(screen.queryByLabelText('Participantes')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Puntos técnicos')).not.toBeInTheDocument()
  })

  test('preserves an exercise draft on blur, recovers it, and clears it after saving', async () => {
    mocks.fetchTrainingPlans.mockResolvedValue([plan])
    const user = userEvent.setup()
    render(<TrainingPlansView onNotify={vi.fn()} seasons={[season]} userId="owner-1" />)

    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    const description = screen.getByLabelText('Descripción')
    await user.clear(description)
    await user.type(description, 'Descripción que no quiero perder.')
    await user.tab()

    const storageKey = trainingPlanDraftKey('owner-1', plan.id)
    expect(localStorage.getItem(storageKey)).toContain('Descripción que no quiero perder.')

    await user.click(screen.getByRole('button', { name: '← Volver a entrenamientos' }))
    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    expect(screen.getByText('Hay un borrador sin guardar')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Recuperar borrador' }))
    expect(screen.getByLabelText('Descripción')).toHaveValue('Descripción que no quiero perder.')

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(mocks.saveTrainingPlan).toHaveBeenCalledWith(plan.id, expect.objectContaining({
      exercises: [expect.objectContaining({ description: 'Descripción que no quiero perder.' })],
    }))
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  test('saves and reuses a predefined exercise with its preview', async () => {
    mocks.fetchTrainingPlans.mockResolvedValue([plan])
    mocks.fetchTrainingExercisePresets.mockResolvedValue([preset])
    mocks.saveTrainingExercisePreset.mockResolvedValue(preset)
    const user = userEvent.setup()
    render(<TrainingPlansView onNotify={vi.fn()} seasons={[season]} userId="owner-1" />)

    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('button', { name: 'Guardar Juego de evasión como predefinido' }))
    expect(mocks.saveTrainingExercisePreset).toHaveBeenCalledWith(expect.objectContaining({ title: 'Juego de evasión' }), 'owner-1')

    await user.click(screen.getByRole('button', { name: 'Añadir ejercicio' }))
    await user.click(screen.getByRole('button', { name: /Predefinido/ }))
    expect(await screen.findByLabelText('Vista previa de Circuito rápido')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Añadir al entrenamiento' }))
    expect(screen.getByDisplayValue('Circuito rápido')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Correr entre puertas.')).toBeInTheDocument()
  })

  test('manages predefined exercises from the library', async () => {
    mocks.fetchTrainingPlans.mockResolvedValue([plan])
    mocks.fetchTrainingExercisePresets.mockResolvedValue([preset])
    mocks.updateTrainingExercisePreset.mockResolvedValue({ ...preset, title: 'Circuito revisado' })
    mocks.deleteTrainingExercisePreset.mockResolvedValue(undefined)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<TrainingPlansView onNotify={vi.fn()} seasons={[season]} userId="owner-1" />)

    await user.click(await screen.findByRole('button', { name: 'Biblioteca de ejercicios' }))
    expect(await screen.findByRole('heading', { name: 'Biblioteca de ejercicios' })).toBeInTheDocument()
    expect(screen.getByLabelText('Esquema de Circuito rápido')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar ejercicio Circuito rápido' }))
    const title = screen.getByLabelText('Título')
    await user.clear(title)
    await user.type(title, 'Circuito revisado')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(mocks.updateTrainingExercisePreset).toHaveBeenCalledWith('preset-1', expect.objectContaining({ title: 'Circuito revisado' }))
    expect(await screen.findByText('Circuito revisado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editar ejercicio Circuito revisado' }))
    await user.click(screen.getByRole('button', { name: 'Eliminar ejercicio' }))
    expect(confirm).toHaveBeenCalled()
    expect(mocks.deleteTrainingExercisePreset).toHaveBeenCalledWith('preset-1')
    expect(await screen.findByText('La biblioteca está vacía')).toBeInTheDocument()

    const created = { ...preset, id: 'preset-2', title: 'Nuevo juego', diagram_data: { version: 1 as const, template: 'full' as const, elements: [] } }
    mocks.saveTrainingExercisePreset.mockResolvedValue(created)
    await user.click(screen.getByRole('button', { name: 'Crear ejercicio' }))
    await user.type(screen.getByLabelText('Título'), 'Nuevo juego')
    await user.click(screen.getByRole('button', { name: 'Crear ejercicio' }))
    expect(mocks.saveTrainingExercisePreset).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nuevo juego' }), 'owner-1')
    expect(await screen.findByText('Nuevo juego')).toBeInTheDocument()
    confirm.mockRestore()
  })
})
