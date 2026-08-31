const dateFromIso = (value: string) => new Date(`${value}T12:00:00`)

export function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayIso() {
  return toIsoDate(new Date())
}

export function ageOnDate(birthDate: string | null | undefined, date: string) {
  if (!birthDate || !isValidIsoDate(birthDate) || !isValidIsoDate(date) || birthDate > date) return null
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number)
  const [year, month, day] = date.split('-').map(Number)
  let age = year - birthYear
  if (month < birthMonth || (month === birthMonth && day < birthDay)) age -= 1
  return age
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return toIsoDate(dateFromIso(value)) === value
}

export function mondayFor(value: string | Date) {
  const date = typeof value === 'string' ? dateFromIso(value) : new Date(value)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return toIsoDate(date)
}

export function addDays(value: string, days: number) {
  const date = dateFromIso(value)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

export function monthStart(value: string) {
  return `${value.slice(0, 7)}-01`
}

export function offsetMonth(value: string, offset: number) {
  const date = dateFromIso(monthStart(value))
  date.setMonth(date.getMonth() + offset)
  return monthStart(toIsoDate(date))
}

export function monthEnd(value: string) {
  return addDays(offsetMonth(value, 1), -1)
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('es-ES', options ?? {
    day: 'numeric',
    month: 'short',
  }).format(dateFromIso(value))
}

export function formatWeek(weekStart: string) {
  return `${formatDate(weekStart)} – ${formatDate(addDays(weekStart, 6), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`
}

export function seasonState(season: { start_date: string; end_date: string }) {
  const today = todayIso()
  if (today < season.start_date) return 'Próxima'
  if (today > season.end_date) return 'Finalizada'
  return 'Activa'
}
