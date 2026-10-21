import { act, renderHook } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeProfile, makeResult, makeTask } from '../test/fixtures'
import { SessionQueryCache } from '../services/sessionQueryCache'
import { PERMISSIONS } from '../lib/permissions'
import { fetchTrainingData, type TrainingData } from '../services/trainingDataService'
import { fetchMatchWindow, fetchTaskWindow } from '../services/trainingQueriesService'
import type { ViewName } from '../types'
import { AUTO_REFRESH_INTERVAL_MS, useTrainingData } from './useTrainingData'

vi.mock('../services/trainingDataService', () => ({
  fetchTrainingData: vi.fn(),
}))

vi.mock('../services/trainingQueriesService', () => ({
  fetchTaskWindow: vi.fn(),
  fetchStatisticsWindow: vi.fn(),
  fetchAttendanceDate: vi.fn(),
  fetchMatchWindow: vi.fn(),
}))

const session = {
  user: { id: 'player-1' },
} as Session

const trainingData: TrainingData = {
  profile: makeProfile({ id: 'player-1' }),
  ownProfileDetails: null,
  profilePrivateDetails: [],
  seasons: [],
  seasonCompetitions: [],
  seasonTeams: [],
  seasonTeamCoaches: [],
  playerAbsences: [],
  playerAbsencePrivateNotes: [],
  memberships: [],
  profiles: [],
  tasks: [],
  results: [],
  trainingSessions: [],
  attendance: [],
  provisionalPlayers: [],
  provisionalAttendance: [],
  matches: [],
  matchAvailability: [],
  matchLineups: [],
  todayBirthdays: [],
  seasonBirthdays: [],
  calendarBirthdays: [],
  libraryItems: [],
  librarySettings: null,
  permissionKeys: [],
  permissionConfiguration: { definitions: [], grants: [] },
}

async function flushInitialLoad() {
  await act(async () => {
    vi.runOnlyPendingTimers()
    await Promise.resolve()
  })
}

