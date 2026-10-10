import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeAnnouncement, makeAttendance, makeMatch, makeMembership, makeProfile, makeProfilePrivateDetails, makeResult, makeSeason, makeSession, makeTask } from '../test/fixtures'

const mocks = vi.hoisted(() => ({
  from: vi.fn(), rpc: vi.fn(), permissions: vi.fn(), birthdays: vi.fn(), tasks: vi.fn(),
  attention: vi.fn(), attendance: vi.fn(), teams: vi.fn(), competitions: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('./birthdayService', () => ({ fetchTodayBirthdays: mocks.birthdays, fetchActiveSeasonBirthdays: vi.fn(), fetchPlayerCalendarBirthdays: vi.fn() }))
vi.mock('./permissionsService', () => ({ fetchMyPermissions: mocks.permissions, fetchPermissionConfiguration: vi.fn() }))
vi.mock('./seasonTeamsService', () => ({ fetchSeasonTeams: mocks.teams, fetchSeasonTeamCoaches: vi.fn() }))
vi.mock('./seasonCompetitionsService', () => ({ fetchSeasonCompetitions: mocks.competitions }))
vi.mock('./trainingQueriesService', async (original) => ({
  ...await original<typeof import('./trainingQueriesService')>(),
  fetchTaskWindow: mocks.tasks, fetchHomeAttention: mocks.attention, fetchAttendanceForSessions: mocks.attendance,
}))

import { fetchTrainingData } from './trainingDataService'

const season = makeSeason({ start_date: '2026-08-01', end_date: '2027-06-30' })
const sessions = [makeSession({ session_date: '2026-09-03' })]

function query(data: unknown, profile = makeProfile()) {
  const response = { data, error: null }
  const builder = {
    select: vi.fn(), eq: vi.fn(), gte: vi.fn(), lte: vi.fn(), order: vi.fn(),
    single: vi.fn(() => Promise.resolve({ data: profile, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: makeProfilePrivateDetails(), error: null })),
    then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve),
  }
  for (const method of ['select', 'eq', 'gte', 'lte', 'order'] as const) builder[method].mockReturnValue(builder)
  return builder
}

describe('home data loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))
    mocks.permissions.mockResolvedValue([])
    mocks.rpc.mockResolvedValue({ data: [makeMembership()], error: null })
    mocks.birthdays.mockResolvedValue([{ player_id: 'player-1', display_name: 'Ana Martín' }])
    mocks.tasks.mockResolvedValue({ tasks: [makeTask()], results: [makeResult()], announcements: [] })
    mocks.attention.mockResolvedValue({ matches: [makeMatch()], announcements: [makeAnnouncement()] })
    mocks.attendance.mockResolvedValue({ trainingSessions: sessions, attendance: [makeAttendance()], provisionalAttendance: [] })
    mocks.from.mockImplementation((table) => query(table === 'seasons' ? [season] : table === 'training_sessions' ? sessions : []))
  })
  afterEach(() => vi.useRealTimers())

  test('starts independent home queries while birthdays are still pending and preserves the results', async () => {
    let finishBirthdays!: (value: unknown[]) => void
    mocks.birthdays.mockReturnValue(new Promise((resolve) => { finishBirthdays = resolve }))
    const request = fetchTrainingData('player-1')

    await vi.waitFor(() => {
      expect(mocks.tasks).toHaveBeenCalledOnce()
      expect(mocks.attention).toHaveBeenCalledOnce()
      expect(mocks.attendance).toHaveBeenCalledOnce()
    })
    finishBirthdays([{ player_id: 'player-1', display_name: 'Ana Martín' }])
    const result = await request

    expect(result.tasks).toEqual([makeTask()])
    expect(result.results).toEqual([makeResult()])
    expect(result.matches).toEqual([makeMatch()])
    expect(result.announcements).toEqual([makeAnnouncement()])
    expect(result.attendance).toEqual([makeAttendance()])
    expect(result.todayBirthdays).toHaveLength(1)
    expect(mocks.tasks).toHaveBeenCalledWith('player-1', false, '2026-08-31', '2026-08-31', { includeAnnouncements: false })
    expect(mocks.teams).not.toHaveBeenCalled()
    expect(mocks.competitions).not.toHaveBeenCalled()
  })

  test('keeps personal attendance scoped to the user and excludes future sessions', async () => {
    const sessionQuery = query(sessions)
    mocks.from.mockImplementation((table) => table === 'training_sessions' ? sessionQuery : query(table === 'seasons' ? [season] : []))

    const result = await fetchTrainingData('player-1')

    expect(sessionQuery.gte).toHaveBeenCalledWith('session_date', season.start_date)
    expect(sessionQuery.lte).toHaveBeenCalledWith('session_date', '2026-09-04')
    expect(mocks.attendance).toHaveBeenCalledWith(sessions, 'player-1')
    expect(result.trainingSessions).toEqual(sessions)
  })

  test('does not download personal attendance that the staff dashboard does not display', async () => {
    const profile = makeProfile({ is_owner: true })
    mocks.from.mockImplementation((table) => query(table === 'seasons' ? [season] : [], profile))

    const result = await fetchTrainingData('player-1')

    expect(mocks.from).not.toHaveBeenCalledWith('training_sessions')
    expect(mocks.attendance).not.toHaveBeenCalled()
    expect(result.trainingSessions).toEqual([])
    expect(result.attendance).toEqual([])
    expect(result.tasks).toEqual([makeTask()])
    expect(mocks.tasks).toHaveBeenCalledWith('player-1', true, '2026-08-31', '2026-08-31', { includeAnnouncements: false })
  })

  test('keeps the weekly announcements when there is no active season', async () => {
    const announcements = [makeAnnouncement()]
    mocks.from.mockImplementation(() => query([]))
    mocks.tasks.mockResolvedValue({ tasks: [], results: [], announcements })

    const result = await fetchTrainingData('player-1')

    expect(mocks.tasks).toHaveBeenCalledWith('player-1', false, '2026-08-31', '2026-08-31', { includeAnnouncements: true })
    expect(mocks.attention).not.toHaveBeenCalled()
    expect(result.announcements).toEqual(announcements)
  })

  test('propagates a failed query so home still offers its existing retry', async () => {
    mocks.attention.mockRejectedValue(new Error('Sin conexión'))
    await expect(fetchTrainingData('player-1')).rejects.toThrow('Sin conexión')
  })
})
