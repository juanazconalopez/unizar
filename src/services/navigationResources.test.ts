import { beforeEach, expect, test, vi } from 'vitest'
import { makeProfile, makeSeason } from '../test/fixtures'
import { SessionQueryCache } from './sessionQueryCache'
import { navigationResourceKeys, prepareNavigationResources } from './navigationResources'
import type { TrainingData } from './trainingDataService'
import type { TrainingGroupsApi } from '../features/trainingGroups/types'

const reads = vi.hoisted(() => ({ plans: vi.fn(), surveys: vi.fn(), work: vi.fn(), competition: vi.fn(), competitionSeason: vi.fn() }))
vi.mock('./trainingPlansService', () => ({ fetchTrainingPlans: reads.plans }))
vi.mock('./surveysService', () => ({ fetchManageSurveys: reads.surveys }))
vi.mock('./workGroupsService', () => ({ workGroupsApi: { load: reads.work } }))
vi.mock('./competitionService', () => ({ fetchCompetitionSeasons: reads.competition, fetchCompetitionSeasonData: reads.competitionSeason }))
const data = { profile: makeProfile({ is_owner: true }), permissionKeys: [], seasons: [makeSeason({ start_date: '2020-01-01', end_date: '2099-01-01' })] } as unknown as TrainingData
const groups: TrainingGroupsApi = { summary: vi.fn(), workspace: vi.fn(), saveDraft: vi.fn(), publish: vi.fn(), discardDraft: vi.fn() }
beforeEach(() => { vi.clearAllMocks(); reads.plans.mockResolvedValue([]); reads.surveys.mockResolvedValue([]); reads.work.mockResolvedValue({ members: [] }); reads.competition.mockResolvedValue([{ id: 'current' }]); reads.competitionSeason.mockResolvedValue({ fixtures: [], standings: [], playerStats: [] }) })

test('makes training and survey lists available synchronously without rereading them when opening the section', async () => {
  const cache = new SessionQueryCache()
  await prepareNavigationResources('training', data, cache, groups)
  await prepareNavigationResources('surveys', data, cache, groups)
  expect(cache.peek(navigationResourceKeys.trainingPlans())).toEqual([])
  expect(cache.peek(navigationResourceKeys.surveys)).toEqual([])
  await prepareNavigationResources('training', data, cache, groups)
  expect(reads.plans).toHaveBeenCalledOnce()
})

test('work groups and video share a single prepared workspace', async () => {
  const cache = new SessionQueryCache()
  await Promise.all([prepareNavigationResources('work-groups', data, cache, groups), prepareNavigationResources('video-analysis', data, cache, groups)])
  expect(reads.work).toHaveBeenCalledExactlyOnceWith(data.seasons[0].id)
  expect(cache.peek(navigationResourceKeys.workGroups(data.seasons[0].id))).toEqual({ members: [] })
})

test('prepares only the latest competition snapshot, without triggering synchronization or loading history', async () => {
  const cache = new SessionQueryCache()
  await prepareNavigationResources('competition', data, cache, groups)
  expect(reads.competitionSeason).toHaveBeenCalledExactlyOnceWith('current')
  expect(cache.peek(navigationResourceKeys.competitionSeason('current'))).toEqual({ fixtures: [], standings: [], playerStats: [] })
})
