import { describe, expect, test } from 'vitest'
import { matchParticipationWindow } from './matchParticipation'

describe('matchParticipationWindow', () => {
  test.each(['2026-10-16', '2026-10-17', '2026-10-18'])('agrupa %s en el viernes', (date) => {
    expect(matchParticipationWindow(date)).toBe('2026-10-16')
  })
  test('conserva cada día entre semana y distingue semanas', () => {
    expect(matchParticipationWindow('2026-10-15')).toBe('2026-10-15')
    expect(matchParticipationWindow('2026-10-19')).toBe('2026-10-19')
    expect(matchParticipationWindow('2026-10-24')).toBe('2026-10-23')
  })
  test('funciona al cambiar de mes, año y horario de verano', () => {
    expect(matchParticipationWindow('2027-01-03')).toBe('2027-01-01')
    expect(matchParticipationWindow('2026-11-01')).toBe('2026-10-30')
    expect(matchParticipationWindow('2026-10-25')).toBe('2026-10-23')
  })
})