describe('useTrainingData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-10T10:00:00Z'))
    vi.mocked(fetchTrainingData).mockReset()
    vi.mocked(fetchTrainingData).mockResolvedValue(trainingData)
    vi.mocked(fetchTaskWindow).mockReset()
    vi.mocked(fetchMatchWindow).mockReset()
  })

  afterEach(() => vi.useRealTimers())

  test('loads data when a session starts', async () => {
    const { result } = renderHook(() => useTrainingData(session))

    await flushInitialLoad()

    expect(fetchTrainingData).toHaveBeenCalledTimes(1)
    expect(fetchTrainingData).toHaveBeenCalledWith('player-1', 'home', expect.any(SessionQueryCache))
    expect(result.current.profile?.id).toBe('player-1')
  })

  test('refreshes stale data when the application recovers focus', async () => {
    renderHook(() => useTrainingData(session))
    await flushInitialLoad()

    act(() => window.dispatchEvent(new Event('focus')))
    expect(fetchTrainingData).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(AUTO_REFRESH_INTERVAL_MS)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await Promise.resolve()
    })

    expect(fetchTrainingData).toHaveBeenCalledTimes(2)
  })

  test('refreshes stale data after recovering the connection', async () => {
    renderHook(() => useTrainingData(session))
    await flushInitialLoad()

    vi.advanceTimersByTime(AUTO_REFRESH_INTERVAL_MS)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
    })

    expect(fetchTrainingData).toHaveBeenCalledTimes(2)
  })

  test('loads only the data scope for the selected view', async () => {
    const { rerender } = renderHook(
      ({ view }) => useTrainingData(session, view),
      { initialProps: { view: 'home' as ViewName } },
    )
    await flushInitialLoad()

    rerender({ view: 'matches' })
    await flushInitialLoad()

    expect(fetchTrainingData).toHaveBeenLastCalledWith('player-1', 'matches', expect.any(SessionQueryCache))
  })

  test('restores a visited section and its extra ranges without another request', async () => {
    const oldTask = makeTask({ id: 'old-task', week_start: '2026-07-20' })
    vi.mocked(fetchTaskWindow).mockResolvedValue({ tasks: [oldTask], results: [] })
    const { result, rerender } = renderHook(({ view }) => useTrainingData(session, view), {
      initialProps: { view: 'calendar' as ViewName },
    })
    await flushInitialLoad()
    await act(async () => { await result.current.loadTaskRange('2026-07-20', '2026-07-27') })
    rerender({ view: 'library' })
    await flushInitialLoad()
    expect(result.current.tasks).toEqual([])
    rerender({ view: 'calendar' })
    expect(result.current.loadedView).toBe('calendar')
    expect(result.current.tasks).toContainEqual(oldTask)
    await flushInitialLoad()
    expect(fetchTrainingData).toHaveBeenCalledTimes(2)
    expect(fetchTaskWindow).toHaveBeenCalledTimes(1)
  })

  test('shows a stale snapshot while refreshing it in the background', async () => {
    const { result, rerender } = renderHook(({ view }) => useTrainingData(session, view), {
      initialProps: { view: 'home' as ViewName },
    })
    await flushInitialLoad()
    rerender({ view: 'library' })
    await flushInitialLoad()
    act(() => vi.advanceTimersByTime(AUTO_REFRESH_INTERVAL_MS))
    const refresh = deferred<typeof trainingData>()
    vi.mocked(fetchTrainingData).mockReturnValueOnce(refresh.promise)
    rerender({ view: 'home' })
    await flushInitialLoad()
    expect(result.current.loadedView).toBe('home')
    expect(result.current.profile?.id).toBe('player-1')
    expect(result.current.loading).toBe(true)
    await act(async () => {
      refresh.resolve({ ...trainingData, tasks: [makeTask({ title: 'Actualizado' })] })
    })
    expect(result.current.tasks[0].title).toBe('Actualizado')
  })

  test('prepares permitted common sections and reuses an in-flight preload', async () => {
    const calendar = deferred<typeof trainingData>()
    const allowed = { ...trainingData, permissionKeys: [PERMISSIONS.dashboard.personal, PERMISSIONS.calendar.personal] }
    vi.mocked(fetchTrainingData).mockImplementation((_id, scope) => scope === 'calendar' ? calendar.promise : Promise.resolve(allowed))
    const { result, rerender } = renderHook(({ view }) => useTrainingData(session, view), {
      initialProps: { view: 'home' as ViewName },
    })
    await flushInitialLoad()
    await flushInitialLoad()
    expect(vi.mocked(fetchTrainingData).mock.calls.map((call) => call[1])).toEqual(['home', 'calendar'])
    rerender({ view: 'calendar' })
    await flushInitialLoad()
    expect(fetchTrainingData).toHaveBeenCalledTimes(2)
    await act(async () => { calendar.resolve(allowed) })
    expect(result.current.loadedView).toBe('calendar')
  })

  test('a slow previous section does not block navigation or replace the visible section', async () => {
    const slow = deferred<typeof trainingData>()
    vi.mocked(fetchTrainingData).mockReturnValueOnce(slow.promise).mockResolvedValue(trainingData)
    const { result, rerender } = renderHook(({ view }) => useTrainingData(session, view), {
      initialProps: { view: 'home' as ViewName },
    })
    await flushInitialLoad()
    rerender({ view: 'library' })
    await flushInitialLoad()
    expect(result.current.loadedView).toBe('library')
    await act(async () => { slow.resolve({ ...trainingData, tasks: [makeTask()] }) })
    expect(result.current.loadedView).toBe('library')
    expect(result.current.tasks).toEqual([])
  })

  test('a save invalidates other section snapshots before revisiting them', async () => {
    const { result, rerender } = renderHook(({ view }) => useTrainingData(session, view), {
      initialProps: { view: 'home' as ViewName },
    })
    await flushInitialLoad()
    rerender({ view: 'library' })
    await flushInitialLoad()
    await act(async () => { await result.current.reload() })
    rerender({ view: 'home' })
    await flushInitialLoad()
    expect(fetchTrainingData).toHaveBeenCalledTimes(4)
  })

  test('rejects late responses and snapshots from a different account', async () => {
    const old = deferred<typeof trainingData>()
    const { result, rerender } = renderHook(({ account }) => useTrainingData(account), {
      initialProps: { account: session },
    })
    await flushInitialLoad()
    vi.mocked(fetchTrainingData).mockReturnValueOnce(old.promise)
    let pending!: Promise<void>
    act(() => { pending = result.current.reload() })
    const next = { user: { id: 'player-2' } } as Session
    vi.mocked(fetchTrainingData).mockResolvedValue({ ...trainingData, profile: makeProfile({ id: 'player-2' }) })
    rerender({ account: next })
    await flushInitialLoad()
    await act(async () => { old.resolve(trainingData); await pending })
    expect(result.current.loadedUserId).toBe('player-2')
    expect(result.current.profile?.id).toBe('player-2')
  })

  test('a refreshed role cannot be overwritten by a previously visited section', async () => {
    const updated = { ...trainingData, profile: makeProfile({ is_player: false, is_viewer: true }) }
    const { result, rerender } = renderHook(({ view }) => useTrainingData(session, view), {
      initialProps: { view: 'home' as ViewName },
    })
    await flushInitialLoad()
    vi.mocked(fetchTrainingData).mockResolvedValue(updated)
    rerender({ view: 'library' })
    await flushInitialLoad()
    rerender({ view: 'home' })
    await flushInitialLoad()
    expect(fetchTrainingData).toHaveBeenCalledTimes(3)
    expect(result.current.profile?.is_player).toBe(false)
    expect(result.current.profile?.is_viewer).toBe(true)
  })

  test('a background access change restarts an obsolete visible request instead of leaving it loading', async () => {
    const calendar = deferred<TrainingData>()
    const oldLibrary = deferred<TrainingData>()
    const allowed = { ...trainingData, permissionKeys: [PERMISSIONS.calendar.personal] }
    const disabled = { ...trainingData, profile: makeProfile({ is_active: false }) }
    let libraryCalls = 0
    vi.mocked(fetchTrainingData).mockImplementation((_id, scope) => {
      if (scope === 'calendar') return calendar.promise
      if (scope === 'library') return ++libraryCalls === 1 ? oldLibrary.promise : Promise.resolve(disabled)
      return Promise.resolve(allowed)
    })
    const { result, rerender } = renderHook(({ view }) => useTrainingData(session, view), {
      initialProps: { view: 'home' as ViewName },
    })
    await flushInitialLoad()
    await flushInitialLoad()
    rerender({ view: 'library' })
    await flushInitialLoad()
    await act(async () => { calendar.resolve(disabled) })
    await flushInitialLoad()
    expect(result.current.loadedView).toBe('library')
    expect(result.current.loading).toBe(false)
    await act(async () => { oldLibrary.resolve(allowed) })
    expect(result.current.profile?.is_active).toBe(false)
  })

  test('adds a requested task window without discarding visible data', async () => {
    const oldTask = makeTask({ id: 'old-task', week_start: '2026-07-20' })
    const oldResult = makeResult({ task_id: oldTask.id, player_id: 'player-1' })
    vi.mocked(fetchTaskWindow).mockResolvedValue({ tasks: [oldTask], results: [oldResult] })
    const { result } = renderHook(() => useTrainingData(session, 'tasks'))
    await flushInitialLoad()

    await act(async () => {
      await result.current.loadTaskRange('2026-07-20', '2026-07-27')
    })

    expect(fetchTaskWindow).toHaveBeenCalledWith('player-1', false, '2026-07-20', '2026-07-27')
    expect(result.current.tasks).toContainEqual(oldTask)
    expect(result.current.results).toContainEqual(oldResult)
  })

  test('ignores an older range response that arrives after a newer one', async () => {
    const first = deferred<Awaited<ReturnType<typeof fetchTaskWindow>>>()
    const second = deferred<Awaited<ReturnType<typeof fetchTaskWindow>>>()
    vi.mocked(fetchTaskWindow)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useTrainingData(session, 'tasks'))
    await flushInitialLoad()

    let firstLoad!: Promise<void>
    let secondLoad!: Promise<void>
    act(() => {
      firstLoad = result.current.loadTaskRange('2026-07-06', '2026-07-13')
      secondLoad = result.current.loadTaskRange('2026-06-22', '2026-06-29')
    })
    const newestTask = makeTask({ id: 'newest', week_start: '2026-06-22' })
    await act(async () => {
      second.resolve({ tasks: [newestTask], results: [] })
      await secondLoad
    })
    await act(async () => {
      first.resolve({ tasks: [makeTask({ id: 'stale', week_start: '2026-07-06' })], results: [] })
      await firstLoad
    })

    expect(result.current.tasks).toContainEqual(newestTask)
    expect(result.current.tasks.some((task) => task.id === 'stale')).toBe(false)
  })

  test('reloads supplemental task ranges when the application recovers focus', async () => {
    const oldTask = makeTask({ id: 'old-task', week_start: '2026-07-20', title: 'Versión inicial' })
    const refreshedTask = { ...oldTask, title: 'Versión actualizada' }
    vi.mocked(fetchTaskWindow)
      .mockResolvedValueOnce({ tasks: [oldTask], results: [] })
      .mockResolvedValueOnce({ tasks: [refreshedTask], results: [] })
    const { result } = renderHook(() => useTrainingData(session, 'tasks'))
    await flushInitialLoad()
    await act(async () => {
      await result.current.loadTaskRange('2026-07-20', '2026-07-27')
    })

    vi.advanceTimersByTime(AUTO_REFRESH_INTERVAL_MS)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchTaskWindow).toHaveBeenCalledTimes(2)
    expect(result.current.tasks).toContainEqual(refreshedTask)
  })

  test('reuses a recent match month and invalidates it after a match change', async () => {
    vi.mocked(fetchMatchWindow).mockResolvedValue({ matches: [], matchAvailability: [], matchLineups: [] })
    const { result } = renderHook(() => useTrainingData(session, 'calendar'))
    await flushInitialLoad()

    await act(async () => {
      await result.current.loadMatchMonth('2026-10-01')
      await result.current.loadMatchMonth('2026-10-01')
    })
    expect(fetchMatchWindow).toHaveBeenCalledTimes(1)

    act(() => result.current.invalidateMatchMonths('2026-10-14'))
    await act(async () => { await result.current.loadMatchMonth('2026-10-01') })
    expect(fetchMatchWindow).toHaveBeenCalledTimes(2)
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}
