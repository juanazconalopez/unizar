import { beforeEach, describe, expect, test, vi } from 'vitest'
import { makeTask } from '../test/fixtures'

const mocks = vi.hoisted(() => ({
  delete: vi.fn(), eq: vi.fn(), from: vi.fn(), insert: vi.fn(), update: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))

import { createTrainingTask, deleteTrainingTask, saveTaskResult, updateTaskStatus, updateTrainingTask } from './tasksService'

describe('tasksService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.eq.mockReturnValue({ eq: mocks.eq, error: null })
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.delete.mockReturnValue({ eq: mocks.eq })
    mocks.insert.mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ delete: mocks.delete, insert: mocks.insert, update: mocks.update })
  })

  test('never moves the week while editing a task', async () => {
    await updateTrainingTask(makeTask().id, {
      seasonId: 'season-2', date: '2030-01-07', title: 'Editada', description: 'Texto', trainingType: 'Físico', status: 'published',
    })
    expect(mocks.update).toHaveBeenCalledWith(expect.not.objectContaining({ week_start: expect.anything() }))
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Editada', season_id: 'season-2' }))
  })

  test('stores new tasks on the Monday of the chosen week', async () => {
    await createTrainingTask({
      seasonId: 'season-1', date: '2026-08-06', title: '  Técnica de pase  ',
      description: '  Trabajo por parejas  ', trainingType: 'Técnico', status: 'draft',
    }, 'owner-1')

    expect(mocks.insert).toHaveBeenCalledWith({
      season_id: 'season-1', week_start: '2026-08-03', title: 'Técnica de pase',
      description: 'Trabajo por parejas', training_type: 'Técnico', status: 'draft', created_by: 'owner-1',
    })
  })

  test('creates and updates only the player result for the requested task', async () => {
    const task = makeTask()
    const values = { resultText: '  Completado  ', fatigueLevel: 4, performedOn: '2026-08-05' }

    await saveTaskResult(task, values, 'player-1', false)
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      task_id: task.id, player_id: 'player-1', result_text: 'Completado', fatigue_level: 4,
    }))

    await saveTaskResult(task, values, 'player-1', true)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ task_id: task.id, player_id: 'player-1' }))
    expect(mocks.eq).toHaveBeenCalledWith('task_id', task.id)
    expect(mocks.eq).toHaveBeenCalledWith('player_id', 'player-1')
  })

  test('updates status and deletes by task id', async () => {
    await updateTaskStatus('task-1', 'cancelled')
    expect(mocks.update).toHaveBeenCalledWith({ status: 'cancelled' })
    expect(mocks.eq).toHaveBeenCalledWith('id', 'task-1')

    await deleteTrainingTask('task-1')
    expect(mocks.delete).toHaveBeenCalledOnce()
    expect(mocks.eq).toHaveBeenCalledWith('id', 'task-1')
  })
})
