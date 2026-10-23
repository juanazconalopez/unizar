import { addDays, formatDate } from './dates'
import type { Season, TrainingGenerationDay, TrainingPlanCalendarItem } from '../types'

export function madridDateTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === name)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`
}

export function trainingResponseClosed(plan: TrainingPlanCalendarItem, now = new Date()) {
  const end = plan.end_time ?? '21:30:00'
  const endTime = end.length === 5 ? `${end}:00` : end.slice(0, 8)
  return plan.status === 'cancelled' || Boolean(plan.responses_closed || plan.attendance_recorded)
    || madridDateTime(now) >= `${plan.session_date}T${endTime}`
}

export function trainingGenerationPreview(season: Season, existing: TrainingPlanCalendarItem[], holidays: string[], now = new Date()): TrainingGenerationDay[] {
  const today = madridDateTime(now).slice(0, 10)
  const days: TrainingGenerationDay[] = []
  for (let date = today; date <= season.end_date; date = addDays(date, 1)) {
    if (![2, 4, 5].includes(new Date(`${date}T12:00:00`).getDay())) continue
    const plan = existing.find((item) => item.session_date === date)
    days.push({ session_date: date, title: plan?.title ?? `Entrenamiento ${formatDate(date, { weekday: 'long' })} ${Number(date.slice(8))} ${formatDate(date, { month: 'short' }).replace('.', '')}`,
      result: plan ? 'existing' : holidays.includes(date) ? 'holiday' : madridDateTime(now) >= `${date}T19:30:00` ? 'past' : 'new' })
  }
  return days
}

export function isFridayTrainingDate(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 5
}
