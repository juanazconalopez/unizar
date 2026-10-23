import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))
import { fetchCalendarTrainingPlans } from './trainingPlansService'
import { fetchTrainingAttendanceBasis, generateTrainingSchedule, saveTrainingResponse } from './trainingScheduleService'
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: [], error: null }) })
test('el calendario utiliza exclusivamente la RPC de metadatos, sin consultar planes ni ejercicios', async () => {
  await fetchCalendarTrainingPlans('2026-10-01', '2026-10-31')
  expect(mocks.rpc).toHaveBeenCalledWith('get_training_calendar', { from_date: '2026-10-01', until_date: '2026-10-31' })
})
test('la primera petición solo prepara una vista previa y la escritura es explícita', async () => {
  await generateTrainingSchedule()
  expect(mocks.rpc).toHaveBeenLastCalledWith('generate_training_schedule', { apply_changes: false })
  await generateTrainingSchedule(true)
  expect(mocks.rpc).toHaveBeenLastCalledWith('generate_training_schedule', { apply_changes: true })
})
test('envía la versión y no permite elegir otra jugadora', async () => {
  await saveTrainingResponse({ id: 'p', session_date: '2026-10-23', title: 'Sesión', status: 'draft', schedule_version: 3 }, false, 'Trabajo')
  expect(mocks.rpc).toHaveBeenLastCalledWith('save_training_response', { checked_plan_id: 'p', checked_attending: false, checked_comment: 'Trabajo', checked_version: 3 })
})
test('distingue asistencia guardada sin asistentes de un entrenamiento sin registrar', async () => {
  mocks.rpc.mockResolvedValue({ data: { recorded: true, attended_player_ids: [], responses: [{ player_id: 'x', attending: true, comment: '' }] }, error: null })
  expect((await fetchTrainingAttendanceBasis('2026-10-23')).recorded).toBe(true)
})
