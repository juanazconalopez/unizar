import { act, renderHook } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeProfile, makeResult, makeTask } from '../test/fixtures'
import { fetchTaskWindow, fetchTrainingData } from '../services/trainingService'
import type { ViewName } from '../types'
import { AUTO_REFRESH_INTERVAL_MS, useTrainingData } from './useTrainingData'

vi.mock('../services/trainingService', () => ({
  fetchTrainingData: vi.fn(),
  fetchTaskWindow: vi.fn(),
  fetchStatisticsWindow: vi.fn(),
  fetchAttendanceDate: vi.fn(),
  fetchMatchWindow: vi.fn(),
}))

const session = {
  user: { id: 'player-1' },
} as Session

const trainingData = {
  profile: makeProfile({ id: 'player-1' }),
  ownProfileDetails: null,
  profilePrivateDetails: [],
  seasons: [],
  memberships: [],
  profiles: [],
  tasks: [],
  results: [],
  trainingSessions: [],
  attendance: [],
  matches: [],
  matchAvailability: [],
  matchLineups: [],
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
  })

  afterEach(() => vi.useRealTimers())

  test('loads data when a session starts', async () => {
    const { result } = renderHook(() => useTrainingData(session))

    await flushInitialLoad()

    expect(fetchTrainingData).toHaveBeenCalledTimes(1)
    expect(fetchTrainingData).toHaveBeenCalledWith('player-1', 'home')
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

    expect(fetchTrainingData).toHaveBeenLastCalledWith('player-1', 'matches')
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
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}
