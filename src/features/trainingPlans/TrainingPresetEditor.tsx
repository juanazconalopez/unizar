import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { errorText } from '../../lib/errors'
import { EMPTY_TACTICS_BOARD } from '../../services/trainingPlansService'
import type { TrainingExercisePreset, TrainingExerciseValues } from '../../types'
import { TacticsBoard } from './TacticsBoard'
import { exerciseValuesFromPreset } from './trainingPlanMappers'

export function TrainingPresetEditor({ preset, onBack, onSave, onDelete }: {
  preset?: TrainingExercisePreset; onBack: () => void
  onSave: (values: TrainingExerciseValues) => Promise<void>; onDelete?: () => Promise<void>
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
        <label>Título<input autoFocus onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))} required value={values.title} /></label>
        <label>Duración (min)<input max="240" min="1" onChange={(event) => setValues((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} required type="number" value={values.durationMinutes} /></label>
        <label className="full-field">Descripción<textarea onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} placeholder="Explica la organización y el desarrollo del ejercicio…" rows={5} value={values.description} /></label>
      </div></section>
      <section className="training-editor-section"><div className="training-section-heading"><span>2</span><div><h2>Pizarra táctica</h2><p>{hasDiagram ? 'El ejercicio tiene un esquema preparado.' : 'Añade un esquema si ayuda a entender la organización.'}</p></div>{hasDiagram && <div className="training-schema-indicator"><Icon name="strategy" size={16} />Con esquema</div>}</div>
        <button className={hasDiagram ? 'training-board-button populated training-preset-board-button' : 'training-board-button training-preset-board-button'} onClick={() => setBoardOpen(true)} type="button">{hasDiagram && <span className="training-board-preview"><i /><i /><i /></span>}<span><strong>{hasDiagram ? 'Editar esquema táctico' : 'Crear esquema táctico'}</strong><small>Campo, jugadoras, rivales, conos, balones, flechas y zonas.</small></span><Icon name="arrow" /></button>
      </section>
      {formError && <p className="form-error training-form-error">{formError}</p>}
      <div className="training-editor-actions">{preset && onDelete && <button className="danger-button" disabled={busy} onClick={() => void remove()} type="button">Eliminar ejercicio</button>}<button className="secondary-button" disabled={busy} onClick={onBack} type="button">Cancelar</button><button className="primary-button" disabled={busy}>{busy ? 'Guardando…' : preset ? 'Guardar cambios' : 'Crear ejercicio'}</button></div>
    </form>
    {boardOpen && <TacticsBoard exerciseTitle={values.title} initialData={values.diagramData} onCancel={() => setBoardOpen(false)} onSave={(diagramData) => { setValues((current) => ({ ...current, diagramData })); setBoardOpen(false) }} />}
  </div>
}
