import { afterEach, expect, test, vi } from 'vitest'
import { SessionQueryCache } from './sessionQueryCache'
import { cachedTrainingGroupsApi, trainingGroupsApi } from './trainingGroupsService'

afterEach(() => vi.restoreAllMocks())

test('preloaded group queries are reused, and saving a draft invalidates the published workspace too', async () => {
  const summary = vi.spyOn(trainingGroupsApi, 'summary').mockResolvedValue({ blocks: [], own_groups: [] })
  const workspace = vi.spyOn(trainingGroupsApi, 'workspace').mockResolvedValue({ candidates: [], members: [], draft: null })
  vi.spyOn(trainingGroupsApi, 'saveDraft').mockResolvedValue('block-1')
  const api = cachedTrainingGroupsApi(new SessionQueryCache())
  await api.summary('season-1')
  await api.workspace('season-1', 'block-1', '2026-10-21')
  await api.summary('season-1')
  await api.workspace('season-1', 'block-1', '2026-10-21')
  expect(summary).toHaveBeenCalledOnce()
  expect(workspace).toHaveBeenCalledOnce()
  await api.saveDraft({ seasonId: 'season-1', startsOn: '2026-10-21', members: [] })
  await api.summary('season-1')
  await api.workspace('season-1', 'block-1', '2026-10-21')
  expect(summary).toHaveBeenCalledTimes(2)
  expect(workspace).toHaveBeenCalledTimes(2)
})
