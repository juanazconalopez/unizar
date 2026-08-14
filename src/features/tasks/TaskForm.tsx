import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { SeasonContextField } from '../../components/SeasonContextField'
import { Modal } from '../../components/ui/Modal'
import { TRAINING_TYPES } from '../../constants/training'
import { todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import { seasonForDate } from '../../lib/selectors'
import type { Season, TaskStatus, TaskValues, TrainingTask } from '../../types'

export function TaskForm({ seasons, initialDate = todayIso(), task, template, onCancel, onDelete, onSubmit }: {
  seasons: Season[]
  initialDate?: string
  task?: TrainingTask
  template?: TrainingTask
  onCancel: () => void
  onDelete?: (task: TrainingTask) => Promise<void>
  onSubmit: (values: TaskValues) => Promise<void>
}) {
  const titleId = useId()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formError, setFormError] = useState('')
  const [dirty, setDirty] = useState(false)
  const busy = saving || deleting
  const source = task ?? template
  const selectedSeason = task
    ? seasons.find((season) => season.id === task.season_id)
    : seasonForDate(seasons, todayIso())
  const trainingTypes: readonly string[] = source?.training_type && !TRAINING_TYPES.some((type) => type === source.training_type)
    ? [source.training_type, ...TRAINING_TYPES]
    : TRAINING_TYPES

  function requestCancel() {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Quieres cerrar el formulario?')) return
    onCancel()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setFormError('')
    try {
      await onSubmit({
        seasonId: String(form.get('seasonId')),
        date: task?.week_start ?? String(form.get('date')),
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

  async function deleteTask() {
    if (!task || !onDelete) return
    if (!window.confirm(`¿Eliminar "${task.title}"? También se eliminarán definitivamente todas las respuestas enviadas.`)) return
    setDeleting(true)
    setFormError('')
    try {
      await onDelete(task)
    } catch (error) {
      setFormError(errorText(error))
      setDeleting(false)
    }
  }

  return (
      <Modal className="panel-form task-form-dialog" disabled={busy} labelledBy={titleId} onClose={requestCancel} onFormChange={() => setDirty(true)} onSubmit={submit}>
        <div className="panel-form-heading">
          <div><span className="eyebrow">{task ? 'EDITAR ENTRENAMIENTO' : template ? 'COPIAR ENTRENAMIENTO' : 'NUEVO ENTRENAMIENTO'}</span><h2 id={titleId}>{task ? 'Editar tarea' : template ? 'Copiar tarea' : 'Crear tarea'}</h2></div>
          <button aria-label="Cerrar" className="icon-button" disabled={busy} onClick={requestCancel} type="button">×</button>
        </div>
        <div className="form-grid">
          <label>Título<input autoFocus defaultValue={source?.title} name="title" required placeholder="Ej. Rodaje suave" /></label>
          <SeasonContextField creation={!task} season={selectedSeason} />
          {!task && <label>Fecha de la semana<input aria-label="Fecha de la semana" defaultValue={initialDate} name="date" required type="date" /><small>Se guardará el lunes de esa semana.</small></label>}
          <label>Tipo<select defaultValue={source?.training_type ?? TRAINING_TYPES[0]} name="trainingType">{trainingTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="full-field task-form-description">Descripción<textarea defaultValue={source?.description ?? ''} name="description" rows={7} placeholder="Indicaciones, distancia, repeticiones…" /></label>
          <label>Estado<select name="status" defaultValue={task?.status ?? 'draft'}><option value="published">Publicada</option><option value="draft">Borrador</option>{task && <option value="cancelled">Anulada</option>}</select></label>
        </div>
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-actions">
          {task && onDelete && <button className="danger-button task-form-delete" disabled={busy} onClick={() => void deleteTask()} type="button">{deleting ? 'Eliminando…' : 'Eliminar tarea'}</button>}
          <button className="secondary-button" disabled={busy} onClick={requestCancel} type="button">Cancelar</button>
          <button className="primary-button" disabled={busy || !selectedSeason}>{saving ? 'Guardando…' : task ? 'Guardar cambios' : template ? 'Copiar tarea' : 'Crear tarea'}</button>
        </div>
      </Modal>
  )
}
