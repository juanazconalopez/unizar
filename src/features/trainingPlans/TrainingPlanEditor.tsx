import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { seasonForDate } from '../../lib/selectors'
import type { Season, TacticsBoardData, TrainingExercisePreset, TrainingExerciseValues, TrainingPlan, TrainingPlanValues } from '../../types'
import { TacticsBoard, TacticsBoardPreview } from './TacticsBoard'
import { emptyTrainingExercise, exerciseValuesFromPreset, initialTrainingPlanValues } from './trainingPlanMappers'
import { trainingPlanDraftKey, useTrainingPlanDraft } from './useTrainingPlanDraft'

export function TrainingPlanEditor({ plan, template, seasons, userId, onCancel, onDelete, onSavePlan, onLoadPresets, onSavePreset, onNotify, onSaved }: {
  plan?: TrainingPlan
  template?: TrainingPlan
  seasons: Season[]
  userId: string
  onCancel: () => void
  onDelete?: () => Promise<void>
  onSavePlan: (values: TrainingPlanValues) => Promise<void>
  onLoadPresets: () => Promise<TrainingExercisePreset[]>
  onSavePreset: (exercise: TrainingExerciseValues) => Promise<TrainingExercisePreset>
  onNotify: (message: string) => void
  onSaved: (message: string) => Promise<void>
}) {
  const [initialValues] = useState<TrainingPlanValues>(() => initialTrainingPlanValues(plan, template, seasons))
  const [values, setValues] = useState<TrainingPlanValues>(initialValues)
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
  const draft = useTrainingPlanDraft({
    storageKey: trainingPlanDraftKey(userId, plan?.id, template?.id),
    initialValues,
    values,
    onRecover: setValues,
  })

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
      exercises: [...current.exercises, { ...emptyTrainingExercise(current.exercises.length + 1), title: '' }],
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
      draft.clearDraft()
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
    try { await onDelete(); draft.clearDraft() } catch (error) { setFormError(errorText(error)); setDeleting(false) }
  }

  const activeBoardExercise = boardExercise === null ? undefined : values.exercises[boardExercise]

  return (
    <div className="page training-editor-page">
      <div className="training-editor-heading">
        <button className="text-button" onClick={onCancel} type="button">← Volver a entrenamientos</button>
        <div><span className="eyebrow">{plan ? 'EDITAR ENTRENAMIENTO' : template ? 'DUPLICAR ENTRENAMIENTO' : 'NUEVO ENTRENAMIENTO'}</span><h1>{plan ? plan.title : template ? `Copia de ${template.title}` : 'Prepara una nueva sesión'}</h1></div>
        <div className="training-duration"><strong>{totalDuration}</strong><span>minutos<br />planificados</span></div>
      </div>

      {draft.pendingDraft ? (
        <div className="training-draft-notice" role="status">
          <div><Icon name="save" size={18} /><span><strong>Hay un borrador sin guardar</strong><small>Puedes recuperar los cambios guardados anteriormente en este dispositivo.</small></span></div>
          <span className="training-draft-actions">
            <button className="secondary-button compact" onClick={draft.discardDraft} type="button">Descartar</button>
            <button className="primary-button compact" onClick={draft.recoverDraft} type="button">Recuperar borrador</button>
          </span>
        </div>
      ) : draft.status !== 'idle' && (
        <div aria-live="polite" className={`training-draft-status ${draft.status === 'error' ? 'error' : ''}`}>
          <Icon name="save" size={14} />
          {draft.status === 'saving' && 'Guardando borrador…'}
          {draft.status === 'saved' && 'Borrador guardado en este dispositivo'}
          {draft.status === 'recovered' && 'Borrador recuperado'}
          {draft.status === 'error' && 'No se ha podido guardar el borrador en este dispositivo'}
        </div>
      )}

      <form onBlurCapture={draft.saveNow} onSubmit={submit}>
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
