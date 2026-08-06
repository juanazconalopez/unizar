import { useState } from 'react'
import type { FormEvent } from 'react'
import { errorText } from '../../lib/errors'
import type { SeasonValues } from '../../types'

export function SeasonForm({ onCancel, onCreate }: {
  onCancel: () => void
  onCreate: (values: SeasonValues) => Promise<void>
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
        name: String(form.get('name')),
        start_date: String(form.get('startDate')),
        end_date: String(form.get('endDate')),
      })
    } catch (error) {
      setFormError(errorText(error))
      setSaving(false)
    }
  }

  return (
    <form className="panel-form" onSubmit={submit}>
      <div className="panel-form-heading">
        <div><span className="eyebrow">NUEVO PERIODO</span><h2>Crear temporada</h2></div>
        <button aria-label="Cerrar" className="icon-button" onClick={onCancel} type="button">×</button>
      </div>
      <div className="form-grid">
        <label className="full-field">Nombre<input name="name" placeholder="Ej. Temporada 2026–2027" required /></label>
        <label>Fecha de inicio<input name="startDate" required type="date" /></label>
        <label>Fecha de finalización<input name="endDate" required type="date" /></label>
      </div>
      {formError && <p className="form-error">{formError}</p>}
      <div className="form-actions">
        <button className="secondary-button" onClick={onCancel} type="button">Cancelar</button>
        <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Crear temporada'}</button>
      </div>
    </form>
  )
}
