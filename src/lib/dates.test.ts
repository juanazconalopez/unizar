import { afterEach, describe, expect, test, vi } from 'vitest'
import { addDays, ageOnDate, mondayFor, monthEnd, monthStart, offsetMonth, seasonState, toIsoDate, todayIso } from './dates'

afterEach(() => vi.useRealTimers())

describe('date helpers', () => {
  test('builds month windows across year and leap-year boundaries', () => {
    expect(monthStart('2026-08-19')).toBe('2026-08-01')
    expect(monthEnd('2024-02-10')).toBe('2024-02-29')
    expect(offsetMonth('2026-01-15', -1)).toBe('2025-12-01')
  })

  test('calculates Monday without mutating the supplied Date', () => {
    const date = new Date('2026-08-09T12:00:00')

    expect(mondayFor(date)).toBe('2026-08-03')
    expect(toIsoDate(date)).toBe('2026-08-09')
  })

  test('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  test('calculates age according to whether the birthday has passed', () => {
    expect(ageOnDate('2000-08-30', '2026-08-31')).toBe(26)
    expect(ageOnDate('2000-09-01', '2026-08-31')).toBe(25)
    expect(ageOnDate('2030-01-01', '2026-08-31')).toBeNull()
    expect(ageOnDate('fecha inválida', '2026-08-31')).toBeNull()
  })

  test('uses the current day to classify seasons', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))

    expect(todayIso()).toBe('2026-08-05')
    expect(seasonState({ start_date: '2026-01-01', end_date: '2026-12-31' })).toBe('Activa')
    expect(seasonState({ start_date: '2026-09-01', end_date: '2027-06-30' })).toBe('Próxima')
    expect(seasonState({ start_date: '2025-01-01', end_date: '2025-12-31' })).toBe('Finalizada')
  })
})
