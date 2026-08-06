import { useState } from 'react'
import type { FormEvent } from 'react'
import { TRAINING_TYPES } from '../../constants/training'
import { todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import type { Season, TaskStatus, TaskValues } from '../../types'

export function TaskForm({ seasons, onCancel, onCreate }: {
  seasons: Season[]
  onCancel: () => void
  onCreate: (values: TaskValues) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setFormError('')
    try {
      await onCreate({
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

  return (
    <form className="panel-form" onSubmit={submit}>
      <div className="panel-form-heading">
        <div><span className="eyebrow">NUEVO ENTRENAMIENTO</span><h2>Crear tarea</h2></div>
        <button aria-label="Cerrar" className="icon-button" onClick={onCancel} type="button">×</button>
      </div>
      <div className="form-grid">
        <label>Título<input name="title" required placeholder="Ej. Rodaje suave" /></label>
        <label>
          Temporada
          <select name="seasonId" required defaultValue="">
            <option disabled value="">Seleccionar…</option>
            {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
          </select>
        </label>
        <label>Fecha de la semana<input defaultValue={todayIso()} name="date" required type="date" /><small>Se guardará el lunes de esa semana.</small></label>
        <label>Tipo<select name="trainingType">{TRAINING_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="full-field">Descripción<textarea name="description" rows={3} placeholder="Indicaciones, distancia, repeticiones…" /></label>
        <label>Estado<select name="status" defaultValue="published"><option value="published">Publicar ahora</option><option value="draft">Guardar borrador</option></select></label>
      </div>
      {formError && <p className="form-error">{formError}</p>}
      <div className="form-actions">
        <button className="secondary-button" onClick={onCancel} type="button">Cancelar</button>
        <button className="primary-button" disabled={saving || !seasons.length}>{saving ? 'Guardando…' : 'Crear tarea'}</button>
      </div>
    </form>
  )
}
