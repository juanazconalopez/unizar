import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate, todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import { seasonForDate } from '../../lib/selectors'
import {
  deleteTrainingPlan,
  deleteTrainingExercisePreset,
  EMPTY_TACTICS_BOARD,
  fetchTrainingExercisePresets,
  fetchTrainingPlans,
  isTrainingPlansSchemaMissing,
  saveTrainingExercisePreset,
  saveTrainingPlan,
  updateTrainingExercisePreset,
} from '../../services/trainingPlansService'
import type {
  Season,
  TacticsBoardData,
  TrainingExercisePreset,
  TrainingExerciseValues,
  TrainingPlan,
  TrainingPlanValues,
} from '../../types'
import { TacticsBoard, TacticsBoardPreview } from './TacticsBoard'
import { preseasonTrainingPlanValues } from './preseasonDemoPlans'

type EditorSource = { plan?: TrainingPlan; template?: TrainingPlan }

export function TrainingPlansView({ seasons, userId, onNotify }: {
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

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setPlans(await fetchTrainingPlans())
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
  }, [seasons, userId])

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
      {loading ? <div className="training-loading">Cargando entrenamientos…</div> : plans.length ? (
        <div className="training-plan-list">
          {plans.map((plan) => {
            const duration = plan.training_exercises.reduce((total, exercise) => total + exercise.duration_minutes, 0)
            return (
              <article className="training-plan-card" key={plan.id}>
                <button aria-label={`Ver entrenamiento ${plan.title}`} className="training-plan-open" onClick={() => setViewingPlan(plan)} />
                <div className="training-plan-date"><strong>{new Date(`${plan.session_date}T12:00:00`).getDate()}</strong><span>{formatDate(plan.session_date, { month: 'short' })}</span></div>
                <div className="training-plan-main">
                  <div className="training-plan-title-row"><span className={`training-plan-status ${plan.status}`}>{statusLabel(plan.status)}</span><small>{plan.seasons?.name}</small></div>
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
      ) : !loadError && <EmptyState title="Todavía no hay entrenamientos" text="Crea la primera sesión y añade ejercicios con su esquema táctico." />}
    </div>
  )
}

function TrainingExerciseLibrary({ presets, loading, error, onBack, onCreate, onEdit, onReload }: {
  presets: TrainingExercisePreset[]
  loading: boolean
  error: string
  onBack: () => void
  onCreate: () => void
  onEdit: (preset: TrainingExercisePreset) => void
  onReload: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    return term ? presets.filter((preset) => `${preset.title} ${preset.description ?? ''}`.toLocaleLowerCase('es').includes(term)) : presets
  }, [presets, search])

  return <div className="page training-library-page">
    <button className="text-button training-detail-back" onClick={onBack} type="button">← Volver a entrenamientos</button>
    <PageHeader
      action={<button className="primary-button" onClick={onCreate} type="button"><Icon name="plus" size={17} />Crear ejercicio</button>}
      eyebrow="RECURSOS DEL CUERPO TÉCNICO"
      subtitle="Crea, revisa y reutiliza ejercicios con sus pizarras tácticas."
      title="Biblioteca de ejercicios"
    />
    <div className="training-library-toolbar">
      <label><Icon name="search" size={17} /><input aria-label="Buscar ejercicio" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o descripción…" type="search" value={search} /></label>
      <span>{filtered.length} {filtered.length === 1 ? 'ejercicio' : 'ejercicios'}</span>
    </div>
    {error ? <div className="training-load-error"><p>{error}</p><button className="secondary-button compact" onClick={onReload} type="button">Reintentar</button></div> : loading ? <div className="training-loading">Cargando biblioteca…</div> : filtered.length ? <div className="training-library-grid">
      {filtered.map((preset) => {
        const hasDiagram = preset.diagram_data.elements.length > 0
        return <article className="training-library-card" key={preset.id}>
          <button aria-label={`Editar ejercicio ${preset.title}`} className="training-library-card-open" onClick={() => onEdit(preset)} type="button" />
          <div className={hasDiagram ? 'training-library-card-preview populated' : 'training-library-card-preview'}>
            {hasDiagram
              ? <TacticsBoardPreview data={preset.diagram_data} label={`Esquema de ${preset.title}`} />
              : <div><span>Sin pizarra táctica</span></div>}
          </div>
          <div className="training-library-card-content">
            <div className="training-library-card-meta"><span><Icon name="clock" size={14} />{preset.duration_minutes} min</span>{hasDiagram && <span className="has-diagram"><Icon name="strategy" size={14} />Con esquema</span>}</div>
            <h2>{preset.title}</h2>
            <p>{preset.description || 'Sin descripción.'}</p>
          </div>
          <button className="secondary-button compact training-library-edit" onClick={() => onEdit(preset)} type="button">Editar</button>
        </article>
      })}
    </div> : <EmptyState title={search ? 'No hay coincidencias' : 'La biblioteca está vacía'} text={search ? 'Prueba con otro término de búsqueda.' : 'Crea el primer ejercicio predefinido con su descripción y pizarra.'} />}
  </div>
}

function TrainingPresetEditor({ preset, onBack, onSave, onDelete }: {
  preset?: TrainingExercisePreset
  onBack: () => void
  onSave: (values: TrainingExerciseValues) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [values, setValues] = useState<TrainingExerciseValues>(() => preset ? exerciseValuesFromPreset(preset) : {
    title: '', description: '', durationMinutes: 10, diagramData: structuredClone(EMPTY_TACTICS_BOARD),
  })
  const [boardOpen, setBoardOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const hasDiagram = values.diagramData.elements.length > 0

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!values.title.trim()) { setFormError('Escribe un título para el ejercicio.'); return }
    setBusy(true)
    setFormError('')
    try { await onSave(values) } catch (error) { setFormError(errorText(error)); setBusy(false) }
  }

  async function remove() {
    if (!onDelete) return
    if (!window.confirm(`¿Eliminar el ejercicio predefinido “${preset?.title}”?`)) return
    setBusy(true)
    setFormError('')
    try { await onDelete() } catch (error) { setFormError(errorText(error)); setBusy(false) }
  }

  return <div className="page training-preset-editor-page">
    <button className="text-button training-detail-back" onClick={onBack} type="button">← Volver a la biblioteca</button>
    <div className="training-editor-heading">
      <div><span className="eyebrow">{preset ? 'EDITAR EJERCICIO PREDEFINIDO' : 'NUEVO EJERCICIO PREDEFINIDO'}</span><h1>{preset?.title || 'Crear ejercicio'}</h1></div>
      <div className="training-duration"><strong>{values.durationMinutes}</strong><span>minutos<br />de ejercicio</span></div>
    </div>
    <form onSubmit={submit}>
      <section className="training-editor-section">
        <div className="training-section-heading"><span>1</span><div><h2>Datos del ejercicio</h2><p>Define una versión reutilizable para futuros entrenamientos.</p></div></div>
        <div className="training-exercise-fields training-preset-fields">
          <label>Título<input autoFocus onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))} required value={values.title} /></label>
          <label>Duración (min)<input max="240" min="1" onChange={(event) => setValues((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} required type="number" value={values.durationMinutes} /></label>
          <label className="full-field">Descripción<textarea onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} placeholder="Explica la organización y el desarrollo del ejercicio…" rows={5} value={values.description} /></label>
        </div>
      </section>
      <section className="training-editor-section">
        <div className="training-section-heading"><span>2</span><div><h2>Pizarra táctica</h2><p>{hasDiagram ? 'El ejercicio tiene un esquema preparado.' : 'Añade un esquema si ayuda a entender la organización.'}</p></div>{hasDiagram && <div className="training-schema-indicator"><Icon name="strategy" size={16} />Con esquema</div>}</div>
        <button className={hasDiagram ? 'training-board-button populated training-preset-board-button' : 'training-board-button training-preset-board-button'} onClick={() => setBoardOpen(true)} type="button">
          {hasDiagram && <span className="training-board-preview"><i /><i /><i /></span>}
          <span><strong>{hasDiagram ? 'Editar esquema táctico' : 'Crear esquema táctico'}</strong><small>Campo, jugadoras, rivales, conos, balones, flechas y zonas.</small></span>
          <Icon name="arrow" />
        </button>
      </section>
      {formError && <p className="form-error training-form-error">{formError}</p>}
      <div className="training-editor-actions">
        {preset && onDelete && <button className="danger-button" disabled={busy} onClick={() => void remove()} type="button">Eliminar ejercicio</button>}
        <button className="secondary-button" disabled={busy} onClick={onBack} type="button">Cancelar</button>
        <button className="primary-button" disabled={busy}>{busy ? 'Guardando…' : preset ? 'Guardar cambios' : 'Crear ejercicio'}</button>
      </div>
    </form>
    {boardOpen && <TacticsBoard exerciseTitle={values.title} initialData={values.diagramData} onCancel={() => setBoardOpen(false)} onSave={(diagramData) => { setValues((current) => ({ ...current, diagramData })); setBoardOpen(false) }} />}
  </div>
}

