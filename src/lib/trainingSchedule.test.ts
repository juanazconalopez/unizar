import { describe, expect, test } from 'vitest'
import { makeSeason } from '../test/fixtures'
import type { TrainingPlanCalendarItem } from '../types'
import { trainingGenerationPreview, trainingResponseClosed } from './trainingSchedule'

const plan: TrainingPlanCalendarItem = { id: 'p', title: 'Entrenamiento', session_date: '2026-10-23', status: 'draft', end_time: '21:30:00' }
describe('agenda de entrenamientos', () => {
  test('cierra a las 21:30 de Madrid, nunca al empezar, también tras el cambio de hora', () => {
    expect(trainingResponseClosed(plan, new Date('2026-10-23T20:00:00+02:00'))).toBe(false)
    expect(trainingResponseClosed(plan, new Date('2026-10-23T21:29:59+02:00'))).toBe(false)
    expect(trainingResponseClosed(plan, new Date('2026-10-23T21:30:00+02:00'))).toBe(true)
    const winter = { ...plan, session_date: '2026-12-01' }
    expect(trainingResponseClosed(winter, new Date('2026-12-01T21:29:59+01:00'))).toBe(false)
    expect(trainingResponseClosed(winter, new Date('2026-12-01T21:30:00+01:00'))).toBe(true)
    expect(trainingResponseClosed({ ...plan, attendance_recorded: true }, new Date('2026-10-23T19:00:00+02:00'))).toBe(true)
  })
  test('respeta los festivos de temporada, los existentes y el cierre navideño', () => {
    const holidays = ['2026-12-08', ...Array.from({ length: 16 }, (_, day) => new Date(Date.UTC(2026, 11, 22 + day)).toISOString().slice(0, 10))]
    const existing = [{ ...plan, session_date: '2026-12-03', status: 'cancelled' as const }]
    const result = trainingGenerationPreview(makeSeason({ end_date: '2027-01-08' }), existing, holidays, new Date('2026-12-01T12:00:00+01:00'))
    expect(result.find((day) => day.session_date === '2026-12-03')?.result).toBe('existing')
    expect(result.find((day) => day.session_date === '2026-12-08')?.result).toBe('holiday')
    expect(result.filter((day) => day.session_date >= '2026-12-22' && day.session_date <= '2027-01-06').every((day) => day.result === 'holiday')).toBe(true)
    expect(result.at(-1)).toMatchObject({ session_date: '2027-01-08', result: 'new', title: 'Entrenamiento viernes 8 ene' })
    expect(result.every((day) => [2, 4, 5].includes(new Date(`${day.session_date}T12:00:00`).getDay()))).toBe(true)
  })
  test('no genera el entrenamiento de hoy si ya ha empezado ni días fuera de temporada', () => {
    const season = makeSeason({ end_date: '2026-10-23' })
    expect(trainingGenerationPreview(season, [], [], new Date('2026-10-23T19:30:00+02:00'))[0]?.result).toBe('past')
    expect(trainingGenerationPreview(season, [], [], new Date('2026-10-24T12:00:00+02:00'))).toEqual([])
  })
})
