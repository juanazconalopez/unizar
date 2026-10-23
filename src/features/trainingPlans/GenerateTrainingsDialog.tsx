import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { formatDate } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import type { TrainingGenerationDay } from '../../types'

const labels: Record<string, string> = { new: 'Se creará', created: 'Creado', existing: 'Ya existe', holiday: 'Festivo', past: 'Horario pasado', recorded: 'Asistencia registrada' }
export function GenerateTrainingsDialog({ onGenerate, onDone, onClose }: {
  onGenerate: (apply: boolean) => Promise<TrainingGenerationDay[]>
  onDone: (days: TrainingGenerationDay[]) => Promise<void>
  onClose: () => void
}) {
  const [days, setDays] = useState<TrainingGenerationDay[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let current = true
    void onGenerate(false).then((data) => { if (current) setDays(data) }).catch((cause) => { if (current) setError(errorText(cause)) }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [onGenerate])
  async function generate() {
    setSaving(true); setError('')
    try { const result = await onGenerate(true); await onDone(result) } catch (cause) { setError(errorText(cause)); setSaving(false) }
  }
  const count = days.filter((day) => day.result === 'new').length
  return <Modal labelledBy="generate-trainings-title" disabled={saving} onClose={onClose}>
    <h2 id="generate-trainings-title">Generar entrenamientos</h2>
    <p>Martes, jueves y viernes de 19:30 a 21:30, desde hoy hasta el final de la temporada activa. Se crearán como borradores.</p>
    <p>Se respetan los entrenamientos existentes y los festivos guardados en Ajustes → Temporadas. Revisa allí también los cierres del campo.</p>
    {loading ? <p role="status">Preparando vista previa…</p> : <>
      <p><strong>{count} nuevos</strong> · {days.filter((day) => day.result === 'existing').length} existentes · {days.filter((day) => day.result === 'holiday').length} festivos</p>
      <div className="training-generation-preview"><ul>{days.map((day) => <li key={day.session_date}><time dateTime={day.session_date}>{formatDate(day.session_date, { weekday: 'short', day: 'numeric', month: 'short' })}</time><span>{labels[day.result] ?? day.result}</span></li>)}</ul></div>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button className="secondary-button" disabled={saving} onClick={onClose} type="button">Cancelar</button><button className="primary-button" disabled={loading || saving || !count || Boolean(error)} onClick={() => void generate()} type="button">{saving ? 'Generando…' : `Generar ${count} ${count === 1 ? 'entrenamiento' : 'entrenamientos'}`}</button></div>
  </Modal>
}
