import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { TRAINING_TYPES } from '../../constants/training'
import { todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import type { Season, TaskStatus, TaskValues, TrainingTask } from '../../types'

export function TaskForm({ seasons, initialDate = todayIso(), task, onCancel, onSubmit }: {
  seasons: Season[]
  initialDate?: string
  task?: TrainingTask
  onCancel: () => void
  onSubmit: (values: TaskValues) => Promise<void>
}) {
  const titleId = useId()
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onCancel, saving])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setFormError('')
    try {
      await onSubmit({
        seasonId: String(form.get('seasonId')),
        date: String(form.get('date')),
        title: String(form.get('title')),
        description: String(form.get('description')),
        trainingType: String(form.get('trainingType')),
        status: String(form.get('status')) as TaskStatus,
      })
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  return createPortal(
    <div className="task-detail-backdrop" onClick={() => { if (!saving) onCancel() }}>
      <form
        aria-labelledby={titleId}
        aria-modal="true"
        className="panel-form task-form-dialog"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
        role="dialog"
      >
        <div className="panel-form-heading">
          <div><span className="eyebrow">{task ? 'EDITAR ENTRENAMIENTO' : 'NUEVO ENTRENAMIENTO'}</span><h2 id={titleId}>{task ? 'Editar tarea' : 'Crear tarea'}</h2></div>
          <button aria-label="Cerrar" className="icon-button" disabled={saving} onClick={onCancel} type="button">×</button>
        </div>
        <div className="form-grid">
          <label>Título<input autoFocus defaultValue={task?.title} name="title" required placeholder="Ej. Rodaje suave" /></label>
          <label>
            Temporada
            <select name="seasonId" required defaultValue={task?.season_id ?? ''}>
              <option disabled value="">Seleccionar…</option>
              {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
            </select>
          </label>
          <label>Fecha de la semana<input aria-label="Fecha de la semana" defaultValue={task?.week_start ?? initialDate} name="date" required type="date" /><small>Se guardará el lunes de esa semana.</small></label>
          <label>Tipo<select defaultValue={task?.training_type ?? TRAINING_TYPES[0]} name="trainingType">{TRAINING_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="full-field task-form-description">Descripción<textarea defaultValue={task?.description ?? ''} name="description" rows={7} placeholder="Indicaciones, distancia, repeticiones…" /></label>
          <label>Estado<select name="status" defaultValue={task?.status ?? 'published'}><option value="published">Publicada</option><option value="draft">Borrador</option>{task && <option value="cancelled">Anulada</option>}</select></label>
        </div>
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-actions">
          <button className="secondary-button" disabled={saving} onClick={onCancel} type="button">Cancelar</button>
          <button className="primary-button" disabled={saving || !seasons.length}>{saving ? 'Guardando…' : task ? 'Guardar cambios' : 'Crear tarea'}</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
