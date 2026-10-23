import { describe, expect, test } from 'vitest'
import { makeAttendance, makeMembership, makeProfile, makeSeason, makeSession } from '../../test/fixtures'
import { demoPlanFromValues } from './trainingPlanMappers'
import { finalizeDemoSelfManagedAttendance as finalize } from './demoSelfManagedAttendance'

const plan = demoPlanFromValues({ seasonId: 'season-1', sessionDate: '2026-10-23', title: 'Viernes', objectives: '', material: '', status: 'draft', exercises: [] }, [makeSeason()])
const now = new Date('2026-10-23T21:30:00+02:00')
const profiles = [makeProfile(), ...['rejected', 'missing', 'stale', 'unlinked', 'inactive', 'future-member'].map((id) => makeProfile({ id, is_active: id !== 'inactive' }))]
const memberships = profiles.filter((p) => p.id !== 'unlinked').map((p) => makeMembership({ id: p.id, player_id: p.id, active_from: p.id === 'future-member' ? '2026-10-24' : '2026-01-01' }))
const responses = {
  [`${plan.id}:player-1`]: { attending: true, version: 1 },
  [`${plan.id}:rejected`]: { attending: false, version: 1 },
  [`${plan.id}:stale`]: { attending: true, version: 0 },
}

describe('viernes autogestionados en la demo', () => {
  test('no genera asistencia antes de terminar aunque todas hayan confirmado entrenamientos futuros', () => {
    const sessions = [makeSession({ session_date: '2026-10-22' })]
    const attendance = [makeAttendance()]
    const result = finalize([plan], profiles, memberships, responses, sessions, attendance, [], new Date('2026-10-23T21:29:59+02:00'))
    expect(result.sessions).toBe(sessions)
    expect(result.attendance).toBe(attendance)
  })
  test('al finalizar guarda presencia, rechazo y ausencia por no responder o respuesta invalidada; respeta las vinculaciones', () => {
    const result = finalize([plan], profiles, memberships, responses, [], [], [], now)
    expect(result.sessions).toEqual([expect.objectContaining({ self_managed: true, training_plan_id: plan.id, session_date: plan.session_date })])
    expect(result.attendance.map((r) => [r.player_id, r.attended])).toEqual([['player-1', true], ['rejected', false], ['missing', false], ['stale', false]])
    const again = finalize([plan], profiles, memberships, {}, result.sessions, result.attendance, [], now)
    expect(again.sessions).toBe(result.sessions)
    expect(again.attendance).toBe(result.attendance)
  })
  test('respeta festivos, cancelaciones, martes/jueves y registros históricos existentes', () => {
    expect(finalize([plan], profiles, memberships, responses, [], [], [plan.session_date], now).sessions).toEqual([])
    for (const altered of [{ ...plan, status: 'cancelled' as const }, { ...plan, self_managed: false }, { ...plan, session_date: '2026-10-22' }]) {
      expect(finalize([altered], profiles, memberships, responses, [], [], [], now).sessions).toEqual([])
    }
    const existing = makeSession({ session_date: plan.session_date })
    const actual = [makeAttendance({ attended: false })]
    expect(finalize([plan], profiles, memberships, responses, [existing], actual, [], now).attendance).toBe(actual)
  })
  test('mover un entrenamiento a viernes activa la autogestión; editar el título conserva el histórico manual', () => {
    const historic = { ...plan, self_managed: false }
    const values = { seasonId: 'season-1', sessionDate: plan.session_date, title: 'Nuevo título', objectives: '', material: '', status: 'draft' as const, exercises: [] }
    expect(demoPlanFromValues(values, [makeSeason()], historic).self_managed).toBe(false)
    expect(demoPlanFromValues({ ...values, sessionDate: '2026-10-30' }, [makeSeason()], historic).self_managed).toBe(true)
  })
})
