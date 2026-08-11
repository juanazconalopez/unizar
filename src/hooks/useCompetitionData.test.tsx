import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchCompetitionSeasonData, fetchCompetitionSeasons, syncCompetition } from '../services/competitionService'
import { useCompetitionData } from './useCompetitionData'

vi.mock('../services/competitionService', () => ({
  fetchCompetitionSeasons: vi.fn(),
  fetchCompetitionSeasonData: vi.fn(),
  syncCompetition: vi.fn(),
}))

const currentSeason = {
  id: 'competition-2025-26',
  name: '2025–26',
  startsOn: '2025-07-01',
  sourceLabel: 'MatchReady',
  updatedAt: new Date().toISOString(),
}
const emptySeasonData = { fixtures: [], standings: [], playerStats: [] }

describe('useCompetitionData', () => {
  beforeEach(() => {
    vi.mocked(fetchCompetitionSeasons).mockReset().mockResolvedValue([currentSeason])
    vi.mocked(fetchCompetitionSeasonData).mockReset().mockResolvedValue(emptySeasonData)
    vi.mocked(syncCompetition).mockReset().mockResolvedValue({ season: '2025–26', fixtures: 12, standings: 4, playerStats: 20, syncedAt: new Date().toISOString() })
  })

  test('loads only the latest season initially and requests history on demand', async () => {
    const { result } = renderHook(() => useCompetitionData(true, false))
    await waitFor(() => expect(result.current.seasons).toHaveLength(1))
    expect(fetchCompetitionSeasonData).toHaveBeenCalledWith('competition-2025-26')

    await act(async () => result.current.loadSeason('competition-2024-25'))
    expect(fetchCompetitionSeasonData).toHaveBeenCalledWith('competition-2024-25')
  })

  test('lets the owner synchronize and reload the persisted snapshot', async () => {
    const { result } = renderHook(() => useCompetitionData(true, true))
    await waitFor(() => expect(result.current.seasons).toHaveLength(1))
    await act(async () => result.current.synchronize())
    expect(syncCompetition).toHaveBeenCalledOnce()
    expect(fetchCompetitionSeasons).toHaveBeenCalledTimes(2)
  })
})

