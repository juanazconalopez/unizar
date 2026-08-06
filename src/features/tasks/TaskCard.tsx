import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { FATIGUE_LEVELS } from '../../constants/training'
import { addDays, formatDate, formatWeek, todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import type { ResultValues, TaskResult, TrainingTask } from '../../types'

export function TaskCard({ task, result, onSave, managerActions }: {
  task: TrainingTask
  result?: TaskResult
  onSave?: (task: TrainingTask, values: ResultValues) => Promise<void>
  managerActions?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const resultFatigue = FATIGUE_LEVELS.find((item) => item.value === result?.fatigue_level)
  const defaultPerformedOn = result?.performed_on
    ?? (todayIso() >= task.week_start && todayIso() <= addDays(task.week_start, 6) ? todayIso() : task.week_start)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!onSave) return
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setFormError('')

    try {
      await onSave(task, {
        resultText: String(form.get('resultText')),
        fatigueLevel: Number(form.get('fatigueLevel')),
        performedOn: String(form.get('performedOn')),
      })
      setOpen(false)
    } catch (error) {
      setFormError(errorText(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={result ? 'task-card completed' : 'task-card'}>
      <div className="task-status-icon">{result ? <Icon name="check" /> : <Icon name="clock" />}</div>
      <div className="task-main">
        <div className="task-meta">
          <span>{task.training_type || 'Entrenamiento'}</span><span>·</span><span>{task.seasons?.name}</span>
        </div>
        <h3>{task.title}</h3>
        {task.description && <p>{task.description}</p>}
        <div className="task-footer">
          <span>{formatWeek(task.week_start)}</span>
          {result && (
            <span className="result-summary">
              {formatDate(result.performed_on, { weekday: 'long', day: 'numeric', month: 'short' })}
              {' · '}{resultFatigue?.emoji} {resultFatigue?.label}
            </span>
          )}
        </div>
        {open && onSave && (
          <form className="result-form" onSubmit={submit}>
            <label>
              Resultado del entrenamiento
              <textarea defaultValue={result?.result_text} name="resultText" required rows={3} placeholder="Cuéntanos cómo ha ido…" />
            </label>
            <label>
              Fecha de realización
              <input defaultValue={defaultPerformedOn} max={addDays(task.week_start, 6)} min={task.week_start} name="performedOn" required type="date" />
            </label>
            <fieldset>
              <legend>Nivel de fatiga</legend>
              <div className="fatigue-options">
                {FATIGUE_LEVELS.map((item) => (
                  <label key={item.value}>
                    <input defaultChecked={(result?.fatigue_level ?? 3) === item.value} name="fatigueLevel" type="radio" value={item.value} />
                    <span><b>{item.emoji}</b><small>{item.label}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
            {formError && <p className="form-error">{formError}</p>}
            <div className="form-actions">
              <button className="secondary-button" onClick={() => setOpen(false)} type="button">Cancelar</button>
              <button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : result ? 'Actualizar resultado' : 'Enviar y completar'}</button>
            </div>
          </form>
        )}
      </div>
      <div className="task-actions">
        {managerActions}
        {onSave && task.status === 'published' && (
          <button className={result ? 'secondary-button compact' : 'primary-button compact'} onClick={() => setOpen((value) => !value)}>
            {result ? 'Editar' : 'Completar'}
          </button>
        )}
      </div>
    </article>
  )
}
