import { useState } from 'react'
import { ContentImageTextarea } from '../../components/ContentImageTextarea'
import { errorText } from '../../lib/errors'
import { EMPTY_TACTICS_BOARD } from '../../services/trainingPlansService'
import type { TrainingExercisePreset, TrainingExerciseValues } from '../../types'
import { exerciseValuesFromPreset } from './trainingPlanMappers'

export function TrainingPresetEditor({ preset, onBack, onSave, onDelete }: {
  preset?: TrainingExercisePreset; onBack: () => void
  onSave: (values: TrainingExerciseValues) => Promise<void>; onDelete?: () => Promise<void>
}) {
  const [values, setValues] = useState<TrainingExerciseValues>(() => preset ? exerciseValuesFromPreset(preset) : {
    title: '', description: '', durationMinutes: 10, diagramData: structuredClone(EMPTY_TACTICS_BOARD),
  })
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!values.title.trim()) { setFormError('Escribe un título para el ejercicio.'); return }
    setBusy(true); setFormError('')
    try { await onSave(values) } catch (error) { setFormError(errorText(error)); setBusy(false) }
  }

  async function remove() {
    if (!onDelete || !window.confirm(`¿Eliminar el ejercicio predefinido “${preset?.title}”?`)) return
    setBusy(true); setFormError('')
    try { await onDelete() } catch (error) { setFormError(errorText(error)); setBusy(false) }
  }

  return <div className="page training-preset-editor-page">
    <button className="text-button training-detail-back" onClick={onBack} type="button">← Volver a la biblioteca</button>
    <div className="training-editor-heading"><div><span className="eyebrow">{preset ? 'EDITAR EJERCICIO PREDEFINIDO' : 'NUEVO EJERCICIO PREDEFINIDO'}</span><h1>{preset?.title || 'Crear ejercicio'}</h1></div><div className="training-duration"><strong>{values.durationMinutes}</strong><span>minutos<br />de ejercicio</span></div></div>
    <form onSubmit={submit}>
      <section className="training-editor-section"><div className="training-section-heading"><span>1</span><div><h2>Datos del ejercicio</h2><p>Define una versión reutilizable para futuros entrenamientos.</p></div></div><div className="training-exercise-fields training-preset-fields">
        <label>Título<input autoFocus onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))} required spellCheck value={values.title} /></label>
        <label>Duración (min)<input max="240" min="1" onChange={(event) => setValues((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} required type="number" value={values.durationMinutes} /></label>
        <ContentImageTextarea className="full-field" label="Descripción" onChange={(description) => setValues((current) => ({ ...current, description }))} placeholder="Explica el ejercicio y pega imágenes con los esquemas…" rows={5} value={values.description} />
      </div></section>
      {formError && <p className="form-error training-form-error">{formError}</p>}
      <div className="training-editor-actions">{preset && onDelete && <button className="danger-button" disabled={busy} onClick={() => void remove()} type="button">Eliminar ejercicio</button>}<button className="secondary-button" disabled={busy} onClick={onBack} type="button">Cancelar</button><button className="primary-button" disabled={busy}>{busy ? 'Guardando…' : preset ? 'Guardar cambios' : 'Crear ejercicio'}</button></div>
    </form>
  </div>
}