function TrainingPlanDetail({ plan, onBack, onEdit }: {
  plan: TrainingPlan
  onBack: () => void
  onEdit: () => void
}) {
  const totalDuration = plan.training_exercises.reduce((total, exercise) => total + exercise.duration_minutes, 0)
  return (
    <div className="page training-detail-page">
      <button className="text-button training-detail-back" onClick={onBack} type="button">← Volver a entrenamientos</button>

      <header className="training-detail-hero">
        <div className="training-detail-hero-main">
          <div className="training-detail-kicker">
            <span className={`training-plan-status ${plan.status}`}>{statusLabel(plan.status)}</span>
            <span>{plan.seasons?.name}</span>
          </div>
          <span className="eyebrow">VISTA DEL ENTRENAMIENTO</span>
          <h1>{plan.title}</h1>
          <p className="training-detail-date"><Icon name="calendar" size={17} />{formatDate(plan.session_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="training-detail-hero-actions">
          <div className="training-detail-duration"><strong>{totalDuration}</strong><span>minutos</span></div>
          <button className="primary-button" onClick={onEdit} type="button">Editar entrenamiento</button>
        </div>
      </header>

      <section className="training-detail-overview">
        <article>
          <span className="eyebrow">OBJETIVOS</span>
          <p>{plan.objectives || 'Sin objetivos generales indicados.'}</p>
        </article>
        {plan.material && <article>
          <span className="eyebrow">MATERIAL</span>
          <p>{plan.material}</p>
        </article>}
        <div className="training-detail-summary">
          <span><strong>{plan.training_exercises.length}</strong> ejercicios</span>
          <span><strong>{plan.training_exercises.filter((exercise) => exercise.diagram_data.elements.length).length}</strong> esquemas</span>
        </div>
      </section>

      <div className="training-detail-section-heading">
        <span className="eyebrow">DESARROLLO DE LA SESIÓN</span>
        <h2>Ejercicios</h2>
      </div>
      <div className="training-detail-exercises">
        {plan.training_exercises.map((exercise, index) => (
          <article className="training-detail-exercise" key={exercise.id}>
            <header>
              <span className="training-detail-number">{index + 1}</span>
              <div><h3>{exercise.title}</h3><p>Ejercicio {index + 1} de {plan.training_exercises.length}</p></div>
              <span className="training-detail-exercise-time"><Icon name="clock" size={16} /><strong>{exercise.duration_minutes}</strong> min</span>
            </header>
            <div className="training-detail-exercise-body">
              <div className="training-detail-instructions">
                <section>
                  <span className="eyebrow">DESARROLLO</span>
                  <p>{exercise.description || 'Sin descripción.'}</p>
                </section>
              </div>
              <div className="training-detail-board">
                <div><span className="eyebrow">ESQUEMA</span><small>{exercise.diagram_data.template === 'full' ? 'Campo completo' : exercise.diagram_data.template === 'half' ? 'Medio campo' : 'Zona de 22'}</small></div>
                {exercise.diagram_data.elements.length
                  ? <TacticsBoardPreview data={exercise.diagram_data} label={`Esquema táctico de ${exercise.title}`} />
                  : <div className="training-detail-no-board">Este ejercicio no tiene esquema.</div>}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="training-detail-footer">
        <button className="secondary-button" onClick={onBack} type="button">Volver</button>
        <button className="primary-button" onClick={onEdit} type="button">Editar entrenamiento</button>
      </div>
    </div>
  )
}

function TrainingPlanEditor({ plan, template, seasons, onCancel, onDelete, onSavePlan, onLoadPresets, onSavePreset, onNotify, onSaved }: {
  plan?: TrainingPlan
  template?: TrainingPlan
  seasons: Season[]
  onCancel: () => void
  onDelete?: () => Promise<void>
  onSavePlan: (values: TrainingPlanValues) => Promise<void>
  onLoadPresets: () => Promise<TrainingExercisePreset[]>
  onSavePreset: (exercise: TrainingExerciseValues) => Promise<TrainingExercisePreset>
  onNotify: (message: string) => void
  onSaved: (message: string) => Promise<void>
}) {
  const [values, setValues] = useState<TrainingPlanValues>(() => initialValues(plan, template, seasons))
  const [boardExercise, setBoardExercise] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formError, setFormError] = useState('')
  const [addDialog, setAddDialog] = useState<'choice' | 'presets' | null>(null)
  const [presets, setPresets] = useState<TrainingExercisePreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [loadingPresets, setLoadingPresets] = useState(false)
  const [presetError, setPresetError] = useState('')
  const [savingPresetIndex, setSavingPresetIndex] = useState<number | null>(null)
  const totalDuration = useMemo(() => values.exercises.reduce((total, exercise) => total + exercise.durationMinutes, 0), [values.exercises])
  const selectedSeason = seasons.find((season) => season.id === values.seasonId)
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId)

  function update<K extends keyof TrainingPlanValues>(key: K, value: TrainingPlanValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function changeDate(date: string) {
    const matchingSeason = seasonForDate(seasons, date)
    setValues((current) => ({ ...current, sessionDate: date, ...(matchingSeason ? { seasonId: matchingSeason.id } : {}) }))
  }

  function updateExercise(index: number, changes: Partial<TrainingExerciseValues>) {
    setValues((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, exerciseIndex) => exerciseIndex === index ? { ...exercise, ...changes } : exercise),
    }))
  }

  function addBlankExercise() {
    setValues((current) => ({
      ...current,
      exercises: [...current.exercises, { ...emptyExercise(current.exercises.length + 1), title: '' }],
    }))
    setAddDialog(null)
  }

  async function openPresetList() {
    setAddDialog('presets')
    setLoadingPresets(true)
    setPresetError('')
    try {
      const loaded = await onLoadPresets()
      setPresets(loaded)
      setSelectedPresetId((current) => loaded.some((preset) => preset.id === current) ? current : loaded[0]?.id ?? null)
    } catch (error) {
      setPresetError(errorText(error))
    } finally {
      setLoadingPresets(false)
    }
  }

  function addSelectedPreset() {
    if (!selectedPreset) return
    setValues((current) => ({
      ...current,
      exercises: [...current.exercises, exerciseValuesFromPreset(selectedPreset)],
    }))
    setAddDialog(null)
    onNotify(`“${selectedPreset.title}” añadido al entrenamiento.`)
  }

  async function savePreset(index: number) {
    const exercise = values.exercises[index]
    if (!exercise.title.trim()) {
      setFormError('Escribe un título antes de guardar el ejercicio como predefinido.')
      return
    }
    setSavingPresetIndex(index)
    setFormError('')
    try {
      const savedPreset = await onSavePreset(exercise)
      setPresets((current) => [...current.filter((preset) => preset.id !== savedPreset.id), savedPreset].sort((a, b) => a.title.localeCompare(b.title, 'es')))
      onNotify(`“${exercise.title}” guardado como ejercicio predefinido.`)
    } catch (error) {
      setFormError(errorText(error))
    } finally {
      setSavingPresetIndex(null)
    }
  }

  function removeExercise(index: number) {
    if (values.exercises.length === 1) return
    setValues((current) => ({ ...current, exercises: current.exercises.filter((_, exerciseIndex) => exerciseIndex !== index) }))
  }

  function moveExercise(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= values.exercises.length) return
    setValues((current) => {
      const exercises = [...current.exercises]
      ;[exercises[index], exercises[target]] = [exercises[target], exercises[index]]
      return { ...current, exercises }
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      if (!values.title.trim()) throw new Error('Escribe un título para el entrenamiento.')
      if (!selectedSeason || values.sessionDate < selectedSeason.start_date || values.sessionDate > selectedSeason.end_date) {
        throw new Error('Selecciona una fecha incluida en una temporada.')
      }
      if (values.exercises.some((exercise) => !exercise.title.trim())) throw new Error('Todos los ejercicios necesitan un título.')
      await onSavePlan(values)
      await onSaved(plan ? 'Entrenamiento actualizado.' : template ? 'Entrenamiento duplicado.' : 'Entrenamiento creado.')
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  async function deletePlan() {
    if (!onDelete || !window.confirm('Esta acción eliminará también todos los ejercicios y esquemas.')) return
    setDeleting(true)
    setFormError('')
    try { await onDelete() } catch (error) { setFormError(errorText(error)); setDeleting(false) }
  }

  const activeBoardExercise = boardExercise === null ? undefined : values.exercises[boardExercise]

  return (
    <div className="page training-editor-page">
      <div className="training-editor-heading">
        <button className="text-button" onClick={onCancel} type="button">← Volver a entrenamientos</button>
        <div><span className="eyebrow">{plan ? 'EDITAR ENTRENAMIENTO' : template ? 'DUPLICAR ENTRENAMIENTO' : 'NUEVO ENTRENAMIENTO'}</span><h1>{plan ? plan.title : template ? `Copia de ${template.title}` : 'Prepara una nueva sesión'}</h1></div>
        <div className="training-duration"><strong>{totalDuration}</strong><span>minutos<br />planificados</span></div>
      </div>

      <form onSubmit={submit}>
        <section className="training-editor-section training-basics">
          <div className="training-section-heading"><span>1</span><div><h2>Datos de la sesión</h2><p>Define cuándo se realiza y qué se quiere trabajar.</p></div></div>
          <div className="form-grid">
            <label>Título<input autoFocus onChange={(event) => update('title', event.target.value)} placeholder="Ej. Defensa organizada y salida" required value={values.title} /></label>
            <label>Fecha<input onChange={(event) => changeDate(event.target.value)} required type="date" value={values.sessionDate} /></label>
            <label>Temporada<select onChange={(event) => update('seasonId', event.target.value)} value={values.seasonId}>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
            <label>Estado<select onChange={(event) => update('status', event.target.value as TrainingPlanValues['status'])} value={values.status}><option value="draft">Borrador</option><option value="published">Preparado</option>{plan && <option value="cancelled">Cancelado</option>}</select></label>
            <label className="full-field">Objetivos<textarea onChange={(event) => update('objectives', event.target.value)} placeholder="Principios y objetivos principales de la sesión…" rows={3} value={values.objectives} /></label>
            <label className="full-field">Material<textarea onChange={(event) => update('material', event.target.value)} placeholder="Balones, conos, petos, escudos…" rows={2} value={values.material} /></label>
          </div>
        </section>

        <section className="training-editor-section">
          <div className="training-section-heading"><span>2</span><div><h2>Ejercicios</h2><p>Ordena la sesión, añade indicaciones y prepara cada esquema.</p></div><button className="secondary-button" onClick={() => setAddDialog('choice')} type="button"><Icon name="plus" size={16} />Añadir ejercicio</button></div>
          <div className="training-exercise-list">
            {values.exercises.map((exercise, index) => (
              <article className="training-exercise-card" key={index}>
                <header>
                  <span className="training-exercise-number">{index + 1}</span>
                  <div><strong>{exercise.title || `Ejercicio ${index + 1}`}</strong><small>{exercise.durationMinutes} min {exercise.diagramData.elements.length > 0 && <span className="training-exercise-has-schema">· <Icon name="strategy" size={12} />Esquema</span>}</small></div>
                  <div className="training-exercise-order">
                    <button aria-label="Subir ejercicio" className="secondary-button compact" disabled={index === 0} onClick={() => moveExercise(index, -1)} type="button">↑</button>
                    <button aria-label="Bajar ejercicio" className="secondary-button compact" disabled={index === values.exercises.length - 1} onClick={() => moveExercise(index, 1)} type="button">↓</button>
                    <button aria-label={`Guardar ${exercise.title || `ejercicio ${index + 1}`} como predefinido`} className="secondary-button compact" disabled={savingPresetIndex !== null} onClick={() => void savePreset(index)} title="Guardar como predefinido" type="button"><Icon name="save" size={14} /></button>
                    <button aria-label="Eliminar ejercicio" className="secondary-button compact" disabled={values.exercises.length === 1} onClick={() => removeExercise(index)} type="button">×</button>
                  </div>
                </header>
                <div className="training-exercise-fields">
                  <label>Título<input onChange={(event) => updateExercise(index, { title: event.target.value })} required value={exercise.title} /></label>
                  <label>Duración (min)<input max="240" min="1" onChange={(event) => updateExercise(index, { durationMinutes: Number(event.target.value) })} required type="number" value={exercise.durationMinutes} /></label>
                  <label className="full-field">Descripción<textarea onChange={(event) => updateExercise(index, { description: event.target.value })} placeholder="Explica la organización y el desarrollo del ejercicio…" rows={3} value={exercise.description} /></label>
                </div>
                <button className={exercise.diagramData.elements.length ? 'training-board-button populated' : 'training-board-button'} onClick={() => setBoardExercise(index)} type="button">
                  {exercise.diagramData.elements.length > 0 && <span className="training-board-preview"><i /><i /><i /></span>}
                  <span><strong>{exercise.diagramData.elements.length ? 'Editar esquema táctico' : 'Crear esquema táctico'}</strong><small>Campo, jugadoras, rivales, conos, balones, flechas y zonas.</small></span>
                  <Icon name="arrow" />
                </button>
              </article>
            ))}
          </div>
        </section>

        {formError && <p className="form-error training-form-error">{formError}</p>}
        <div className="training-editor-actions">
          {plan && onDelete && <button className="danger-button" disabled={saving || deleting} onClick={() => void deletePlan()} type="button">{deleting ? 'Eliminando…' : 'Eliminar entrenamiento'}</button>}
          <button className="secondary-button" disabled={saving || deleting} onClick={onCancel} type="button">Cancelar</button>
          <button className="primary-button" disabled={saving || deleting}>{saving ? 'Guardando…' : plan ? 'Guardar cambios' : 'Crear entrenamiento'}</button>
        </div>
      </form>

      {activeBoardExercise && <TacticsBoard
        exerciseTitle={activeBoardExercise.title}
        initialData={activeBoardExercise.diagramData}
        onCancel={() => setBoardExercise(null)}
        onSave={(diagramData: TacticsBoardData) => { updateExercise(boardExercise!, { diagramData }); setBoardExercise(null) }}
      />}

      {addDialog === 'choice' && <Modal className="training-add-exercise-dialog" labelledBy="training-add-exercise-title" onClose={() => setAddDialog(null)}>
        <div className="training-preset-heading">
          <div><span className="eyebrow">AÑADIR EJERCICIO</span><h2 id="training-add-exercise-title">¿Cómo quieres empezar?</h2></div>
          <button aria-label="Cerrar" className="icon-button" onClick={() => setAddDialog(null)} type="button">×</button>
        </div>
        <div className="training-add-options">
          <button onClick={addBlankExercise} type="button"><Icon name="plus" size={25} /><strong>En blanco</strong><span>Crea un ejercicio desde cero.</span></button>
          <button onClick={() => void openPresetList()} type="button"><Icon name="copy" size={25} /><strong>Predefinido</strong><span>Reutiliza un ejercicio de la biblioteca.</span></button>
        </div>
      </Modal>}

      {addDialog === 'presets' && <Modal className="training-preset-dialog" labelledBy="training-preset-title" onClose={() => setAddDialog(null)}>
        <div className="training-preset-heading">
          <div><span className="eyebrow">BIBLIOTECA DE EJERCICIOS</span><h2 id="training-preset-title">Añadir ejercicio predefinido</h2></div>
          <button aria-label="Cerrar" className="icon-button" onClick={() => setAddDialog(null)} type="button">×</button>
        </div>
        {loadingPresets ? <div className="training-preset-loading">Cargando ejercicios…</div> : presetError ? <div className="training-preset-error"><p>{presetError}</p><button className="secondary-button compact" onClick={() => void openPresetList()} type="button">Reintentar</button></div> : presets.length ? <>
          <div className="training-preset-picker">
            <div aria-label="Ejercicios predefinidos" className="training-preset-list" role="listbox">
              {presets.map((preset) => <button aria-selected={preset.id === selectedPresetId} className={preset.id === selectedPresetId ? 'selected' : ''} key={preset.id} onClick={() => setSelectedPresetId(preset.id)} role="option" type="button">
                <span><strong>{preset.title}</strong><small>{preset.duration_minutes} min · {preset.diagram_data.elements.length ? `${preset.diagram_data.elements.length} elementos` : 'Sin esquema'}</small></span>
                <Icon name="arrow" size={15} />
              </button>)}
            </div>
            {selectedPreset && <article className="training-preset-preview">
              <header><div><span className="eyebrow">VISTA PREVIA</span><h3>{selectedPreset.title}</h3></div><strong>{selectedPreset.duration_minutes} min</strong></header>
              <p>{selectedPreset.description || 'Sin descripción.'}</p>
              {selectedPreset.diagram_data.elements.length
                ? <TacticsBoardPreview data={selectedPreset.diagram_data} label={`Vista previa de ${selectedPreset.title}`} />
                : <div className="training-detail-no-board">Este ejercicio no tiene esquema.</div>}
            </article>}
          </div>
          <div className="form-actions training-preset-actions">
            <button className="secondary-button" onClick={() => setAddDialog('choice')} type="button">Atrás</button>
            <button className="primary-button" disabled={!selectedPreset} onClick={addSelectedPreset} type="button">Añadir al entrenamiento</button>
          </div>
        </> : <div className="training-preset-empty"><Icon name="save" size={30} /><h3>No hay ejercicios predefinidos</h3><p>Guarda uno desde el icono de disquete de cualquier ejercicio.</p><button className="secondary-button" onClick={() => setAddDialog('choice')} type="button">Volver</button></div>}
      </Modal>}
    </div>
  )
}

function initialValues(plan: TrainingPlan | undefined, template: TrainingPlan | undefined, seasons: Season[]): TrainingPlanValues {
  const source = plan ?? template
  const date = plan?.session_date ?? todayIso()
  const selectedSeason = source ? seasons.find((season) => season.id === source.season_id) : seasonForDate(seasons, date) ?? seasons[0]
  return {
    seasonId: selectedSeason?.id ?? '',
    sessionDate: date,
    title: template ? `Copia de ${template.title}` : source?.title ?? '',
    objectives: source?.objectives ?? '',
    material: source?.material ?? '',
    status: plan?.status ?? 'draft',
    exercises: source?.training_exercises.length
      ? source.training_exercises.map((exercise) => ({
          title: exercise.title,
          description: exercise.description ?? '',
          durationMinutes: exercise.duration_minutes,
          diagramData: structuredClone(exercise.diagram_data),
        }))
      : [emptyExercise(1)],
  }
}

function emptyExercise(index: number): TrainingExerciseValues {
  return {
    title: index === 1 ? 'Calentamiento' : `Ejercicio ${index}`,
    description: '',
    durationMinutes: index === 1 ? 15 : 10,
    diagramData: structuredClone(EMPTY_TACTICS_BOARD),
  }
}

function exerciseValuesFromPreset(preset: TrainingExercisePreset): TrainingExerciseValues {
  return {
    title: preset.title,
    description: preset.description ?? '',
    durationMinutes: preset.duration_minutes,
    diagramData: structuredClone(preset.diagram_data),
  }
}

function demoExercisePresets(seasons: Season[], userId: string): TrainingExercisePreset[] {
  return preseasonTrainingPlanValues(seasons)
    .flatMap((plan) => plan.exercises.slice(0, 1))
    .map((exercise, index) => demoPresetFromExercise(exercise, userId, `demo-preset-${index + 1}`))
}

function demoPresetFromExercise(exercise: TrainingExerciseValues, userId: string, id = `demo-preset-${crypto.randomUUID()}`, existing?: TrainingExercisePreset): TrainingExercisePreset {
  const timestamp = new Date().toISOString()
  return {
    id,
    title: exercise.title.trim(),
    description: exercise.description.trim() || null,
    duration_minutes: exercise.durationMinutes,
    diagram_data: structuredClone(exercise.diagramData),
    created_by: userId,
    created_at: existing?.created_at ?? timestamp,
    updated_at: timestamp,
  }
}

function demoTrainingPlans(seasons: Season[]): TrainingPlan[] {
  return preseasonTrainingPlanValues(seasons).map((values) => demoPlanFromValues(values, seasons))
}

function demoPlanFromValues(values: TrainingPlanValues, seasons: Season[], existing?: TrainingPlan): TrainingPlan {
  const timestamp = existing?.updated_at ?? '2026-01-01T00:00:00.000Z'
  const planId = existing?.id ?? `demo-plan-${values.sessionDate}`
  return {
    id: planId,
    season_id: values.seasonId,
    session_date: values.sessionDate,
    title: values.title,
    objectives: values.objectives || null,
    material: values.material || null,
    status: values.status,
    created_by: existing?.created_by ?? 'demo-user',
    created_at: existing?.created_at ?? timestamp,
    updated_at: timestamp,
    seasons: seasons.find((season) => season.id === values.seasonId) ?? null,
    training_exercises: values.exercises.map((exercise, index) => ({
      id: existing?.training_exercises[index]?.id ?? `${planId}-exercise-${index + 1}`,
      training_plan_id: planId,
      sort_order: index,
      title: exercise.title,
      description: exercise.description || null,
      duration_minutes: exercise.durationMinutes,
      diagram_data: structuredClone(exercise.diagramData),
      created_at: existing?.training_exercises[index]?.created_at ?? timestamp,
      updated_at: timestamp,
    })),
  }
}

function statusLabel(status: TrainingPlan['status']) {
  if (status === 'published') return 'Preparado'
  if (status === 'cancelled') return 'Cancelado'
  return 'Borrador'
}
