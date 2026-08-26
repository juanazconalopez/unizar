import { useId, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { FatigueIcon } from '../../components/ui/FatigueIcon'
import { Modal } from '../../components/ui/Modal'
import { FATIGUE_LEVELS } from '../../constants/training'
import { addDays, formatDate, formatWeek, todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import type { ResultValues, TaskResult, TrainingTask } from '../../types'

export function TaskCard({ task, result, onSave, managerActions, managementSummary, hideWeek = false }: {
  task: TrainingTask
  result?: TaskResult
  onSave?: (task: TrainingTask, values: ResultValues) => Promise<void>
  managerActions?: ReactNode
  managementSummary?: ReactNode
  hideWeek?: boolean
}) {
  const detailTitleId = useId()
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
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
      {!open && (
        <button
          aria-label={`Ver detalle de ${task.title}`}
          className="task-card-detail-link"
          onClick={() => setDetailOpen(true)}
          type="button"
        />
      )}
      <div className="task-status-icon">{result ? <Icon name="check" /> : <Icon name="clock" />}</div>
      <div className="task-main">
        <div className="task-meta">
          <span>{task.training_type || 'Entrenamiento'}</span><span>·</span><span>{task.seasons?.name}</span>
        </div>
        <h3>{task.title}</h3>
        {task.description && <p className="task-card-description"><LinkedText text={task.description} /></p>}
        {managementSummary}
        {(!hideWeek || result) && <div className="task-footer">
          {!hideWeek && <span>{formatWeek(task.week_start)}</span>}
          {result && (
            <span className="result-summary">
              {formatDate(result.performed_on, { weekday: 'long', day: 'numeric', month: 'short' })}
              {' · '}<FatigueIcon level={result.fatigue_level} size={16} /> {resultFatigue?.label}
            </span>
          )}
        </div>}
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
                    <input aria-label={item.label} defaultChecked={(result?.fatigue_level ?? 3) === item.value} name="fatigueLevel" type="radio" value={item.value} />
                    <span><FatigueIcon level={item.value} /><small>{item.label}</small></span>
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
        {onSave && task.status === 'published' && !open && (
          <button className={result ? 'secondary-button compact' : 'primary-button compact'} onClick={() => setOpen((value) => !value)}>
            {result ? 'Editar resultado' : 'Completar'}
          </button>
        )}
      </div>
      {detailOpen && <Modal labelledBy={detailTitleId} onClose={() => setDetailOpen(false)}>
            <div className="task-detail-heading">
              <div>
                <span className="eyebrow">{task.training_type || 'ENTRENAMIENTO'} · {task.seasons?.name}</span>
                <h2 id={detailTitleId}>{task.title}</h2>
              </div>
              <button aria-label="Cerrar detalle" className="icon-button" onClick={() => setDetailOpen(false)} type="button">×</button>
            </div>
            <div className="task-detail-week"><Icon name="calendar" size={17} /><span>{formatWeek(task.week_start)}</span></div>
            <div className="task-detail-description">
              <span className="eyebrow">INDICACIONES</span>
              <p>{task.description ? <LinkedText text={task.description} /> : 'Esta tarea no tiene indicaciones adicionales.'}</p>
            </div>
      </Modal>}
    </article>
  )
}

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<]+/gi
const TRAILING_URL_PUNCTUATION = /[),.;!?]$/

function LinkedText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const matchIndex = match.index ?? 0
    let label = match[0]
    let trailing = ''
    while (TRAILING_URL_PUNCTUATION.test(label)) {
      trailing = label.slice(-1) + trailing
      label = label.slice(0, -1)
    }
    parts.push(text.slice(lastIndex, matchIndex))
    parts.push(
      <a className="task-description-link" href={label.startsWith('www.') ? `https://${label}` : label} key={`${matchIndex}-${label}`} rel="noopener noreferrer" target="_blank">
        {label}
      </a>,
    )
    if (trailing) parts.push(trailing)
    lastIndex = matchIndex + match[0].length
  }

  parts.push(text.slice(lastIndex))
  return <>{parts}</>
}
