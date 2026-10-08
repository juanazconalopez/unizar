import { describe, expect, test } from 'vitest'
import { makePlayerAbsence } from '../../test/fixtures'
import { getCurrentPlayerAbsence } from './playerAbsenceStatus'

describe('getCurrentPlayerAbsence', () => {
  test('uses inclusive start and end dates and ignores other players', () => {
    const absence = makePlayerAbsence({ starts_on: '2026-09-20', ends_on: '2026-09-27' })
    const other = makePlayerAbsence({ id: 'other', player_id: 'player-2', starts_on: '2026-09-01' })
    const absences = [other, absence]

    expect(getCurrentPlayerAbsence(absences, 'player-1', '2026-09-19')).toBeUndefined()
    expect(getCurrentPlayerAbsence(absences, 'player-1', '2026-09-20')).toBe(absence)
    expect(getCurrentPlayerAbsence(absences, 'player-1', '2026-09-27')).toBe(absence)
    expect(getCurrentPlayerAbsence(absences, 'player-1', '2026-09-28')).toBeUndefined()
  })

  test('keeps an absence without an end date active', () => {
    const absence = makePlayerAbsence()
    expect(getCurrentPlayerAbsence([absence], 'player-1', '2027-01-01')).toBe(absence)
  })

  test('makes the player available on the discharge date while preserving the expected end', () => {
    const absence = makePlayerAbsence({ starts_on: '2026-09-20', ends_on: '2026-09-30', discharged_on: '2026-09-24' })
    expect(getCurrentPlayerAbsence([absence], 'player-1', '2026-09-23')).toBe(absence)
    expect(getCurrentPlayerAbsence([absence], 'player-1', '2026-09-24')).toBeUndefined()
  })
})
