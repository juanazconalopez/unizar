import { act, renderHook } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeProfile } from '../test/fixtures'
import { fetchTrainingData } from '../services/trainingService'
import type { ViewName } from '../types'
import { AUTO_REFRESH_INTERVAL_MS, useTrainingData } from './useTrainingData'

vi.mock('../services/trainingService', () => ({
  fetchTrainingData: vi.fn(),
}))

const session = {
  user: { id: 'player-1' },
} as Session

const trainingData = {
  profile: makeProfile({ id: 'player-1' }),
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
})
