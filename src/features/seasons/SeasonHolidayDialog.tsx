import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { formatDate, monthStart, offsetMonth, toIsoDate } from '../../lib/dates'
import type { Season } from '../../types'

export function SeasonHolidayDialog({ season, holidays, onClose, onSave }: { season: Season; holidays: string[]; onClose: () => void; onSave: (dates: string[]) => Promise<void> }) {
  const [month, setMonth] = useState(monthStart(season.start_date))
  const [selected, setSelected] = useState(() => new Set(holidays))
  const [saving, setSaving] = useState(false)
  const days = calendarDays(month)
  const toggle = (date: string) => setSelected((current) => { const next = new Set(current); if (next.has(date)) next.delete(date); else next.add(date); return next })
  return <Modal className="season-holiday-dialog" disabled={saving} labelledBy="season-holidays-title" onClose={onClose}>
    <div className="panel-form-heading"><div><span className="eyebrow">TEMPORADA</span><h2 id="season-holidays-title">Festivos · {season.name}</h2></div><button aria-label="Cerrar festivos" className="icon-button" onClick={onClose} type="button">×</button></div>
    <p className="season-holiday-help">Toca un día para marcarlo o desmarcarlo como festivo.</p>
    <div className="calendar-toolbar"><button aria-label="Mes anterior" disabled={month <= monthStart(season.start_date)} onClick={() => setMonth(offsetMonth(month, -1))} type="button">‹</button><div><h2>{formatDate(month, { month: 'long', year: 'numeric' })}</h2></div><button aria-label="Mes siguiente" disabled={month >= monthStart(season.end_date)} onClick={() => setMonth(offsetMonth(month, 1))} type="button">›</button></div>
    <div className="calendar-weekdays" aria-hidden="true">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
    <div className="season-holiday-calendar">{days.map((date, index) => !date ? <span key={`empty-${index}`} /> : <button aria-pressed={selected.has(date)} className={date < season.start_date || date > season.end_date ? 'disabled-day' : selected.has(date) ? 'holiday' : ''} disabled={date < season.start_date || date > season.end_date} key={date} onClick={() => toggle(date)} type="button">{Number(date.slice(-2))}</button>)}</div>
    <div className="form-actions"><button className="secondary-button" onClick={onClose} type="button">Cancelar</button><button className="primary-button" disabled={saving} onClick={async () => { setSaving(true); try { await onSave([...selected].sort()); onClose() } finally { setSaving(false) } }} type="button">{saving ? 'Guardando…' : 'Guardar festivos'}</button></div>
  </Modal>
}

function calendarDays(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstDay = new Date(year, monthNumber - 1, 1, 12)
  const offset = (firstDay.getDay() + 6) % 7
  const totalDays = new Date(year, monthNumber, 0, 12).getDate()
  return [...Array.from<null>({ length: offset }).fill(null), ...Array.from({ length: totalDays }, (_, index) => toIsoDate(new Date(year, monthNumber - 1, index + 1, 12)))]
}
