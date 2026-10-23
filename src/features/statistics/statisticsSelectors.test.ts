import { afterEach, expect, test, vi } from 'vitest'
import { makeAttendance, makeProvisionalAttendance, makeSession } from '../../test/fixtures'
import { monthlyAttendanceSummary } from './statisticsSelectors'

afterEach(() => vi.useRealTimers())
test('las sesiones futuras no alteran los totales ni el porcentaje, incluso si llegan desde caché', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-23T20:00:00+02:00'))
  const sessions = [makeSession({ id: 'past', session_date: '2026-10-22' }), makeSession({ id: 'future', session_date: '2026-10-30' })]
  const attendance = [makeAttendance({ session_id: 'past', attended: false }), makeAttendance({ session_id: 'future', attended: true })]
  expect(monthlyAttendanceSummary(sessions, attendance, [makeProvisionalAttendance({ session_id: 'future' })], new Set(['player-1']))).toEqual({ average: 0, maximum: 0, minimum: 0, percentage: 0 })
  expect(monthlyAttendanceSummary([sessions[1]], [attendance[1]], [], new Set(['player-1']))).toEqual({ average: null, maximum: null, minimum: null, percentage: null })
})
