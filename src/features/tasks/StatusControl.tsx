import type { TaskStatus } from '../../types'

export function StatusControl({ status, onChange }: { status: TaskStatus; onChange: (status: TaskStatus) => void | Promise<void> }) {
  return (
    <select aria-label="Estado" className={`status-select ${status}`} onChange={(event) => void onChange(event.target.value as TaskStatus)} value={status}>
      <option value="draft">Borrador</option>
      <option value="published">Publicada</option>
      <option value="cancelled">Anulada</option>
    </select>
  )
}
