import { useState } from 'react'
import type { FormEvent } from 'react'
import { errorText } from '../../lib/errors'
import type { Season, SeasonValues } from '../../types'

export function SeasonForm({ season, onCancel, onDelete, onSubmit }: {
  season?: Season
  onCancel: () => void
  onDelete?: (season: Season) => Promise<boolean>
  onSubmit: (values: SeasonValues) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setFormError('')
    try {
      const values = {
        name: String(form.get('name')),
        start_date: String(form.get('startDate')),
        end_date: String(form.get('endDate')),
      }
      if (values.end_date < values.start_date) throw new Error('La fecha de finalización no puede ser anterior a la de inicio.')
      await onSubmit(values)
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  async function remove() {
    if (!season || !onDelete) return
    setSaving(true)
    setFormError('')
    try {
      const deleted = await onDelete(season)
      if (!deleted) setSaving(false)
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  return (
    <form className="panel-form" onSubmit={submit}>
      <div className="panel-form-heading">
        <div><span className="eyebrow">{season ? 'EDITAR PERIODO' : 'NUEVO PERIODO'}</span><h2>{season ? 'Editar temporada' : 'Crear temporada'}</h2></div>
        <button aria-label="Cerrar" className="icon-button" onClick={onCancel} type="button">×</button>
      </div>
      <div className="form-grid">
        <label className="full-field">Nombre<input defaultValue={season?.name} name="name" placeholder="Ej. Temporada 2026–2027" required /></label>
        <label>Fecha de inicio<input defaultValue={season?.start_date} name="startDate" required type="date" /></label>
        <label>Fecha de finalización<input defaultValue={season?.end_date} name="endDate" required type="date" /></label>
        <p className="season-state-help full-field">El estado se calcula automáticamente con estas fechas: próxima, activa o finalizada.</p>
      </div>
      {formError && <p className="form-error">{formError}</p>}
      <div className="form-actions">
        {season && onDelete && <button className="danger-button task-form-delete" disabled={saving} onClick={() => void remove()} type="button">Eliminar temporada</button>}
        <button className="secondary-button" onClick={onCancel} type="button">Cancelar</button>
        <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : season ? 'Guardar cambios' : 'Crear temporada'}</button>
      </div>
    </form>
  )
}
