import { formatDate } from '../../lib/dates'

export function SelectedDayHeading({ date }: { date: string }) {
  return <div className="selected-day-primary-heading"><span className="eyebrow">DETALLE DEL DÍA</span><h2>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2></div>
}
