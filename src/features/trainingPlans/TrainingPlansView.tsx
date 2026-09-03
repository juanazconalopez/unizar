import { useCallback, useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import {
  deleteTrainingPlan,
  deleteTrainingExercisePreset,
  fetchTrainingPlan,
  fetchTrainingExercisePresets,
  fetchTrainingPlans,
  isTrainingPlansSchemaMissing,
  saveTrainingExercisePreset,
  saveTrainingPlan,
  updateTrainingExercisePreset,
} from '../../services/trainingPlansService'
import type {
  Season,
  TrainingExercisePreset,
  TrainingExerciseValues,
  TrainingPlan,
} from '../../types'
import { TrainingExerciseLibrary } from './TrainingExerciseLibrary'
import { TrainingPlanDetail } from './TrainingPlanDetail'
import { TrainingPlanEditor } from './TrainingPlanEditor'
import { TrainingPresetEditor } from './TrainingPresetEditor'
import {
  demoExercisePresets,
  demoPlanFromValues,
  demoPresetFromExercise,
  demoTrainingPlans,
  trainingPlanStatusLabel,
  upcomingTrainingPlans,
} from './trainingPlanMappers'

type EditorSource = { plan?: TrainingPlan; template?: TrainingPlan }

export function TrainingPlansView({ demo = false, focusedPlanId, seasons, userId, onNotify }: {
  demo?: boolean
  focusedPlanId?: string
  seasons: Season[]
  userId: string
  onNotify: (message: string) => void
}) {
  const [plans, setPlans] = useState<TrainingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [demoMode, setDemoMode] = useState(false)
  const [editor, setEditor] = useState<EditorSource | null>(null)
  const [viewingPlan, setViewingPlan] = useState<TrainingPlan | null>(null)
  const [demoPresets, setDemoPresets] = useState<TrainingExercisePreset[]>([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [libraryPresets, setLibraryPresets] = useState<TrainingExercisePreset[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryError, setLibraryError] = useState('')
  const [presetEditor, setPresetEditor] = useState<'new' | TrainingExercisePreset | null>(null)
  const visiblePlans = upcomingTrainingPlans(plans, todayIso())

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      if (demo) {
        const loadedPlans = demoTrainingPlans(seasons)
        setPlans(loadedPlans)
        setDemoPresets((current) => current.length ? current : demoExercisePresets(seasons, userId))
        if (focusedPlanId) setViewingPlan(loadedPlans.find((plan) => plan.id === focusedPlanId) ?? null)
        setDemoMode(true)
        return
      }
      const loadedPlans = await fetchTrainingPlans()
      setPlans(loadedPlans)
      if (focusedPlanId) {
        const focusedPlan = loadedPlans.find((plan) => plan.id === focusedPlanId) ?? await fetchTrainingPlan(focusedPlanId)
        setViewingPlan(focusedPlan)
      }
      setDemoMode(false)
    } catch (error) {
      if (import.meta.env.DEV && isTrainingPlansSchemaMissing(error)) {
        setPlans(demoTrainingPlans(seasons))
        setDemoPresets((current) => current.length ? current : demoExercisePresets(seasons, userId))
        setDemoMode(true)
        return
      }
      setLoadError(errorText(error))
    } finally {
      setLoading(false)
    }
  }, [demo, focusedPlanId, seasons, userId])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function remove(plan: TrainingPlan) {
    if (!window.confirm(`¿Eliminar el entrenamiento “${plan.title}” y todos sus ejercicios?`)) return
    try {
      if (demoMode) {
        setPlans((current) => current.filter((item) => item.id !== plan.id))
        onNotify('Entrenamiento eliminado de la demo.')
        return
      }
      await deleteTrainingPlan(plan.id)
      onNotify('Entrenamiento eliminado.')
      await load()
    } catch (error) {
      setLoadError(errorText(error))
    }
  }

  async function openLibrary() {
    setLibraryOpen(true)
    setLibraryLoading(true)
    setLibraryError('')
    try {
      setLibraryPresets(demoMode ? demoPresets : await fetchTrainingExercisePresets())
    } catch (error) {
      setLibraryError(errorText(error))
    } finally {
      setLibraryLoading(false)
    }
  }

  async function saveLibraryPreset(values: TrainingExerciseValues) {
    const current = presetEditor === 'new' ? undefined : presetEditor ?? undefined
    const saved = demoMode
      ? demoPresetFromExercise(values, userId, current?.id, current)
      : current
        ? await updateTrainingExercisePreset(current.id, values)
        : await saveTrainingExercisePreset(values, userId)
    const updateList = (items: TrainingExercisePreset[]) => [...items.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.title.localeCompare(b.title, 'es'))
    setLibraryPresets(updateList)
    if (demoMode) setDemoPresets(updateList)
    setPresetEditor(null)
    onNotify(current ? 'Ejercicio predefinido actualizado.' : 'Ejercicio predefinido creado.')
  }

  async function removeLibraryPreset(preset: TrainingExercisePreset) {
    try {
      if (!demoMode) await deleteTrainingExercisePreset(preset.id)
      const updateList = (items: TrainingExercisePreset[]) => items.filter((item) => item.id !== preset.id)
      setLibraryPresets(updateList)
      if (demoMode) setDemoPresets(updateList)
      setPresetEditor(null)
      onNotify('Ejercicio predefinido eliminado.')
    } catch (error) {
      setLibraryError(errorText(error))
      throw error
    }
  }

  if (presetEditor) {
    return <TrainingPresetEditor
      preset={presetEditor === 'new' ? undefined : presetEditor}
      onBack={() => setPresetEditor(null)}
      onDelete={presetEditor === 'new' ? undefined : () => removeLibraryPreset(presetEditor)}
      onSave={saveLibraryPreset}
    />
  }

  if (libraryOpen) {
    return <TrainingExerciseLibrary
      error={libraryError}
      loading={libraryLoading}
      presets={libraryPresets}
      onBack={() => setLibraryOpen(false)}
      onCreate={() => setPresetEditor('new')}
      onEdit={setPresetEditor}
      onReload={() => void openLibrary()}
    />
  }

  if (editor) {
    return <TrainingPlanEditor
      plan={editor.plan}
      seasons={seasons}
      template={editor.template}
      userId={userId}
      onCancel={() => setEditor(null)}
      onDelete={editor.plan ? async () => { await remove(editor.plan!); setEditor(null) } : undefined}
      onSavePlan={async (values) => {
        if (!demoMode) {
          await saveTrainingPlan(editor.plan?.id, values)
          return
        }
        const saved = demoPlanFromValues(values, seasons, editor.plan)
        setPlans((current) => editor.plan
          ? current.map((item) => item.id === editor.plan?.id ? saved : item)
          : [saved, ...current])
      }}
      onLoadPresets={async () => demoMode ? demoPresets : fetchTrainingExercisePresets()}
      onSavePreset={async (exercise) => {
        if (!demoMode) return saveTrainingExercisePreset(exercise, userId)
        const preset = demoPresetFromExercise(exercise, userId)
        setDemoPresets((current) => [...current, preset].sort((a, b) => a.title.localeCompare(b.title, 'es')))
        return preset
      }}
      onNotify={onNotify}
      onSaved={async (message) => {
        onNotify(message)
        if (!demoMode) await load()
        setEditor(null)
      }}
    />
  }

  if (viewingPlan) {
    return <TrainingPlanDetail
      plan={viewingPlan}
      onBack={() => setViewingPlan(null)}
      onEdit={() => { setViewingPlan(null); setEditor({ plan: viewingPlan }) }}
    />
  }

  return (
    <div className="page training-plans-page">
      <PageHeader
        action={<div className="training-header-actions">
          <button className="secondary-button" onClick={() => void openLibrary()} type="button"><Icon name="strategy" size={17} />Biblioteca de ejercicios</button>
          <button className="primary-button" disabled={!seasons.length} onClick={() => setEditor({})}><Icon name="plus" size={17} />Crear entrenamiento</button>
        </div>}
        eyebrow="PLANIFICACIÓN DEL EQUIPO"
        subtitle="Prepara cada sesión con ejercicios de texto y esquemas tácticos reutilizables."
        title="Entrenamientos"
      />

      {demoMode && <div className="training-demo-banner"><Icon name="spark" size={17} /><span><strong>Modo de muestra local.</strong> Puedes editar y guardar en memoria; aplica la migración 029 para persistir en Supabase.</span></div>}

      {loadError && <div className="training-load-error"><p>{loadError}</p><button className="secondary-button compact" onClick={() => void load()}>Reintentar</button></div>}
      {loading ? <div className="training-loading">Cargando entrenamientos…</div> : visiblePlans.length ? (
        <div className="training-plan-list">
          {visiblePlans.map((plan) => {
            const duration = plan.training_exercises.reduce((total, exercise) => total + exercise.duration_minutes, 0)
            return (
              <article className="training-plan-card" key={plan.id}>
                <button aria-label={`Ver entrenamiento ${plan.title}`} className="training-plan-open" onClick={() => setViewingPlan(plan)} />
                <div className="training-plan-date"><strong>{new Date(`${plan.session_date}T12:00:00`).getDate()}</strong><span>{formatDate(plan.session_date, { month: 'short' })}</span></div>
                <div className="training-plan-main">
                  <div className="training-plan-title-row"><span className={`training-plan-status ${plan.status}`}>{trainingPlanStatusLabel(plan.status)}</span><small>{plan.seasons?.name}</small></div>
                  <h2>{plan.title}</h2>
                  <p>{plan.objectives || 'Sin objetivos generales indicados.'}</p>
                  <div className="training-plan-meta">
                    <span><Icon name="tasks" size={14} />{plan.training_exercises.length} ejercicios</span>
                    <span><Icon name="clock" size={14} />{duration} min</span>
                    <span className="training-diagram-count">▧ {plan.training_exercises.filter((exercise) => exercise.diagram_data.elements.length).length} esquemas</span>
                  </div>
                </div>
                <div className="training-plan-card-actions">
                  <button className="secondary-button compact" onClick={() => setEditor({ template: plan })} type="button"><Icon name="copy" size={14} />Duplicar</button>
                  <button className="secondary-button compact" onClick={() => setEditor({ plan })} type="button">Editar</button>
                </div>
              </article>
            )
          })}
        </div>
      ) : !loadError && <EmptyState title="No hay próximos entrenamientos" text="Crea una nueva sesión o consulta las anteriores desde el calendario." />}
    </div>
  )
}
