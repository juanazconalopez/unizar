import { beforeEach, describe, expect, test, vi } from 'vitest'
import { makeTask } from '../test/fixtures'

const mocks = vi.hoisted(() => ({ eq: vi.fn(), update: vi.fn(), from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))

import { updateTrainingTask } from './tasksService'

describe('tasksService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.eq.mockResolvedValue({ error: null })
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockReturnValue({ update: mocks.update })
  })

  test('never moves the week while editing a task', async () => {
    await updateTrainingTask(makeTask().id, {
      seasonId: 'season-2', date: '2030-01-07', title: 'Editada', description: 'Texto', trainingType: 'Físico', status: 'published',
    })
    expect(mocks.update).toHaveBeenCalledWith(expect.not.objectContaining({ week_start: expect.anything() }))
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Editada', season_id: 'season-2' }))
  })
})
