import { useCallback, useEffect, useRef, useState } from 'react'
import { errorText } from '../lib/errors'
import { fetchCompetitionSeasonData, fetchCompetitionSeasons, syncCompetition } from '../services/competitionService'
import type { CompetitionFixture, CompetitionPlayerStat, CompetitionSeason, CompetitionStanding } from '../types'

const AUTO_SYNC_AGE_MS = 12 * 60 * 60 * 1000

export function useCompetitionData(enabled: boolean, isOwner: boolean) {
  const [seasons, setSeasons] = useState<CompetitionSeason[]>([])
  const [fixtures, setFixtures] = useState<CompetitionFixture[]>([])
  const [standings, setStandings] = useState<CompetitionStanding[]>([])
  const [playerStats, setPlayerStats] = useState<CompetitionPlayerStat[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const loadedSeasons = useRef(new Set<string>())
  const autoSyncAttempted = useRef(false)

  const loadSeason = useCallback(async (seasonId: string, force = false) => {
    if (!seasonId || (!force && loadedSeasons.current.has(seasonId))) return
    setLoading(true)
    setErrorMessage('')
    try {
      const data = await fetchCompetitionSeasonData(seasonId)
      setFixtures((current) => replaceSeason(current, data.fixtures, seasonId))
      setStandings((current) => replaceSeason(current, data.standings, seasonId))
      setPlayerStats((current) => replaceSeason(current, data.playerStats, seasonId))
      loadedSeasons.current.add(seasonId)
    } catch (error) {
      setErrorMessage(errorText(error))
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const reload = useCallback(async () => {
    if (!enabled) return [] as CompetitionSeason[]
    setLoading(true)
    setErrorMessage('')
    try {
      const nextSeasons = await fetchCompetitionSeasons()
      setSeasons(nextSeasons)
      if (nextSeasons[0]) await loadSeason(nextSeasons[0].id, true)
      return nextSeasons
    } catch (error) {
      setErrorMessage(errorText(error))
      return [] as CompetitionSeason[]
    } finally {
      setLoading(false)
    }
  }, [enabled, loadSeason])

  const synchronize = useCallback(async () => {
    if (!isOwner) return
    setSyncing(true)
    setErrorMessage('')
    try {
      await syncCompetition()
      loadedSeasons.current.clear()
      await reload()
    } catch (error) {
      setErrorMessage(errorText(error))
      throw error
    } finally {
      setSyncing(false)
    }
  }, [isOwner, reload])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void reload().then((nextSeasons) => {
        if (cancelled || !isOwner || autoSyncAttempted.current) return
        autoSyncAttempted.current = true
        const lastUpdate = nextSeasons[0]?.updatedAt ? Date.parse(nextSeasons[0].updatedAt) : 0
        if (!lastUpdate || Date.now() - lastUpdate >= AUTO_SYNC_AGE_MS) {
          void synchronize().catch(() => undefined)
        }
      })
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [enabled, isOwner, reload, synchronize])

  return { seasons, fixtures, standings, playerStats, loading, syncing, errorMessage, loadSeason, synchronize }
}

function replaceSeason<T extends { competitionSeasonId: string }>(current: T[], incoming: T[], seasonId: string) {
  return [...current.filter((item) => item.competitionSeasonId !== seasonId), ...incoming]
}
